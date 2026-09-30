/**
 * Browser microphone capture for the native dsh recognizers.
 *
 * dsh's speech service accepts exactly one audio format: a canonical 16 kHz
 * mono PCM16 WAV (`@deepseek-ai/dsh-experimental-speech-to-text/wave`). This
 * module owns that contract on the browser side — capture, resample, encode —
 * and keeps the recorded samples so a finished recording can still be sliced
 * (preview segments) or re-encoded (the final authoritative pass) after the
 * microphone itself has been released.
 *
 * The previous implementation used the Web Speech API, which streamed results
 * out of the browser and never owned the audio. Recognising locally means we do
 * own the audio, hence the explicit format handling here.
 */
/** Why capture could not start, for localized messaging by the caller. */
export type CaptureFailureKind = 'unavailable' | 'permission' | 'interrupted';
/** Capture failure whose `kind` the caller maps onto a localized string. */
export declare class CaptureError extends Error {
    readonly kind: CaptureFailureKind;
    constructor(kind: CaptureFailureKind, message?: string);
}
/**
 * One microphone acquisition.
 *
 * Samples are retained at the rate the AudioContext actually runs at and are
 * converted to 16 kHz on demand, so a browser that ignores the requested
 * sample rate still produces a valid recording.
 */
export declare class MicrophoneCapture {
    private stream;
    private context;
    private source;
    private processor;
    private sink;
    private samples;
    private frames;
    private captureRate;
    private released;
    private disposed;
    /** Acquire the microphone and start buffering samples. */
    start(): Promise<void>;
    /** Seconds captured so far, in capture-rate terms. */
    secondsRecorded(): number;
    /** Root-mean-square level of the trailing window, 0 when idle. */
    level(windowSeconds?: number): number;
    /** Largest absolute sample in a range, used to skip silent segments. */
    peak(fromSeconds: number, toSeconds: number): number;
    /** Copy a capture-time range as 16 kHz mono samples. */
    slice(fromSeconds: number, toSeconds: number): Float32Array;
    /**
     * Release the microphone and the audio graph, keeping the samples.
     *
     * Called as soon as the user stops speaking so the browser indicator goes
     * away while the final transcription is still running.
     */
    release(): Promise<void>;
    /** Release the microphone and drop the buffered samples. */
    dispose(): Promise<void>;
    private collect;
    private ensure;
    private range;
}
/** Whether this browser can capture at all (secure context + Web Audio). */
export declare function isCaptureSupported(): boolean;
/**
 * Encode 16 kHz mono samples as the canonical PCM16 WAV the Host validates.
 *
 * Field for field: RIFF/WAVE/`fmt `/16/PCM=1/mono/16000/byteRate 32000/
 * blockAlign 2/bits 16/`data`, RIFF size = length - 8, data size =
 * length - 44, an even PCM length, and at least one sample.
 */
export declare function encodeWave(samples: Float32Array): Uint8Array;
/** Base64 for the JSON Remote carrier, chunked to avoid argument-count limits. */
export declare function audioBase64(bytes: Uint8Array): string;
/** Linear resampling; adequate for a fallback path off the 16 kHz happy path. */
export declare function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array;
