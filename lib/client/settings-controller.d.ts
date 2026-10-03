import { type BetterInputSettingsPatch, type BetterInputSettingsView, type ComposerModelRoute, type EffectiveModelRoute, type PolishRoute, type ReasoningEffortInfo } from '../config.js';
import type { AboutInfoWire, SpeechStatusWire, UpdateCheckResultWire } from '../remote-contract.js';
import type { BetterInputRemote } from '../remote.js';
import { type AssistFeature, type AssistRouteSource } from './assist-route.js';
export type SettingsStatus = 'loading' | 'ready' | 'error';
export type SettingsSnapshot = {
    readonly status: SettingsStatus;
    readonly view: BetterInputSettingsView;
    readonly detail: string;
};
export type RoutesSnapshot = {
    readonly status: 'loading' | 'ready' | 'error';
    readonly routes: readonly PolishRoute[];
    readonly detail: string;
};
/** Keyed by `${provider}\u0000${model}` — undefined effort = loading requested,
 *  null effort = load failed, object = resolved efforts. */
export type EffortsSnapshot = Readonly<Record<string, EffortsEntry>>;
export type EffortsEntry = {
    readonly status: 'loading' | 'ready' | 'error';
    readonly efforts: readonly ReasoningEffortInfo[];
    readonly defaultEffort?: string;
    readonly detail: string;
};
export type AboutSnapshot = {
    readonly status: 'loading' | 'ready' | 'error';
    readonly about: AboutInfoWire;
    readonly detail: string;
};
export type UpdateSnapshot = {
    readonly status: 'idle' | 'loading' | 'ready' | 'error';
    readonly update: UpdateCheckResultWire | null;
    readonly detail: string;
};
export type SpeechSnapshot = {
    readonly status: 'loading' | 'ready' | 'error';
    readonly view: SpeechStatusWire;
    /** True while a prepare request is in flight, so the button can be disabled. */
    readonly preparing: boolean;
    readonly detail: string;
};
/**
 * What the Host resolved one assist's route to, for the settings page's follow
 * row. `source` is the honest part: while "follow the composer" is on, an answer
 * of `settings` means the Host could not read the Session's selection, and the
 * row must say so instead of claiming the follow worked — see
 * `src/client/assist-route.ts`.
 */
export type AssistRouteSnapshot = {
    readonly status: 'idle' | 'loading' | 'ready';
    readonly route: EffectiveModelRoute | null;
    readonly source: AssistRouteSource;
};
type Listener = () => void;
/**
 * Settings read/write controller for the settings page and the microphone
 * flow. Owns the remote calls and a simple external store so both the page
 * and the voice button observe the same values. Also caches per-model
 * reasoning-effort metadata loaded lazily through resolveModelEfforts so
 * opening the effort dropdown never double-fetches across renders.
 */
export declare class SettingsController {
    private readonly remote;
    private settingsSnapshot;
    private routesSnapshot;
    private effortsSnapshot;
    private aboutSnapshot;
    private updateSnapshot;
    private speechSnapshot;
    private readonly assistRoutes;
    /** Monotonic per feature, so a slow answer cannot overwrite a newer one. */
    private readonly assistRouteRequest;
    private assistRoutesSnapshot;
    private readonly listeners;
    private disposed;
    constructor(remote: BetterInputRemote);
    readonly getSettingsSnapshot: () => SettingsSnapshot;
    readonly getRoutesSnapshot: () => RoutesSnapshot;
    readonly getEffortsSnapshot: () => EffortsSnapshot;
    readonly getAboutSnapshot: () => AboutSnapshot;
    readonly getUpdateSnapshot: () => UpdateSnapshot;
    readonly getSpeechSnapshot: () => SpeechSnapshot;
    readonly getAssistRoutesSnapshot: () => Readonly<Record<string, AssistRouteSnapshot>>;
    readonly subscribe: (listener: Listener) => (() => void);
    refreshSettings(): Promise<void>;
    /**
     * Read dsh's speech service status through the plugin's Remote.
     *
     * Never fails the page: an unavailable or provider-less speech service is a
     * legitimate state (`available: false`), so the page explains it instead of
     * showing a request error.
     */
    refreshSpeechStatus(): Promise<void>;
    /** Start (or join) dsh's provider-owned preparation task, then re-read status. */
    prepareSpeech(providerId: string): Promise<boolean>;
    refreshRoutes(): Promise<void>;
    private readonly autoPopulateDefaultRoutesIfNeeded;
    update(patch: BetterInputSettingsPatch): Promise<boolean>;
    /**
     * Lazily fetch reasoning efforts for a route. Results are cached in the
     * controller so changing the effort dropdown back and forth doesn't
     * re-trigger remote calls. Returns a snapshot entry immediately — the
     * caller subscribes via `useEffortsSnapshot` to re-render when the data
     * lands.
     */
    ensureEffortsFor(provider: string, model: string): Promise<void>;
    /**
     * Resolve one assist's route the same way its button will, for the follow row.
     *
     * Deliberately uncached and always re-asked: the answer depends on the
     * composer's selection, on the Session, and on two settings keys, and a stale
     * row is precisely the failure this exists to prevent. A per-feature request
     * sequence drops an out-of-order answer (the user can flip the toggle faster
     * than the RPC settles).
     *
     * @param feature - `'polish'` or `'optimize'`.
     * @param sessionId - the Session the composer is showing; `''` when unknown.
     * @param composer - the composer's selection as the browser sees it.
     */
    refreshAssistRoute(feature: AssistFeature, sessionId: string, composer: ComposerModelRoute | null): Promise<void>;
    private publishAssistRoute;
    refreshAbout(): Promise<void>;
    checkForUpdate(): Promise<void>;
    dispose(): void;
    private emit;
}
export declare function useSettingsSnapshot(controller: SettingsController): SettingsSnapshot;
export declare function useRoutesSnapshot(controller: SettingsController): RoutesSnapshot;
export declare function useEffortsSnapshot(controller: SettingsController): EffortsSnapshot;
export declare function useAboutSnapshot(controller: SettingsController): AboutSnapshot;
export declare function useUpdateSnapshot(controller: SettingsController): UpdateSnapshot;
export declare function useSpeechSnapshot(controller: SettingsController): SpeechSnapshot;
/** Per-feature Host-resolved assist routes, keyed by `'polish'` / `'optimize'`. */
export declare function useAssistRoutesSnapshot(controller: SettingsController): Readonly<Record<string, AssistRouteSnapshot>>;
export {};
