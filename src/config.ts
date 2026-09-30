/**
 * Shared constants and helpers for sqs-dsh-better-input.
 *
 * Speech capture runs in the browser (16 kHz mono PCM16 WAV) and is transcribed
 * by dsh's own speech service — the local SenseVoice provider shipped in
 * `@deepseek-ai/dsh-experimental-voice-input-bundle`. The Host half owns the
 * AI polishing of the finished transcript, prompt optimization and the template
 * library.
 */

export const SETTINGS_NAMESPACE = 'sqs-dsh-better-input'

/**
 * dsh's speech service only accepts canonical 16 kHz mono PCM16 WAV
 * (`@deepseek-ai/dsh-experimental-speech-to-text/wave`), so every constant the
 * browser needs to build a WAV and every limit the Host enforces is derived
 * from this sample rate.
 */
export const SPEECH_SAMPLE_RATE = 16000
export const SPEECH_BYTES_PER_SECOND = SPEECH_SAMPLE_RATE * 2

/**
 * Recording ceiling.
 *
 * dsh's experimental speech Remote defaults to `maxDurationSeconds: 120` and
 * `maxAudioBytes: 4 MiB`; 120 s of 16 kHz mono PCM16 is 3.84 MB, so the
 * duration is the binding limit. This plugin enforces the same ceiling itself,
 * because the audio reaches the native worker through our own Remote and never
 * passes the speech Remote's `validateWave` intake.
 */
export const SPEECH_MAX_RECORDING_SECONDS = 120
export const SPEECH_MAX_AUDIO_BYTES = SPEECH_MAX_RECORDING_SECONDS * SPEECH_BYTES_PER_SECOND + 44

/** Recording is capped so an abandoned session never holds the microphone forever. */
export const DEFAULT_MAX_RECORDING_SECONDS = SPEECH_MAX_RECORDING_SECONDS

/**
 * Language hints accepted by the local SenseVoice provider (`auto` is the
 * provider's own value; this plugin stores `''` for it, which is also what
 * `resolve()` treats as "use the configured default").
 */
export const SPEECH_LANGUAGE_HINTS = ['zh', 'en', 'yue', 'ja', 'ko'] as const
export type SpeechLanguageHint = '' | (typeof SPEECH_LANGUAGE_HINTS)[number]

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
export const DEFAULT_SEGMENT_SECONDS = 3
export const MIN_SEGMENT_SECONDS = 1
export const MAX_SEGMENT_SECONDS = 10

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
export const DEFAULT_AUTO_STOP_SECONDS = 10
export const MIN_AUTO_STOP_SECONDS = 3
export const MAX_AUTO_STOP_SECONDS = 120

export const MAX_POLISH_PROMPT_LENGTH = 4000
export const MAX_OPTIMIZE_PROMPT_LENGTH = 4000
export const MAX_TRANSCRIPT_CHARACTERS = 12_000
export const MAX_OPTIMIZE_CHARACTERS = 12_000
export const MAX_POLISHED_CHARACTERS = 24_000
export const MAX_OPTIMIZED_CHARACTERS = 24_000
export const POLISH_TIMEOUT_MS = 20_000
export const OPTIMIZE_TIMEOUT_MS = 20_000

export interface BetterInputSettings {
  /**
   * Recognition language hint, `''` for automatic detection. Stored as a
   * SenseVoice hint rather than a BCP-47 tag — see `normalizeSpeechLanguage`.
   */
  language: string
  /** Recording limit in seconds. */
  maxRecordingSeconds: number
  /**
   * Transcribe the recording in segments while the user is still speaking, so
   * text streams into the draft. One final pass over the whole recording then
   * replaces the preview before polishing.
   */
  streamingPreview: boolean
  /** Preferred segment length for streaming preview, in seconds. */
  segmentSeconds: number
  /**
   * Stop the recording after this many seconds without speech, counted only
   * once the microphone has heard something. `0` disables the auto-stop.
   */
  autoStopSeconds: number
  /** Enable Host LLM polishing after the transcript lands in the draft. */
  polishingEnabled: boolean
  /** dsh polish provider id (a route already registered in dsh). */
  polishProvider: string
  /** dsh polish model id. */
  polishModel: string
  /** Selected reasoning effort id for polish, empty uses the adapter's default (usually the lightest). */
  polishReasoningEffort: string
  /** Custom polish system prompt, empty for the built-in one. */
  polishPrompt: string
  /** Enable prompt optimization through the Host LLM. */
  optimizeEnabled: boolean
  /** dsh optimize provider id (reuses the same route pool as polish). */
  optimizeProvider: string
  /** dsh optimize model id. */
  optimizeModel: string
  /** Selected reasoning effort id for optimize, empty uses the adapter's default (usually the lightest). */
  optimizeReasoningEffort: string
  /** Custom optimize system prompt, empty for the built-in one. */
  optimizePrompt: string
  /** Number of recent conversation turns to include as context for optimization. 0 disables context. */
  contextTurns: number
}

/**
 * Out-of-the-box defaults: every toggle ON so new users get the full
 * experience immediately; reasoning effort left empty, which the Host
 * translates to "thinking off" (the model's `off` tier when it exposes
 * one, otherwise the adapter's own default).
 * Provider/model stay empty and get auto-filled on first settings page
 * load via SettingsController (first route returned by listRoutes).
 */
export const DEFAULT_SETTINGS: BetterInputSettings = Object.freeze({
  language: '',
  maxRecordingSeconds: DEFAULT_MAX_RECORDING_SECONDS,
  streamingPreview: true,
  segmentSeconds: DEFAULT_SEGMENT_SECONDS,
  autoStopSeconds: DEFAULT_AUTO_STOP_SECONDS,
  polishingEnabled: true,
  polishProvider: '',
  polishModel: '',
  polishReasoningEffort: '',
  polishPrompt: '',
  optimizeEnabled: true,
  optimizeProvider: '',
  optimizeModel: '',
  optimizeReasoningEffort: '',
  optimizePrompt: '',
  contextTurns: 3,
})

export type BetterInputSettingsPatch = Partial<BetterInputSettings>

/** One selectable reasoning effort tier for a specific model route. */
export interface ReasoningEffortInfo {
  /** Stable id passed to `LlmCallConfig.reasoningEffort`. */
  readonly id: string
  /** Display name shown in the settings dropdown. */
  readonly name: string
  /** Optional longer description shown in a tooltip. */
  readonly description?: string
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
  readonly provider: string
  readonly providerName: string
  readonly model: string
  readonly modelName: string
  readonly reasoningEfforts: readonly ReasoningEffortInfo[]
  readonly defaultReasoningEffort?: string
}

export interface BetterInputSettingsView {
  available: boolean
  writable: boolean
  settings: BetterInputSettings
  overridden: string[]
  /** The built-in polish system prompt, shown in the settings page. */
  defaultPolishPrompt: string
  /** The built-in optimize system prompt, shown in the settings page. */
  defaultOptimizePrompt: string
}

/**
 * One registered recognizer as the settings page needs it.
 *
 * Mirrors the fields of dsh's `SpeechProviderView` that are safe to render;
 * the preparation phase is flattened to a string so the wire stays JSON-simple.
 */
export interface SpeechProviderStatus {
  readonly id: string
  readonly name: string
  readonly location: string
  readonly languages: readonly string[]
  /** `unprepared` | `ready` | `standby` | `cancelled` | `checking` | `loading` | `waking` | `cancelling` | `downloading` | `failed`. */
  readonly preparation: string
  /** Human-readable progress or failure detail, empty when not applicable. */
  readonly detail: string
}

/** Result of reading dsh's speech service through the plugin's own Remote. */
export interface SpeechStatusView {
  /** Whether dsh's speech service itself is part of the running composition. */
  service: boolean
  /**
   * Whether a recognizer is usable right now.
   *
   * Weaker than `service`: the local provider inspects its model cache during
   * activation, so the roster can be empty for a moment after Host start.
   */
  available: boolean
  providers: readonly SpeechProviderStatus[]
  /** Currently selected recognizer and language, when a selection exists. */
  selection: { providerId: string; language: string } | null
  /** Ceiling this plugin enforces on one recording, in seconds. */
  maxRecordingSeconds: number
  /** Why the service or its recognizers are unavailable, empty when available. */
  detail: string
}

/** One transcription result as it crosses the plugin's own Remote. */
export interface SpeechTranscriptView {
  readonly text: string
  readonly audioSeconds: number
  readonly inferenceSeconds: number
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
export function normalizeSpeechLanguage(stored: string): SpeechLanguageHint {
  const value = stored.trim().toLowerCase()
  if (value === '') return ''
  if (value === 'auto') return ''
  for (const hint of SPEECH_LANGUAGE_HINTS) {
    if (value === hint) return hint
  }
  const base = value.split(/[-_]/)[0] ?? ''
  if (base === 'cmn' || base === 'zh' || base === 'cn') return 'zh'
  if (base === 'yue' || base === 'cantonese') return 'yue'
  for (const hint of SPEECH_LANGUAGE_HINTS) {
    if (base === hint) return hint
  }
  return ''
}

export function isValidRecordingLimit(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= SPEECH_MAX_RECORDING_SECONDS
}

export function isValidSegmentSeconds(value: number): boolean {
  return Number.isSafeInteger(value) && value >= MIN_SEGMENT_SECONDS && value <= MAX_SEGMENT_SECONDS
}

export function isValidContextTurns(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 20
}

/** `0` means "no silence auto-stop"; anything else must be a usable window. */
export function isValidAutoStopSeconds(value: number): boolean {
  if (!Number.isSafeInteger(value)) return false
  if (value === 0) return true
  return value >= MIN_AUTO_STOP_SECONDS && value <= MAX_AUTO_STOP_SECONDS
}

export function validateSettings(settings: BetterInputSettings): void {
  if (!isValidRecordingLimit(settings.maxRecordingSeconds)) {
    throw new Error(
      `sqs-dsh-better-input recording limit must be between 1 and ${SPEECH_MAX_RECORDING_SECONDS} seconds`
    )
  }
  if (!isValidSegmentSeconds(settings.segmentSeconds)) {
    throw new Error(
      `sqs-dsh-better-input segment seconds must be between ${MIN_SEGMENT_SECONDS} and ${MAX_SEGMENT_SECONDS}`
    )
  }
  if (!isValidAutoStopSeconds(settings.autoStopSeconds)) {
    throw new Error(
      `sqs-dsh-better-input auto stop must be 0 or between ${MIN_AUTO_STOP_SECONDS} and ${MAX_AUTO_STOP_SECONDS} seconds`
    )
  }
  if (!isValidContextTurns(settings.contextTurns)) {
    throw new Error('sqs-dsh-better-input context turns must be between 0 and 20')
  }
  if (settings.polishPrompt.trim().length > MAX_POLISH_PROMPT_LENGTH) {
    throw new Error('sqs-dsh-better-input polish prompt is too long')
  }
  if (settings.optimizePrompt.trim().length > MAX_OPTIMIZE_PROMPT_LENGTH) {
    throw new Error('sqs-dsh-better-input optimize prompt is too long')
  }
}

/** Resolve the effective recording cap from stored settings. */
export function effectiveRecordingSeconds(settings: Pick<BetterInputSettings, 'maxRecordingSeconds'>): number {
  return isValidRecordingLimit(settings.maxRecordingSeconds) ? settings.maxRecordingSeconds : DEFAULT_MAX_RECORDING_SECONDS
}

/** Resolve the effective streaming segment length from stored settings. */
export function effectiveSegmentSeconds(settings: Pick<BetterInputSettings, 'segmentSeconds'>): number {
  return isValidSegmentSeconds(settings.segmentSeconds) ? settings.segmentSeconds : DEFAULT_SEGMENT_SECONDS
}

/** Resolve the effective silence auto-stop window; `0` means disabled. */
export function effectiveAutoStopSeconds(settings: Pick<BetterInputSettings, 'autoStopSeconds'>): number {
  return isValidAutoStopSeconds(settings.autoStopSeconds) ? settings.autoStopSeconds : DEFAULT_AUTO_STOP_SECONDS
}
