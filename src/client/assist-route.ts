/**
 * The one place the browser decides which route an assist call will use.
 *
 * Background: the route has two possible owners. The **Host** owns the settings
 * document and the Session's durable model selection, so it is the only side
 * that can answer without guessing (`betterInput/resolveAssistRoute`, see
 * `src/polish/service.ts`). The browser owns a *render-time snapshot* of the
 * composer's selection (`src/client/composer-model.ts`), which is what the input
 * box displays and what the follow row shows.
 *
 * The two can disagree in one direction only: the snapshot's backing store is
 * populated after the model-selection plugin's Host catalog becomes `ready`, so
 * a live directory legitimately answers `current: null` for a moment. The Host
 * may therefore answer "no composer route" while the browser can still read one.
 *
 * This resolver encodes the resulting precedence once, so the buttons and the
 * settings page cannot drift apart:
 *
 *   1. Follow **on** → ask the Host. A non-empty answer wins, `source` included.
 *   2. Follow on, Host unavailable/empty → use the composer snapshot the browser
 *      renders from (the old `sqs.1` behaviour). Skipping the assist instead
 *      would silently drop polishing on a perfectly readable selection.
 *   3. Follow **off**, or an unreadable composer → the configured settings route.
 *   4. Neither side names a usable route → `null` ("no model configured").
 *
 * There is deliberately no route-list validation here: see the note in
 * `resolveAssistRoute` on the Host. A route the provider rejects produces its own
 * error message, which is strictly more useful than silently running the assist
 * on a *different* model than the composer shows.
 *
 * Pure by design — the Remote call is injected — so `npm run check:routes` can
 * drive every branch with a stub.
 */

import { resolveInputModelRoute, type BetterInputSettings, type ComposerModelRoute, type EffectiveModelRoute } from '../config.js'
// Type-only, like every other import of the wire contract on the client side:
// a *value* import here is what silently drags zod (~180 kB) into the browser
// bundle (AGENTS.md rule 3, guarded by `npm run check:bundle`).
import type { AssistRouteView } from '../remote-contract.js'
import type { BetterInputRemote } from '../remote.js'

/** Which assist is being resolved; mirrors the Host's `feature` parameter. */
export type AssistFeature = 'polish' | 'optimize'

/** Which input named the route that will actually be called. */
export type AssistRouteSource = 'composer' | 'settings' | 'none'

/** A route that is definitely callable, plus the input it came from. */
export type ResolvedAssistRoute = {
  readonly route: EffectiveModelRoute
  readonly source: AssistRouteSource
}

/** The slice of the plugin Remote this resolver needs. */
export type AssistRouteRemote = Pick<BetterInputRemote, 'resolveAssistRoute'>

/** The settings slice one feature's route resolution reads. */
export function assistSettingsFor(
  settings: BetterInputSettings,
  feature: AssistFeature
): { follow: boolean; configured: { provider: string; model: string; reasoningEffort: string } } {
  return feature === 'polish'
    ? {
      follow: settings.polishFollowInputModel,
      configured: {
        provider: settings.polishProvider,
        model: settings.polishModel,
        reasoningEffort: settings.polishReasoningEffort
      }
    }
    : {
      follow: settings.optimizeFollowInputModel,
      configured: {
        provider: settings.optimizeProvider,
        model: settings.optimizeModel,
        reasoningEffort: settings.optimizeReasoningEffort
      }
    }
}

/** Whether a route names both halves of a callable model. */
export function isUsableRoute(route: { provider: string; model: string } | null): boolean {
  return route !== null && route.provider.trim() !== '' && route.model.trim() !== ''
}

/**
 * Resolve the route one assist will call.
 *
 * Never throws: a rejected RPC is the same situation as a `{ ok: false }`
 * result — the Host could not answer — so it degrades to the browser's own
 * fallback. Callers get `null` when there is genuinely nothing to call, and
 * every other case is a callable route.
 *
 * @param remote - the plugin Remote (`resolveAssistRoute` is the only method used).
 * @param settings - the live settings document, or `null` while it is still loading.
 * @param feature - `'polish'` or `'optimize'`.
 * @param sessionId - the composer Session; `''` when the caller has none.
 * @param composer - the composer's selection from the browser snapshot, or `null`.
 */
export async function resolveAssistRoute(
  remote: AssistRouteRemote,
  settings: BetterInputSettings | null,
  feature: AssistFeature,
  sessionId: string,
  composer: ComposerModelRoute | null
): Promise<ResolvedAssistRoute | null> {
  if (settings === null) return null
  const { follow, configured } = assistSettingsFor(settings, feature)
  const local = resolveInputModelRoute(follow, composer, configured)

  if (follow) {
    let answer: AssistRouteView | null = null
    try {
      const result = await remote.resolveAssistRoute(feature, sessionId)
      if (result.ok) answer = result.value
    } catch {
      // The RPC itself failed (transport, withdrawn service). Treat it exactly
      // like an unusable answer and fall back below — this must never reject,
      // or the caller's click handler ends up with an unhandled rejection.
      answer = null
    }
    const provider = answer?.provider.trim() ?? ''
    const model = answer?.model.trim() ?? ''
    if (provider !== '' && model !== '') {
      return {
        route: { provider, model, reasoningEffort: answer?.reasoningEffort ?? configured.reasoningEffort },
        source: answer?.source ?? 'composer'
      }
    }
    // The Host could not name a route (follow is on but its two inputs yielded
    // nothing). The browser's own snapshot may still hold a readable model — it
    // is what the composer displays, so use it rather than skipping the assist.
    if (isUsableRoute(local)) {
      return { route: local, source: composer !== null ? 'composer' : 'settings' }
    }
    return null
  }

  return isUsableRoute(local) ? { route: local, source: 'settings' } : null
}
