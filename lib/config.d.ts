/**
 * Shared constants and helpers for sqs-dsh-better-input.
 *
 * Speech capture runs in the browser (16 kHz mono PCM16 WAV) and is transcribed
 * by dsh's own speech service — the local SenseVoice provider shipped in
 * `@deepseek-ai/dsh-experimental-voice-input-bundle`. The Host half owns the
 * AI polishing of the finished transcript, prompt optimization and the template
 * library.
 */
export declare const SETTINGS_NAMESPACE = "sqs-dsh-better-input";
/**
 * dsh's speech service only accepts canonical 16 kHz mono PCM16 WAV
 * (`@deepseek-ai/dsh-experimental-speech-to-text/wave`), so every constant the
 * browser needs to build a WAV and every limit the Host enforces is derived
 * from this sample rate.
 */
export declare const SPEECH_SAMPLE_RATE = 16000;
export declare const SPEECH_BYTES_PER_SECOND: number;
/**
 * Recording ceiling.
 *
 * dsh's experimental speech Remote defaults to `maxDurationSeconds: 120` and
 * `maxAudioBytes: 4 MiB`; 120 s of 16 kHz mono PCM16 is 3.84 MB, so the
 * duration is the binding limit. This plugin enforces the same ceiling itself,
 * because the audio reaches the native worker through our own Remote and never
 * passes the speech Remote's `validateWave` intake.
 */
export declare const SPEECH_MAX_RECORDING_SECONDS = 120;
export declare const SPEECH_MAX_AUDIO_BYTES: number;
/** Recording is capped so an abandoned session never holds the microphone forever. */
export declare const DEFAULT_MAX_RECORDING_SECONDS = 120;
/**
 * Language hints accepted by the local SenseVoice provider (`auto` is the
 * provider's own value; this plugin stores `''` for it, which is also what
 * `resolve()` treats as "use the configured default").
 */
export declare const SPEECH_LANGUAGE_HINTS: readonly ["zh", "en", "yue", "ja", "ko"];
export type SpeechLanguageHint = '' | (typeof SPEECH_LANGUAGE_HINTS)[number];
/**
 * Streaming preview segmentation.
 *
 * `streamingPreview` off means "one transcription after stop" (dsh's own
 * behaviour). On means segment-level pseudo-streaming: the browser cuts the
 * recording at silence boundaries or at `segmentSeconds`, transcribes each
 * segment, and streams the growing text into the draft — then one final pass
 * over the whole recording replaces the preview with an authoritative
 * transcript before polishing.
 */
export declare const DEFAULT_SEGMENT_SECONDS = 3;
export declare const MIN_SEGMENT_SECONDS = 1;
export declare const MAX_SEGMENT_SECONDS = 10;
/**
 * Silence-triggered auto-stop.
 *
 * Once the user has actually spoken, the status bar counts down this window
 * while the microphone hears nothing and stops the recording when it reaches
 * zero — "speak, pause, the input finishes by itself". `0` disables it and
 * leaves only the hard `maxRecordingSeconds` ceiling. The countdown never runs
 * before the first speech, so a mis-clicked microphone is still governed by the
 * ceiling alone rather than being cancelled after a few seconds of quiet.
 */
export declare const DEFAULT_AUTO_STOP_SECONDS = 10;
export declare const MIN_AUTO_STOP_SECONDS = 3;
export declare const MAX_AUTO_STOP_SECONDS = 120;
export declare const MAX_POLISH_PROMPT_LENGTH = 4000;
export declare const MAX_OPTIMIZE_PROMPT_LENGTH = 4000;
export declare const MAX_TRANSCRIPT_CHARACTERS = 12000;
export declare const MAX_OPTIMIZE_CHARACTERS = 12000;
export declare const MAX_POLISHED_CHARACTERS = 24000;
export declare const MAX_OPTIMIZED_CHARACTERS = 24000;
export declare const POLISH_TIMEOUT_MS = 20000;
export declare const OPTIMIZE_TIMEOUT_MS = 20000;
export interface BetterInputSettings {
    /**
     * Recognition language hint, `''` for automatic detection. Stored as a
     * SenseVoice hint rather than a BCP-47 tag — see `normalizeSpeechLanguage`.
     */
    language: string;
    /** Recording limit in seconds. */
    maxRecordingSeconds: number;
    /**
     * Transcribe the recording in segments while the user is still speaking, so
     * text streams into the draft. One final pass over the whole recording then
     * replaces the preview before polishing.
     */
    streamingPreview: boolean;
    /** Preferred segment length for streaming preview, in seconds. */
    segmentSeconds: number;
    /**
     * Stop the recording after this many seconds without speech, counted only
     * once the microphone has heard something. `0` disables the auto-stop.
     */
    autoStopSeconds: number;
    /** Enable Host LLM polishing after the transcript lands in the draft. */
    polishingEnabled: boolean;
    /** dsh polish provider id (a route already registered in dsh). */
    polishProvider: string;
    /** dsh polish model id. */
    polishModel: string;
    /** Selected reasoning effort id for polish, empty uses the adapter's default (usually the lightest). */
    polishReasoningEffort: string;
    /** Custom polish system prompt, empty for the built-in one. */
    polishPrompt: string;
    /** Enable prompt optimization through the Host LLM. */
    optimizeEnabled: boolean;
    /** dsh optimize provider id (reuses the same route pool as polish). */
    optimizeProvider: string;
    /** dsh optimize model id. */
    optimizeModel: string;
    /** Selected reasoning effort id for optimize, empty uses the adapter's default (usually the lightest). */
    optimizeReasoningEffort: string;
    /** Custom optimize system prompt, empty for the built-in one. */
    optimizePrompt: string;
    /** Number of recent conversation turns to include as context for optimization. 0 disables context. */
    contextTurns: number;
}
/**
 * Out-of-the-box defaults: every toggle ON so new users get the full
 * experience immediately; reasoning effort left empty, which the Host
 * translates to "thinking off" (the model's `off` tier when it exposes
 * one, otherwise the adapter's own default).
 * Provider/model stay empty and get auto-filled on first settings page
 * load via SettingsController (first route returned by listRoutes).
 */
export declare const DEFAULT_SETTINGS: BetterInputSettings;
export type BetterInputSettingsPatch = Partial<BetterInputSettings>;
/** One selectable reasoning effort tier for a specific model route. */
export interface ReasoningEffortInfo {
    /** Stable id passed to `LlmCallConfig.reasoningEffort`. */
    readonly id: string;
    /** Display name shown in the settings dropdown. */
    readonly name: string;
    /** Optional longer description shown in a tooltip. */
    readonly description?: string;
}
/** A usable (provider, model) pair returned by dsh's LLM runtime, plus any
 *  reasoning-effort tiers the model reports as selectable. The efforts
 *  list is empty when the adapter / model does not expose thinking
 *  controls — in that case the settings dropdown is hidden entirely.
 *  `defaultEffort` is the adapter-configured baseline (generally the
 *  lightest tier); we use it as the placeholder label in the UI and as
 *  the fallback when the stored effort string is empty.
 */
export interface PolishRoute {
    readonly provider: string;
    readonly providerName: string;
    readonly model: string;
    readonly modelName: string;
    readonly reasoningEfforts: readonly ReasoningEffortInfo[];
    readonly defaultReasoningEffort?: string;
}
export interface BetterInputSettingsView {
    available: boolean;
    writable: boolean;
    settings: BetterInputSettings;
    overridden: string[];
    /** The built-in polish system prompt, shown in the settings page. */
    defaultPolishPrompt: string;
    /** The built-in optimize system prompt, shown in the settings page. */
    defaultOptimizePrompt: string;
}
/**
 * One registered recognizer as the settings page needs it.
 *
 * Mirrors the fields of dsh's `SpeechProviderView` that are safe to render;
 * the preparation phase is flattened to a string so the wire stays JSON-simple.
 */
export interface SpeechProviderStatus {
    readonly id: string;
    readonly name: string;
    readonly location: string;
    readonly languages: readonly string[];
    /** `unprepared` | `ready` | `standby` | `cancelled` | `checking` | `loading` | `waking` | `cancelling` | `downloading` | `failed`. */
    readonly preparation: string;
    /** Human-readable progress or failure detail, empty when not applicable. */
    readonly detail: string;
}
/** Result of reading dsh's speech service through the plugin's own Remote. */
export interface SpeechStatusView {
    /** Whether dsh's speech service itself is part of the running composition. */
    service: boolean;
    /**
     * Whether a recognizer is usable right now.
     *
     * Weaker than `service`: the local provider inspects its model cache during
     * activation, so the roster can be empty for a moment after Host start.
     */
    available: boolean;
    providers: readonly SpeechProviderStatus[];
    /** Currently selected recognizer and language, when a selection exists. */
    selection: {
        providerId: string;
        language: string;
    } | null;
    /** Ceiling this plugin enforces on one recording, in seconds. */
    maxRecordingSeconds: number;
    /** Why the service or its recognizers are unavailable, empty when available. */
    detail: string;
}
/** One transcription result as it crosses the plugin's own Remote. */
export interface SpeechTranscriptView {
    readonly text: string;
    readonly audioSeconds: number;
    readonly inferenceSeconds: number;
}
/**
 * Narrow a stored language value onto a hint the local provider accepts.
 *
 * Settings written before this plugin used dsh's speech service hold BCP-47
 * tags (`zh-CN`, `en-US`, …) because that is what the browser Web Speech API
 * wanted. `speechToText.resolve()` rejects any language a provider does not
 * advertise, so an unmapped value would make every recording fail — unknown
 * input therefore degrades to automatic detection instead of throwing.
 */
export declare function normalizeSpeechLanguage(stored: string): SpeechLanguageHint;
export declare function isValidRecordingLimit(value: number): boolean;
export declare function isValidSegmentSeconds(value: number): boolean;
export declare function isValidContextTurns(value: number): boolean;
/** `0` means "no silence auto-stop"; anything else must be a usable window. */
export declare function isValidAutoStopSeconds(value: number): boolean;
export declare function validateSettings(settings: BetterInputSettings): void;
/** Resolve the effective recording cap from stored settings. */
export declare function effectiveRecordingSeconds(settings: Pick<BetterInputSettings, 'maxRecordingSeconds'>): number;
/** Resolve the effective streaming segment length from stored settings. */
export declare function effectiveSegmentSeconds(settings: Pick<BetterInputSettings, 'segmentSeconds'>): number;
/** Resolve the effective silence auto-stop window; `0` means disabled. */
export declare function effectiveAutoStopSeconds(settings: Pick<BetterInputSettings, 'autoStopSeconds'>): number;
