export type VoiceInputState = 'idle' | 'starting' | 'recording' | 'transcribing' | 'polishing' | 'error' | 'polish-error';
export type VoiceInputSessionSnapshot = {
    readonly state: VoiceInputState;
    readonly detail: string;
};
type Listener = () => void;
type StopListener = () => void;
export declare const VOICE_ERROR_DISMISS_MS = 2600;
/**
 * Live recording telemetry for the status bar: elapsed time, input level and
 * the silence auto-stop countdown.
 *
 * Deliberately a **separate** store from the session state: it updates five
 * times a second while recording, and the microphone button (which also
 * subscribes to the session) has no use for it. `getSnapshot` returns a cached
 * object so an unchanged frame does not re-render anything — required by
 * `useSyncExternalStore`.
 */
export type VoiceMeterSnapshot = {
    readonly elapsedSeconds: number;
    readonly level: number;
    /** Configured silence window in seconds, `0` when the auto-stop is off. */
    readonly autoStopSeconds: number;
    /** Seconds left before the auto-stop, `null` when no countdown is running. */
    readonly autoStopRemainingSeconds: number | null;
};
export declare const EMPTY_VOICE_METER: VoiceMeterSnapshot;
export declare class VoiceMeter {
    private snapshot;
    private readonly listeners;
    readonly getSnapshot: () => VoiceMeterSnapshot;
    readonly subscribe: (listener: Listener) => (() => void);
    publish(next: VoiceMeterSnapshot): void;
    reset(): void;
    dispose(): void;
}
/**
 * Shared voice-input state for one session, written from scratch for
 * sqs-dsh-better-input. The microphone button and the recognition bar both
 * subscribe; the bar can request stop/cancel through the same instance.
 */
export declare class VoiceInputSession {
    /** Recording telemetry, subscribed to only by the recognition bar. */
    readonly meter: VoiceMeter;
    private snapshot;
    private readonly listeners;
    private readonly stopListeners;
    private readonly cancelListeners;
    private epoch;
    private errorTimer;
    captureEpoch(): number;
    isCurrentEpoch(epoch: number): boolean;
    readonly getSnapshot: () => VoiceInputSessionSnapshot;
    readonly subscribe: (listener: Listener) => (() => void);
    readonly onStopRequested: (listener: StopListener) => (() => void);
    readonly onCancelRequested: (listener: StopListener) => (() => void);
    setState(state: VoiceInputState, detail?: string): void;
    requestStop(): void;
    requestCancel(): void;
    dispose(): void;
    private clearErrorTimer;
    private emit;
}
export declare function useVoiceInputSession(session: VoiceInputSession): VoiceInputSessionSnapshot;
/** Subscribe to the live recording telemetry of one session. */
export declare function useVoiceMeter(session: VoiceInputSession): VoiceMeterSnapshot;
export {};
