import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { LlmModelInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { DEFAULT_SETTINGS, MAX_OPTIMIZED_CHARACTERS, MAX_OPTIMIZE_CHARACTERS, MAX_POLISHED_CHARACTERS, MAX_TRANSCRIPT_CHARACTERS, OPTIMIZE_TIMEOUT_MS, POLISH_TIMEOUT_MS, type BetterInputSettings, type BetterInputSettingsPatch, type BetterInputSettingsView, type PolishRoute, type ReasoningEffortInfo } from '../config.js'
import { checkForPluginUpdate, readInstalledAboutInfo, type AboutInfo, type UpdateCheckResult } from '../about.js'
import { optimizeUserText, polishUserText, resolveOptimizeSystemPrompt, resolvePolishSystemPrompt, OPTIMIZE_SYSTEM_PROMPT, POLISH_SYSTEM_PROMPT } from './prompts.js'
import type { TemplateInputWire, TemplateWire } from '../remote-contract.js'
import { TemplateStore } from '../templates/store.js'
import type { BetterInputTemplate } from '../templates/model.js'
import { SettingsStore } from '../settings/store.js'

export class BetterInputPolishService extends TypertRemoteService {
  static inject = ['llm']
  private readonly settingsStore = new SettingsStore()
  private readonly templateStore = new TemplateStore()

  constructor(ctx: Context) {
    super(ctx, 'BetterInputPolish', { namespace: 'betterInput' })
  }

  /**
   * Read the current settings for the settings page.
   *
   * dsh 0.1.7 dropped the old `settings.register` API, so this plugin owns its
   * settings in a JSON document (see `settings/store.ts`). `available` is
   * therefore always true and `writable` reflects whether the document can be
   * written; `overridden` lists the keys the user has explicitly set.
   */
  async getSettings(): Promise<BetterInputSettingsView> {
    const settings = await this.settingsStore.load()
    return {
      available: true,
      writable: this.settingsStore !== undefined,
      settings,
      overridden: overriddenKeys(settings),
      defaultPolishPrompt: POLISH_SYSTEM_PROMPT,
      defaultOptimizePrompt: OPTIMIZE_SYSTEM_PROMPT
    }
  }

  async updateSettings(patch: BetterInputSettingsPatch, signal: AbortSignal): Promise<BetterInputSettingsView> {
    signal.throwIfAborted()
    await this.settingsStore.merge(patch)
    return this.getSettings()
  }

  async listRoutes(): Promise<PolishRoute[]> {
    const routes: PolishRoute[] = []
    // NOTE: listRoutes intentionally skips per-model resolveModelInfo() calls.
    // Each resolution can require a roundtrip to the adapter/provider and a
    // registry with many models would make the settings page block for many
    // seconds on first open. Reasoning-effort metadata therefore arrives as
    // an empty array / undefined defaultEffort in the returned routes. The
    // settings UI hides the reasoning-effort dropdown entirely when the
    // list of efforts is empty, so users never see a half-populated menu.
    // We may add a dedicated resolveEfforts(provider, model) RPC in the
    // future if per-model lazy fetching becomes desirable.
    for (const provider of this.ctx.llm.listProviders()) {
      let models: readonly LlmModelInfo[]
      try {
        models = await this.ctx.llm.listModels(provider.id)
      } catch {
        continue
      }
      for (const model of models) {
        // NOTE: never assign an explicit `undefined` value. The Typert
        // gateway's boundary validation rejects any own-key holding
        // undefined as "not JSON-safe" after the Zod check passes, so
        // optional fields must simply be omitted.
        routes.push({
          provider: provider.id,
          providerName: provider.name,
          model: model.id,
          modelName: model.name,
          reasoningEfforts: []
        })
      }
    }
    return routes
  }

  /**
   * Lazily resolve reasoning efforts for a single route. Only called once the
   * settings UI actually displays that model's effort selector — so we never
   * blast the adapter/provide with hundreds of upfront resolveModelInfo calls.
   * Returns `{ efforts: [] }` (no defaultEffort key) if the metadata is
   * unavailable (adapter offline, model unknown, etc.).
   */
  async resolveModelEfforts(provider: string, model: string): Promise<{ efforts: readonly ReasoningEffortInfo[]; defaultEffort?: string }> {
    const resolved: LlmResolvedModelInfo | undefined = await (async () => {
      try {
        return await this.ctx.llm.resolveModelInfo(provider, model)
      } catch {
        return undefined
      }
    })()
    const reasoning = resolved?.reasoning
    const defaultEffort = reasoning?.defaultEffort != null ? String(reasoning.defaultEffort) : undefined
    // Optional fields are omitted rather than assigned undefined — the
    // gateway's JSON-safe boundary check rejects explicit undefined values.
    return {
      efforts: reasoning?.efforts?.map((effort) => ({
        id: String(effort.id),
        name: effort.name,
        ...(effort.description === undefined ? {} : { description: effort.description })
      })) ?? [],
      ...(defaultEffort === undefined ? {} : { defaultEffort })
    }
  }

  getAbout(): AboutInfo {
    return readInstalledAboutInfo()
  }

  async checkForUpdate(signal: AbortSignal): Promise<UpdateCheckResult> {
    signal.throwIfAborted()
    return checkForPluginUpdate({ installed: readInstalledAboutInfo().version, signal })
  }

  /**
   * Polish one transcript.
   *
   * The route and the reasoning effort are supplied by the caller rather than
   * read from the stored settings: the browser half resolves them from the
   * composer's current model (see `src/client/composer-model.ts`) and falls back
   * to the settings route when that is unreadable. An empty `effort` is the
   * plugin's "thinking off" default, not a missing value.
   */
  async polish(transcript: string, provider: string, model: string, effort: string, signal: AbortSignal): Promise<string> {
    const raw = transcript.trim()
    if (raw === '' || raw.length > MAX_TRANSCRIPT_CHARACTERS || signal.aborted) return raw
    const settings = await this.settingsStore.load()
    const storedPrompt = settings.polishPrompt

    const routeProvider = provider.trim()
    const routeModel = model.trim()
    if (routeProvider === '' || routeModel === '') return raw

    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), POLISH_TIMEOUT_MS)
    const forwardAbort = () => timeout.abort(signal.reason)
    signal.addEventListener('abort', forwardAbort, { once: true })

    try {
      const first = await this.completePolish(routeProvider, routeModel, raw, storedPrompt, effort, timeout.signal)
      if (first.trim() === raw && !timeout.signal.aborted && !signal.aborted) {
        // The model echoed the input unchanged; keep it rather than looping.
        return raw
      }
      return first
    } catch (error) {
      if (signal.aborted) return raw
      if (timeout.signal.aborted) throw new Error('The dsh LLM polishing request timed out')
      throw error instanceof Error ? error : new Error('The dsh LLM route did not complete polishing')
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', forwardAbort)
    }
  }

  /**
   * List the saved prompt templates, newest first.
   *
   * `TemplateStore.list()` already sorts by `updatedAt` descending, so the
   * wire order is the store order. This is the RPC the settings section and
   * the `/` trigger source read from; without it the Typert gateway resolves
   * the descriptor but finds no callable method on this service and fails the
   * whole call with `gateway/method-unavailable` (see `toTemplateWire`).
   */
  async templatesList(): Promise<{ templates: TemplateWire[] }> {
    const templates = await this.templateStore.list()
    return { templates: templates.map(toTemplateWire) }
  }

  async templatesSave(template: TemplateInputWire, signal: AbortSignal): Promise<{ template: TemplateWire }> {
    signal.throwIfAborted()
    // Optional fields are omitted rather than passed as `undefined`: the store
    // distinguishes "absent" (keep the existing value) from "empty string".
    const saved = await this.templateStore.save({
      name: template.name,
      content: template.content,
      ...(template.id === undefined ? {} : { id: template.id }),
      ...(template.description === undefined ? {} : { description: template.description }),
      ...(template.tags === undefined ? {} : { tags: [...template.tags] })
    })
    return { template: toTemplateWire(saved) }
  }

  async templatesRemove(id: string, signal: AbortSignal): Promise<{ removed: boolean }> {
    signal.throwIfAborted()
    return { removed: await this.templateStore.remove(id) }
  }

  /** Optimize one prompt; see {@link polish} for why the effort travels with the call. */
  async optimize(text: string, provider: string, model: string, context: string, effort: string, signal: AbortSignal): Promise<string> {
    const raw = text.trim()
    if (raw === '' || raw.length > MAX_OPTIMIZE_CHARACTERS || signal.aborted) return raw
    const settings = await this.settingsStore.load()
    const storedPrompt = settings.optimizePrompt

    const routeProvider = provider.trim()
    const routeModel = model.trim()
    if (routeProvider === '' || routeModel === '') throw new Error('No dsh LLM route configured for prompt optimization')

    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), OPTIMIZE_TIMEOUT_MS)
    const forwardAbort = () => timeout.abort(signal.reason)
    signal.addEventListener('abort', forwardAbort, { once: true })

    try {
      const result = await this.completeOptimize(routeProvider, routeModel, raw, context, storedPrompt, effort, timeout.signal)
      if (result.trim() === '' && !timeout.signal.aborted && !signal.aborted) {
        return raw
      }
      return result
    } catch (error) {
      if (signal.aborted) throw error
      if (timeout.signal.aborted) throw new Error('The dsh LLM optimize request timed out')
      throw error instanceof Error ? error : new Error('The dsh LLM route did not complete optimization')
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', forwardAbort)
    }
  }

  private async completePolish(provider: string, model: string, raw: string, storedPrompt: string, effort: string, signal: AbortSignal): Promise<string> {
    const config = await this.resolveEffortConfig(provider, model, effort, signal)
    const prepared = await this.ctx.llm.prepareCall(config, signal)
    const message = createUserMessage({
      content: [{ type: 'text', text: polishUserText(raw) }],
      source: { kind: 'user' }
    })
    const output = await collectText(prepared.stream({
      ...prepared.config,
      messages: [message],
      system: resolvePolishSystemPrompt(storedPrompt),
      signal
    }), MAX_POLISHED_CHARACTERS, 'polishing')
    if (output === '') throw new Error('The dsh LLM route returned no polished text')
    return output
  }

  private async completeOptimize(provider: string, model: string, raw: string, context: string, storedPrompt: string, effort: string, signal: AbortSignal): Promise<string> {
    const config = await this.resolveEffortConfig(provider, model, effort, signal)
    const prepared = await this.ctx.llm.prepareCall(config, signal)
    const message = createUserMessage({
      content: [{ type: 'text', text: optimizeUserText(raw) }],
      source: { kind: 'user' }
    })
    const output = await collectText(prepared.stream({
      ...prepared.config,
      messages: [message],
      system: resolveOptimizeSystemPrompt(storedPrompt, context),
      signal
    }), MAX_OPTIMIZED_CHARACTERS, 'optimization')
    if (output === '') throw new Error('The dsh LLM route returned no optimized text')
    return output
  }


  /**
   * Resolve the effective reasoning-effort wire config for one route.
   *
   * An effort the model actually advertises is forwarded as-is. Anything else —
   * the empty default, or a tier that belongs to the model the user was on
   * before switching (the route now follows the composer) — falls back to this
   * plugin's "thinking off" policy: the `off` tier when the model exposes one,
   * otherwise no `reasoningEffort` field at all so the adapter's own default
   * applies. Forwarding an unadvertised tier would make the adapter reject the
   * whole call, which is exactly what a stale effort used to do after a switch.
   */
  private async resolveEffortConfig(provider: string, model: string, effort: string, signal: AbortSignal): Promise<{ provider: string; model: string; reasoningEffort?: never }> {
    const selected = effort.trim()
    try {
      const resolved = await this.ctx.llm.resolveModelInfo(provider, model, signal)
      const efforts = resolved.reasoning?.efforts ?? []
      if (selected !== '' && efforts.some((tier) => String(tier.id) === selected)) {
        return { provider, model, reasoningEffort: selected as never }
      }
      const hasOff = efforts.some((tier) => String(tier.id) === 'off')
      return hasOff ? { provider, model, reasoningEffort: 'off' as never } : { provider, model }
    } catch {
      // No metadata to validate against: honour an explicit choice and omit the
      // field for the empty default.
      return selected === '' ? { provider, model } : { provider, model, reasoningEffort: selected as never }
    }
  }
}

/**
 * Project one stored template onto the wire shape declared by `TYPERT`.
 *
 * The store's model uses `readonly` members (including `readonly string[]`
 * tags) while the Typert result schema is mutable, so the tags array is
 * copied. Every field is always present: the gateway's JSON-safe boundary
 * check rejects any own key holding `undefined` even after the Zod parse
 * passes, so this projection must never emit one.
 */
function toTemplateWire(template: BetterInputTemplate): TemplateWire {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    content: template.content,
    tags: [...template.tags],
    createdAt: template.createdAt,
    updatedAt: template.updatedAt
  }
}

/**
 * The keys the user has explicitly diverged from the defaults on. The settings
 * page shows a "overridden" hint from this, so it is derived by comparing the
 * live document against {@link DEFAULT_SETTINGS}.
 */
function overriddenKeys(settings: BetterInputSettings): string[] {
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>
  const live = settings as unknown as Record<string, unknown>
  return Object.keys(defaults).filter((key) => live[key] !== defaults[key])
}

/** Collect one streamed LLM answer into text, capping its length. */
async function collectText(stream: AsyncIterable<StreamChunk>, maxCharacters: number, label: string): Promise<string> {
  let text = ''
  let sawDelta = false

  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') {
      text += chunk.text
      if (text.length > maxCharacters) throw new Error(`The dsh LLM ${label} response is too large`)
      sawDelta = true
      continue
    }

    if (chunk.type === 'finish' && (chunk.reason.kind === 'error' || chunk.reason.kind === 'aborted')) {
      throw new Error(`The dsh LLM route did not complete ${label}`)
    }

    if (!sawDelta && chunk.type === 'block-end' && chunk.block.type === 'text') {
      text += chunk.block.text
      if (text.length > maxCharacters) throw new Error(`The dsh LLM ${label} response is too large`)
    }
  }

  return text.trim()
}
