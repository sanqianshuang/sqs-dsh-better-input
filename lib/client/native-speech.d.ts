/**
 * Native speech session: dsh's local recognizers with segment-level streaming.
 *
 * dsh's speech service transcribes one complete recording — its own README says
 * streaming recognition has no service method — so "text appears while you
 * speak" is emulated here: the recording is cut into segments (preferably at
 * silence boundaries), each segment is transcribed over the plugin's Remote and
 * its text is appended to the draft, and when the user stops, the whole
 * recording is transcribed once more to produce an authoritative transcript
 * before polishing runs on it.
 *
 * The two-pass design is what keeps the streamed preview cheap: a mis-split
 * segment can only make the *preview* worse, never the finished text.
 */
import { type BetterInputSettings } from '../config.js';
import { CaptureError } from './audio-capture.js';
/** How often the segment cutter inspects the recording. */
export declare const TICK_MS = 200;
export type NativeSpeechPhase = 'capturing' | 'finalizing';
/** What one {@link SilenceWatch} frame reported. */
export type SilenceReading = {
    /** True once any frame has been loud enough — the countdown arms on this. */
    readonly hasSpoken: boolean;
    /** Seconds of continuous quiet since the last sound. */
    readonly quietSeconds: number;
    /** Seconds left before the auto-stop, `null` while no countdown runs. */
    readonly remainingSeconds: number | null;
    /** Whether the quiet window has fully elapsed. */
    readonly elapsed: boolean;
};
/**
 * The silence auto-stop timer: "speak, then stop talking, and the recording
 * finishes by itself".
 *
 * Deliberately pure and free of Web Audio so the guard script can drive it:
 * the whole user-visible contract is here — the countdown never runs before the
 * first sound (`hasSpoken`), any new sound resets it to the full window, and it
 * cannot fire at all when the window is `0` (disabled).
 */
export declare class SilenceWatch {
    /** Quiet window in seconds; `0` disables the auto-stop. */
    private readonly limitSeconds;
    /** Frame length in seconds. */
    private readonly tickSeconds;
    private spoken;
    private quiet;
    constructor(
    /** Quiet window in seconds; `0` disables the auto-stop. */
    limitSeconds: number, 
    /** Frame length in seconds. */
    tickSeconds: number);
    observe(sounding: boolean): SilenceReading;
    /** Seconds left in the window, `null` while counting is not allowed. */
    remainingSeconds(): number | null;
}
/**
 * One 200 ms telemetry frame for the status bar: how long the microphone has
 * been open, the current input level (for the level meter) and — once speech
 * has been heard — how long is left before the silence auto-stop.
 */
export type SpeechTick = {
    readonly elapsedSeconds: number;
    /** Root-mean-square of the trailing window, ~0 while silent. */
    readonly level: number;
    /** Configured silence window in seconds, `0` when the auto-stop is off. */
    readonly autoStopSeconds: number;
    /** Seconds left before the auto-stop, `null` when no countdown is running. */
    readonly autoStopRemainingSeconds: number | null;
};
/** The shape this session needs from `remote.transcribeSpeech`. */
export type TranscribeOutcome = {
    readonly ok: true;
    readonly value: {
        readonly text: string;
    };
} | {
    readonly ok: false;
    readonly error: {
        readonly message: string;
    };
};
export type TranscribeCall = (audioBase64: string, language: string, signal: AbortSignal) => Promise<TranscribeOutcome>;
export type NativeSpeechSessionOptions = {
    /** SenseVoice language hint; empty means automatic detection. */
    language: string;
    /** Cut a preview segment once this many seconds have accumulated. */
    segmentSeconds: number;
    /** Stream segment transcripts into the draft while the user is still speaking. */
    streamingPreview: boolean;
    /**
     * Stop after this many seconds without speech once the user has spoken.
     * `0` disables it; the hard recording ceiling still applies either way.
     */
    autoStopSeconds: number;
    /** Plugin Remote call that performs one transcription on the Host. */
    transcribe: TranscribeCall;
    /** Growing preview text, called after every completed segment. */
    onPreview: (text: string) => void;
    /** Authoritative transcript after the recording stopped. */
    onEnd: (text: string) => void;
    /** Capture and transcription failures; the session decides whether to continue. */
    onError: (error: Error) => void;
    /** Phase changes, for the surrounding status UI. */
    onPhase?: (phase: NativeSpeechPhase) => void;
    /** Timer/level telemetry, every {@link TICK_MS}, for the status bar. */
    onTick?: (tick: SpeechTick) => void;
    /** Called just before the session stops itself on the silence timeout. */
    onAutoStop?: () => void;
};
/** Settings face this session reads; kept structural so tests need no defaults. */
export type SpeechSessionSettings = Pick<BetterInputSettings, 'language' | 'segmentSeconds' | 'streamingPreview' | 'autoStopSeconds'>;
export declare function sessionOptionsFor(settings: SpeechSessionSettings, transcribe: TranscribeCall, callbacks: Pick<NativeSpeechSessionOptions, 'onPreview' | 'onEnd' | 'onError' | 'onPhase' | 'onTick' | 'onAutoStop'>): NativeSpeechSessionOptions;
export declare class NativeSpeechSession {
    private readonly options;
    private readonly capture;
    private readonly segments;
    private timer;
    /** Seconds already submitted as preview segments. */
    private cursor;
    private speechSeen;
    /** Silence since the last cut, used by the segment cutter. */
    private silenceSeconds;
    /**
     * The auto-stop timer, replaced on every `start()`.
     *
     * Kept separate from `silenceSeconds` on purpose: cutting a segment resets
     * that one, and the countdown the user is watching must not jump back to the
     * full window every time a preview segment is cut.
     */
    private watch;
    /** Serialises transcriptions: the native worker is serial anyway. */
    private queue;
    private inFlight;
    private stopping;
    private aborted;
    private ended;
    constructor(options: NativeSpeechSessionOptions);
    get active(): boolean;
    /** Acquire the microphone and begin cutting preview segments. */
    start(): Promise<void>;
    /** Finish the recording: flush the tail, then transcribe the whole thing. */
    stop(): void;
    /** Discard everything: no callbacks, no transcript, microphone released. */
    abort(): void;
    private tick;
    /** One telemetry frame for the status bar (timer, level, countdown). */
    private publishTick;
    /** Submit `[cursor, endSeconds)` as one preview segment. */
    private cutSegment;
    private submit;
    private finish;
    private clearTimer;
}
/** Localized by the caller: capture failures carry a kind, others their message. */
export declare function captureFailureMessage(error: Error): {
    kind: CaptureError['kind'] | '';
    message: string;
};
