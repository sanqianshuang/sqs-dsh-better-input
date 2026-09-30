import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type SpeechToText from '@deepseek-ai/dsh-experimental-speech-to-text'
import type { SpeechProviderId, SpeechProviderView, SpeechSelection } from '@deepseek-ai/dsh-experimental-speech-to-text'
import {
  normalizeSpeechLanguage,
  SPEECH_MAX_RECORDING_SECONDS,
  type SpeechProviderStatus,
  type SpeechStatusView,
  type SpeechTranscriptView
} from '../config.js'
import { decodeBase64Audio, validateSpeechWave } from './wave.js'

/**
 * Host half of the native voice input.
 *
 * The browser records 16 kHz mono PCM16 WAV and calls these methods; the Host
 * hands the audio to dsh's own speech service (`ctx.speechToText`), which the
 * optional `@deepseek-ai/dsh-experimental-voice-input-bundle` contributes. The
 * local SenseVoice provider then transcribes it on this machine.
 *
 * Two decisions worth keeping:
 *
 * 1. `speechToText` is looked up lazily through `ctx.get()` and is **not** part
 *    of this service's `inject`. Making it a dependency would stop this whole
 *    plugin — settings page, prompt optimization, template library — from
 *    activating in a composition without the speech bundle.
 * 2. The service owns its own intake validation. Audio arrives through this
 *    plugin's Remote, so it never passes the experimental speech Remote's
 *    `validateWave`, and this plugin's dependency on the speech *package* is
 *    type-only (dev dependencies do not exist in an `npm pack` install).
 */
export class BetterInputSpeechService extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'BetterInputSpeech', { namespace: 'betterInput' })
  }

  /**
   * Read the recognizer roster and readiness for the settings page.
   *
   * Never throws: an uncomposed or provider-less speech service is reported as
   * `available: false` so the settings page can explain the situation instead
   * of showing a failed request.
   */
  async speechStatus(): Promise<SpeechStatusView> {
    const speech = this.speech()
    if (speech === undefined) {
      return unavailable(false, 'dsh 的语音服务（speechToText）未启用')
    }
    const snapshot = speech.snapshot()
    if (snapshot.providers.length === 0) {
      // The local provider inspects its model cache during activation, so this
      // is also the normal state for a moment right after Host start.
      return unavailable(true, 'dsh 的语音服务尚未注册识别器（正在检查本地模型缓存）')
    }
    return {
      service: true,
      available: true,
      providers: snapshot.providers.map(toProviderStatus),
      selection: snapshot.selection.providerId === '' ? null : toSelection(snapshot.selection),
      maxRecordingSeconds: SPEECH_MAX_RECORDING_SECONDS,
      detail: ''
    }
  }

  /**
   * Start or join dsh's provider-owned preparation task, then report the
   * resulting state.
   *
   * Preparation is Host-owned and is not tied to the browser connection, so
   * this only starts it; progress is observed by polling `speechStatus()`.
   */
  async speechPrepare(providerId: string): Promise<SpeechStatusView> {
    const speech = this.speech()
    if (speech === undefined) {
      return unavailable(false, 'dsh 的语音服务（speechToText）未启用')
    }
    const id = providerId.trim()
    if (id === '') throw new Error('sqs-dsh-better-input: 未指定要准备的识别器')
    if (!speech.snapshot().providers.some((provider) => provider.id === id)) {
      throw new Error(`sqs-dsh-better-input: 识别器 ${id} 未注册`)
    }
    speech.prepare(id as SpeechProviderId)
    return this.speechStatus()
  }

  /**
   * Transcribe one complete recording.
   *
   * `language` may be empty (automatic detection) or one of the provider's
   * advertised hints; anything else is normalized rather than forwarded, since
   * `resolve()` rejects an unadvertised language outright.
   */
  async transcribeSpeech(audioBase64: string, language: string, signal: AbortSignal): Promise<SpeechTranscriptView> {
    signal.throwIfAborted()
    const speech = this.speech()
    if (speech === undefined) {
      throw new Error('sqs-dsh-better-input: dsh 的语音服务（speechToText）未启用，请在插件管理页启用「语音输入」')
    }
    if (speech.snapshot().providers.length === 0) {
      throw new Error('sqs-dsh-better-input: dsh 的语音服务里没有已注册的识别器')
    }
    const audio = decodeBase64Audio(audioBase64)
    validateSpeechWave(audio, SPEECH_MAX_RECORDING_SECONDS)
    const hint = normalizeSpeechLanguage(language)
    const spec = speech.resolve({ audio, language: hint === '' ? undefined : hint })
    const transcript = await speech.transcribe(spec, signal)
    return {
      text: transcript.text,
      audioSeconds: transcript.audioSeconds,
      inferenceSeconds: transcript.inferenceSeconds
    }
  }

  /** `undefined` when the speech bundle is not part of the running composition. */
  private speech(): SpeechToText | undefined {
    return this.ctx.get('speechToText')
  }
}

function toSelection(selection: SpeechSelection): { providerId: string; language: string } {
  return { providerId: selection.providerId, language: selection.language }
}

function toProviderStatus(provider: SpeechProviderView): SpeechProviderStatus {
  return {
    id: provider.id,
    name: provider.name,
    location: provider.location,
    languages: [...provider.languages],
    preparation: provider.preparation.phase,
    detail: preparationDetail(provider)
  }
}

/** Localized-by-the-caller progress or failure detail; empty when not applicable. */
function preparationDetail(provider: SpeechProviderView): string {
  const preparation = provider.preparation
  if (preparation.phase === 'failed') {
    const download = preparation.download
    if (download === undefined) return preparation.message
    return `${preparation.message} (${download.resource}: ${download.reason})`
  }
  if (preparation.phase === 'downloading') {
    const total = preparation.totalBytes
    if (total === undefined) return preparation.resource
    return `${preparation.resource} ${formatBytes(preparation.completedBytes)} / ${formatBytes(total)}`
  }
  return ''
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`
}

function unavailable(service: boolean, detail: string): SpeechStatusView {
  return {
    service,
    available: false,
    providers: [],
    selection: null,
    maxRecordingSeconds: SPEECH_MAX_RECORDING_SECONDS,
    detail
  }
}
