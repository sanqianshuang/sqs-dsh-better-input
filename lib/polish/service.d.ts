import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type BetterInputSettingsPatch, type BetterInputSettingsView, type PolishRoute, type ReasoningEffortInfo } from '../config.js';
import { type AboutInfo, type UpdateCheckResult } from '../about.js';
import type { TemplateInputWire, TemplateWire } from '../remote-contract.js';
import type { AssistRouteView } from '../remote-contract.js';
export declare class BetterInputPolishService extends TypertRemoteService {
    static inject: string[];
    private readonly settingsStore;
    private readonly templateStore;
    constructor(ctx: Context);
    /**
     * Read the current settings for the settings page.
     *
     * dsh 0.1.7 dropped the old `settings.register` API, so this plugin owns its
     * settings in a JSON document (see `settings/store.ts`). `available` is
     * therefore always true and `writable` reflects whether the document can be
     * written; `overridden` lists the keys the user has explicitly set.
     */
    getSettings(): Promise<BetterInputSettingsView>;
    /**
     * Read dsh's agent default model, or `null` when the optional service is not
     * composed.
     *
     * Optional services go through `ctx.get()` rather than `static inject` (an
     * inject would gate the whole Host half on a plugin that is not this one's
     * business), and a lookup that throws degrades to `null` for the same reason:
     * the browser half must keep working without it.
     */
    private agentDefaultRoute;
    updateSettings(patch: BetterInputSettingsPatch, signal: AbortSignal): Promise<BetterInputSettingsView>;
    listRoutes(): Promise<PolishRoute[]>;
    /**
     * Lazily resolve reasoning efforts for a single route. Only called once the
     * settings UI actually displays that model's effort selector — so we never
     * blast the adapter/provide with hundreds of upfront resolveModelInfo calls.
     * Returns `{ efforts: [] }` (no defaultEffort key) if the metadata is
     * unavailable (adapter offline, model unknown, etc.).
     */
    resolveModelEfforts(provider: string, model: string): Promise<{
        efforts: readonly ReasoningEffortInfo[];
        defaultEffort?: string;
    }>;
    /**
     * Resolve the route an assist will actually call, from the Host side.
     *
     * The browser cannot answer this reliably on its own. Its copy of the
     * composer's selection comes from the model-selection **client** plugin's
     * per-Session directory, whose store is only populated once that plugin's Host
     * model catalog is `ready`; until then it reports `current: null`, and any
     * client-side substitute is a guess about which model a request will be billed
     * to. The Host owns both inputs instead:
     *
     *   - the settings document (read here, not in the browser), and
     *   - the Session's durable selection, projected by the session controller as
     *     `modelSelection` — read from the projection **state**
     *     (`{ lastUsed, pending }`) with the same precedence the composer renders
     *     (`pending ?? lastUsed`); see {@link composerSelection}.
     *
     * `feature` is `'polish'` or `'optimize'`; anything else is rejected rather
     * than silently treated as one of them, so a typo cannot resolve a route for
     * the wrong feature.
     *
     * The thinking tier is the feature's own setting and is returned unchanged in
     * every branch — the model follows the composer, the effort never does (the
     * cost regression this plugin already fixed once).
     *
     * `source` is reported so the browser can render an honest follow row: a
     * `settings` source while "follow the composer" is on means the Host could not
     * read the Session's selection, which is worth showing instead of hiding. Both
     * assist buttons and the settings page consume it through the shared
     * `src/client/assist-route.ts` resolver, so what the row shows and what the
     * assist calls cannot disagree.
     *
     * Deliberately **not** validated against `ctx.llm.listModels()`: if the
     * composer sits on a route the Host no longer advertises, the call fails with
     * the provider's own message (see `finishFailure`) and the row still shows the
     * model the composer displays. Quietly substituting the settings route there
     * would re-create the original bug — a wrong-but-plausible model, invisibly.
     *
     * @param feature - which assist's settings and follow-flag to use.
     * @param sessionId - the composer Session; `''` when the caller has none.
     * @returns the resolved route plus which input won.
     */
    resolveAssistRoute(feature: string, sessionId: string): Promise<AssistRouteView>;
    /**
     * Read one Session's durable model selection, or `null` when unavailable.
     *
     * **Read the projection's *state*, and read the field names the state really
     * has.** dsh's session controller registers `modelSelection` with two
     * different schemas (`dsh-api-session-controller` →
     * `lib/types/model-selection-projection.js`): the *state* schema
     * `{ lastUsed, pending }` that `sessionProjections.stateOf()` returns, and the
     * *client-visible view* schema `{ lastUsed, next }` that `snapshot()` /
     * `faceOf()` return. `next = pending ?? lastUsed` exists only in the view, so
     * reading `stateOf(...).next` yields `undefined` on every composition, leaves
     * this branch dead, and silently falls back to the settings route — the exact
     * "polish ran on a different model than the composer showed" bug the Host-side
     * resolution was introduced to fix. This is asserted by
     * `npm run check:routes` (§6).
     *
     * Both services are optional (`ctx.get`, never `static inject`): a composition
     * without the session controller must still answer, just from the settings
     * route, rather than failing the whole assist.
     */
    private composerSelection;
    getAbout(): AboutInfo;
    checkForUpdate(signal: AbortSignal): Promise<UpdateCheckResult>;
    /**
     * Polish one transcript.
     *
     * The route and the reasoning effort are supplied by the caller. Since
     * `0.2.0-rc.2-sqs.3` the browser does not decide that route itself: when the
     * feature follows the composer it asks `resolveAssistRoute()` (the Host owns
     * both inputs), and it only falls back to the composer *snapshot* it renders
     * from when this RPC cannot answer — see `src/client/assist-route.ts`. An
     * empty `effort` is the plugin's "thinking off" default, not a missing value.
     *
     * `sessionId` is the composer Session this assist runs for. It is forwarded to
     * dsh's LLM runtime as `GenerateOptions.sessionId` so providers and `llm/stream`
     * middleware can attach the per-session transport metadata their route needs;
     * see {@link assistStreamOptions}.
     */
    polish(transcript: string, provider: string, model: string, effort: string, sessionId: string, signal: AbortSignal): Promise<string>;
    /**
     * List the saved prompt templates, newest first.
     *
     * `TemplateStore.list()` already sorts by `updatedAt` descending, so the
     * wire order is the store order. This is the RPC the settings section and
     * the `/` trigger source read from; without it the Typert gateway resolves
     * the descriptor but finds no callable method on this service and fails the
     * whole call with `gateway/method-unavailable` (see `toTemplateWire`).
     */
    templatesList(): Promise<{
        templates: TemplateWire[];
    }>;
    templatesSave(template: TemplateInputWire, signal: AbortSignal): Promise<{
        template: TemplateWire;
    }>;
    templatesRemove(id: string, signal: AbortSignal): Promise<{
        removed: boolean;
    }>;
    /** Optimize one prompt; see {@link polish} for why the effort and the Session travel with the call. */
    optimize(text: string, provider: string, model: string, context: string, effort: string, sessionId: string, signal: AbortSignal): Promise<string>;
    private completePolish;
    private completeOptimize;
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
    private resolveEffortConfig;
}
