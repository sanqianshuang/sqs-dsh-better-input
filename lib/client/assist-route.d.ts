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
import { type BetterInputSettings, type ComposerModelRoute, type EffectiveModelRoute } from '../config.js';
import type { BetterInputRemote } from '../remote.js';
/** Which assist is being resolved; mirrors the Host's `feature` parameter. */
export type AssistFeature = 'polish' | 'optimize';
/** Which input named the route that will actually be called. */
export type AssistRouteSource = 'composer' | 'settings' | 'none';
/** A route that is definitely callable, plus the input it came from. */
export type ResolvedAssistRoute = {
    readonly route: EffectiveModelRoute;
    readonly source: AssistRouteSource;
};
/** The slice of the plugin Remote this resolver needs. */
export type AssistRouteRemote = Pick<BetterInputRemote, 'resolveAssistRoute'>;
/** The settings slice one feature's route resolution reads. */
export declare function assistSettingsFor(settings: BetterInputSettings, feature: AssistFeature): {
    follow: boolean;
    configured: {
        provider: string;
        model: string;
        reasoningEffort: string;
    };
};
/** Whether a route names both halves of a callable model. */
export declare function isUsableRoute(route: {
    provider: string;
    model: string;
} | null): boolean;
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
export declare function resolveAssistRoute(remote: AssistRouteRemote, settings: BetterInputSettings | null, feature: AssistFeature, sessionId: string, composer: ComposerModelRoute | null): Promise<ResolvedAssistRoute | null>;
