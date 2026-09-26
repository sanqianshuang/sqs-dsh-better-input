import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type BetterInputSettingsPatch, type BetterInputSettingsView, type PolishRoute, type ReasoningEffortInfo } from '../config.js';
import { type AboutInfo, type UpdateCheckResult } from '../about.js';
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
    polish(transcript: string, provider: string, model: string, signal: AbortSignal): Promise<string>;
    optimize(text: string, provider: string, model: string, context: string, signal: AbortSignal): Promise<string>;
    private completePolish;
    private completeOptimize;
    /**
     * Resolve the effective reasoning-effort wire config for one route. An
     * explicit stored selection is forwarded as-is. The empty default means
     * "thinking off": when the model advertises an `off` tier we send it, and
     * otherwise we omit the field so the adapter's own default applies.
     */
    private resolveEffortConfig;
}
