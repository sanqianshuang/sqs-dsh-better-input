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
    /**
     * Polish with the model the composer currently has selected instead of the
     * stored route below. The stored route stays as the fallback for compositions
     * where the composer's selection cannot be read.
     *
     * Only the model follows; {@link BetterInputSettings.polishReasoningEffort}
     * stays authoritative for thinking.
     */
    polishFollowInputModel: boolean;
    /** dsh polish provider id (a route already registered in dsh). */
    polishProvider: string;
    /** dsh polish model id. */
    polishModel: string;
    /**
     * Thinking tier for polish, independent of the model that runs it.
     *
     * Empty means the plugin's own default, which is **thinking off**: the model's
     * `off` tier when it advertises one, otherwise no `reasoningEffort` field at
     * all so the adapter's own default applies. This is a separate setting on
     * purpose — it does not follow the composer's effort even while the model
     * follows the composer (see {@link resolveInputModelRoute}).
     */
    polishReasoningEffort: string;
    /** Custom polish system prompt, empty for the built-in one. */
    polishPrompt: string;
    /**
     * Optimize with the model the composer currently has selected; see
     * {@link BetterInputSettings.polishFollowInputModel}.
     *
     * Prompt optimization has **no** enable switch of its own: the ✨ button is a
     * core capability and an on/off toggle would only add a way to hide it. An
     * `optimizeEnabled` key used to sit here and was never read by anything — a
     * setting that saves, round-trips and changes nothing (removed in
     * `0.2.0-rc.2-sqs.4`).
     */
    optimizeFollowInputModel: boolean;
    /** dsh optimize provider id (reuses the same route pool as polish). */
    optimizeProvider: string;
    /** dsh optimize model id. */
    optimizeModel: string;
    /** Thinking tier for optimize; see {@link BetterInputSettings.polishReasoningEffort}. */
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
 * Both features follow the composer's model by default — the model the user
 * picked in the input box is the one they expect an assist to run on.
 * Provider/model stay empty and are auto-filled on the first settings page
 * load by `SettingsController` from **dsh's own agent default model**, never
 * from `listRoutes()[0]` — see {@link resolveAutoRoute}.
 *
 * Every key here must also exist in `betterInputSettingsSchema` (and be
 * patchable through `betterInputSettingsPatchSchema`); the gateway runs those
 * schemas over the wire and a zod object **strips** what it does not declare,
 * so a key missing there is silently dropped on the way in. Guard:
 * `npm run check:routes`.
 */
export declare const DEFAULT_SETTINGS: BetterInputSettings;
export type BetterInputSettingsPatch = Partial<BetterInputSettings>;
/**
 * One route the composer's model seat is currently on, as the browser half
 * reads it from dsh's per-session model directory.
 */
export interface ComposerModelRoute {
    readonly provider: string;
    readonly model: string;
}
/** The route an assist feature actually calls, after following/fallback. */
export interface EffectiveModelRoute {
    readonly provider: string;
    readonly model: string;
    /** Effort to forward; `''` means "let the Host apply the plugin's default". */
    readonly reasoningEffort: string;
}
/**
 * Resolve the route an assist feature (polish / optimize) must call.
 *
 * `follow` is the feature's `*FollowInputModel` setting. When it is on and the
 * composer's current selection is readable, that selection wins — the model the
 * user sees in the input box is the one the assist runs on. Otherwise the route
 * configured on the settings page is used, which is also the fallback for a
 * composition where the model-directory service is absent or the session has no
 * selection yet.
 *
 * **Only the model follows.** The reasoning effort always comes from the
 * feature's own setting, never from the composer.
 *
 * An earlier revision carried the composer's effort along with its model. That
 * looked consistent — the input box shows "model · effort" as one unit — but it
 * silently raised the cost of every assist: the moment the user turned thinking
 * up on a conversation, polishing and prompt optimization started paying for
 * that same tier on *every* recording and every ✨ click, with no control of
 * their own to turn it back down. The two are different decisions and now have
 * different owners: the composer's effort belongs to the conversation, an
 * assist's effort belongs to the assist.
 *
 * `''` effort is meaningful, not a gap: it is the plugin's own "thinking off"
 * default, so it must survive the trip to the Host.
 *
 * @returns the route to call, or `null` when neither side names one — the
 *   callers turn that into "no model configured".
 */
export declare function resolveInputModelRoute(follow: boolean, composer: ComposerModelRoute | null, configured: {
    readonly provider: string;
    readonly model: string;
    readonly reasoningEffort: string;
}): EffectiveModelRoute;
/**
 * Pick the route first-launch auto-fill should store as the fallback.
 *
 * The fallback is what an assist calls when the composer's selection cannot be
 * read, so it must be a model the *user* configured — and the obvious candidate,
 * `listProviders()[0]`, is not that. `listProviders()` returns **registration
 * order**: the base bundle activates `llm-deepseek-api-key` before pi-ai's
 * configured providers, so the first entry is always `deepseek-official`. An
 * earlier revision stored exactly that, which is why a user whose own route was
 * a relay saw the plugin "pinned to the official key" and could not tell why:
 * the pinned value is invisible while the rows follow the composer, and it only
 * surfaces when the composer read fails.
 *
 * dsh's agent default model is the durable answer instead, and the returned
 * route is validated against the live route list so the settings dropdown can
 * actually display it. `routes[0]` remains the last resort, because storing
 * *some* valid route beats storing none for a composition with no default-model
 * service.
 *
 * @param defaultRoute - dsh's agent default model, `null` when unavailable.
 * @param routes - every route the Host advertised, in Host order.
 * @returns the route to store, or `null` when there is nothing to store.
 */
export declare function resolveAutoRoute(defaultRoute: ComposerModelRoute | null, routes: readonly {
    readonly provider: string;
    readonly model: string;
}[]): {
    readonly provider: string;
    readonly model: string;
} | null;
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
    /**
     * dsh's own agent default model, or `null` when the optional
     * `agentDefaultModel` service is not part of the composition.
     *
     * This is the durable answer to "which model did the user configure as
     * theirs", and it is what first-launch route auto-fill must use — see
     * {@link resolveAutoRoute}.
     */
    defaultRoute: ComposerModelRoute | null;
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
