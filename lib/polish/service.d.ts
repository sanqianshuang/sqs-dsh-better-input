import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type BetterInputSettingsPatch, type BetterInputSettingsView, type PolishRoute, type ReasoningEffortInfo } from '../config.js';
import { type AboutInfo, type UpdateCheckResult } from '../about.js';
import type { TemplateInputWire, TemplateWire } from '../remote-contract.js';
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
    getAbout(): AboutInfo;
    checkForUpdate(signal: AbortSignal): Promise<UpdateCheckResult>;
    /**
     * Polish one transcript.
     *
     * The route and the reasoning effort are supplied by the caller rather than
     * read from the stored settings: the browser half resolves them from the
     * composer's current model (see `src/client/composer-model.ts`) and falls back
     * to the settings route when that is unreadable. An empty `effort` is the
     * plugin's "thinking off" default, not a missing value.
     */
    polish(transcript: string, provider: string, model: string, effort: string, signal: AbortSignal): Promise<string>;
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
    /** Optimize one prompt; see {@link polish} for why the effort travels with the call. */
    optimize(text: string, provider: string, model: string, context: string, effort: string, signal: AbortSignal): Promise<string>;
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
