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

import { effectiveAutoStopSeconds, effectiveSegmentSeconds, SPEECH_MAX_RECORDING_SECONDS, type BetterInputSettings } from '../config.js'
import { audioBase64, CaptureError, encodeWave, MicrophoneCapture } from './audio-capture.js'

/** How often the segment cutter inspects the recording. */
export const TICK_MS = 200
/** Never cut a segment shorter than this, even on a clean pause. */
const MIN_SEGMENT_SECONDS = 1.2
/** Trailing fragment below this is dropped rather than submitted. */
const MIN_TAIL_SECONDS = 0.4
/** Silence long enough to be treated as a sentence boundary. */
const SILENCE_SECONDS = 0.45
/** RMS below this counts as silence (quiet room noise sits well under it). */
const SILENCE_LEVEL = 0.012
/** Peak below this means the segment holds no speech at all. */
const MIN_PEAK = 0.005
/** Shortest payload worth submitting; the Host rejects WAV under 46 bytes. */
const MIN_SAMPLES = 1600
/**
 * Quiet-window slack, in seconds.
 *
 * `quiet` is a sum of frame lengths, so 50 × 0.2 s can land at 9.999999999999998
 * and hold the countdown one frame (200 ms) past the window the user was shown.
 */
const QUIET_EPSILON_SECONDS = 1e-6

export type NativeSpeechPhase = 'capturing' | 'finalizing'

/** What one {@link SilenceWatch} frame reported. */
export type SilenceReading = {
  /** True once any frame has been loud enough — the countdown arms on this. */
  readonly hasSpoken: boolean
  /** Seconds of continuous quiet since the last sound. */
  readonly quietSeconds: number
  /** Seconds left before the auto-stop, `null` while no countdown runs. */
  readonly remainingSeconds: number | null
  /** Whether the quiet window has fully elapsed. */
  readonly elapsed: boolean
}

/**
 * The silence auto-stop timer: "speak, then stop talking, and the recording
 * finishes by itself".
 *
 * Deliberately pure and free of Web Audio so the guard script can drive it:
 * the whole user-visible contract is here — the countdown never runs before the
 * first sound (`hasSpoken`), any new sound resets it to the full window, and it
 * cannot fire at all when the window is `0` (disabled).
 */
export class SilenceWatch {
  private spoken = false
  private quiet = 0

  constructor(
    /** Quiet window in seconds; `0` disables the auto-stop. */
    private readonly limitSeconds: number,
    /** Frame length in seconds. */
    private readonly tickSeconds: number
  ) {}

  observe(sounding: boolean): SilenceReading {
    if (sounding) {
      this.spoken = true
      this.quiet = 0
    } else {
      this.quiet += this.tickSeconds
    }
    const remainingSeconds = this.remainingSeconds()
    return {
      hasSpoken: this.spoken,
      quietSeconds: this.quiet,
      remainingSeconds,
      elapsed: remainingSeconds !== null && remainingSeconds <= 0
    }
  }

  /** Seconds left in the window, `null` while counting is not allowed. */
  remainingSeconds(): number | null {
    if (this.limitSeconds <= 0 || !this.spoken) return null
    const remaining = this.limitSeconds - this.quiet
    return remaining <= QUIET_EPSILON_SECONDS ? 0 : remaining
  }
}

/**
 * One 200 ms telemetry frame for the status bar: how long the microphone has
 * been open, the current input level (for the level meter) and — once speech
 * has been heard — how long is left before the silence auto-stop.
 */
export type SpeechTick = {
  readonly elapsedSeconds: number
  /** Root-mean-square of the trailing window, ~0 while silent. */
  readonly level: number
  /** Configured silence window in seconds, `0` when the auto-stop is off. */
  readonly autoStopSeconds: number
  /** Seconds left before the auto-stop, `null` when no countdown is running. */
  readonly autoStopRemainingSeconds: number | null
}

/** The shape this session needs from `remote.transcribeSpeech`. */
export type TranscribeOutcome =
  | { readonly ok: true; readonly value: { readonly text: string } }
  | { readonly ok: false; readonly error: { readonly message: string } }

export type TranscribeCall = (audioBase64: string, language: string, signal: AbortSignal) => Promise<TranscribeOutcome>

export type NativeSpeechSessionOptions = {
  /** SenseVoice language hint; empty means automatic detection. */
  language: string
  /** Cut a preview segment once this many seconds have accumulated. */
  segmentSeconds: number
  /** Stream segment transcripts into the draft while the user is still speaking. */
  streamingPreview: boolean
  /**
   * Stop after this many seconds without speech once the user has spoken.
   * `0` disables it; the hard recording ceiling still applies either way.
   */
  autoStopSeconds: number
  /** Plugin Remote call that performs one transcription on the Host. */
  transcribe: TranscribeCall
  /** Growing preview text, called after every completed segment. */
  onPreview: (text: string) => void
  /** Authoritative transcript after the recording stopped. */
  onEnd: (text: string) => void
  /** Capture and transcription failures; the session decides whether to continue. */
  onError: (error: Error) => void
  /** Phase changes, for the surrounding status UI. */
  onPhase?: (phase: NativeSpeechPhase) => void
  /** Timer/level telemetry, every {@link TICK_MS}, for the status bar. */
  onTick?: (tick: SpeechTick) => void
  /** Called just before the session stops itself on the silence timeout. */
  onAutoStop?: () => void
}

/** Settings face this session reads; kept structural so tests need no defaults. */
export type SpeechSessionSettings = Pick<
  BetterInputSettings,
  'language' | 'segmentSeconds' | 'streamingPreview' | 'autoStopSeconds'
>

export function sessionOptionsFor(
  settings: SpeechSessionSettings,
  transcribe: TranscribeCall,
  callbacks: Pick<NativeSpeechSessionOptions, 'onPreview' | 'onEnd' | 'onError' | 'onPhase' | 'onTick' | 'onAutoStop'>
): NativeSpeechSessionOptions {
  return {
    language: settings.language,
    segmentSeconds: effectiveSegmentSeconds(settings),
    streamingPreview: settings.streamingPreview !== false,
    autoStopSeconds: effectiveAutoStopSeconds(settings),
    transcribe,
    ...callbacks
  }
}

export class NativeSpeechSession {
  private readonly capture = new MicrophoneCapture()
  private readonly segments: string[] = []
  private timer: ReturnType<typeof setInterval> | undefined
  /** Seconds already submitted as preview segments. */
  private cursor = 0
  private speechSeen = false
  /** Silence since the last cut, used by the segment cutter. */
  private silenceSeconds = 0
  /**
   * The auto-stop timer, replaced on every `start()`.
   *
   * Kept separate from `silenceSeconds` on purpose: cutting a segment resets
   * that one, and the countdown the user is watching must not jump back to the
   * full window every time a preview segment is cut.
   */
  private watch = new SilenceWatch(0, TICK_MS / 1000)
  /** Serialises transcriptions: the native worker is serial anyway. */
  private queue: Promise<void> = Promise.resolve()
  private inFlight: AbortController | undefined
  private stopping = false
  private aborted = false
  private ended = false

  constructor(private readonly options: NativeSpeechSessionOptions) {}

  get active(): boolean {
    return this.timer !== undefined && !this.stopping && !this.aborted
  }

  /** Acquire the microphone and begin cutting preview segments. */
  async start(): Promise<void> {
    try {
      await this.capture.start()
    } catch (error) {
      // A stop/abort that arrived while the permission prompt was open is a
      // user decision, not a failure: the capture throws 'interrupted' by design.
      if (this.aborted || this.stopping || this.ended) return
      this.options.onError(toError(error))
      return
    }
    // `stop()` may already have run while the microphone was being acquired.
    if (this.aborted || this.stopping) {
      void this.capture.dispose()
      return
    }
    this.options.onPhase?.('capturing')
    this.watch = new SilenceWatch(this.options.autoStopSeconds, TICK_MS / 1000)
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  /** Finish the recording: flush the tail, then transcribe the whole thing. */
  stop(): void {
    if (this.stopping || this.aborted || this.ended) return
    this.stopping = true
    this.clearTimer()
    const total = this.capture.secondsRecorded()
    if (this.options.streamingPreview && total - this.cursor >= MIN_TAIL_SECONDS) this.cutSegment(total)
    // Release the microphone immediately; the samples stay for the final pass.
    void this.capture.release()
    void this.finish(total)
  }

  /** Discard everything: no callbacks, no transcript, microphone released. */
  abort(): void {
    if (this.aborted) return
    this.aborted = true
    this.stopping = true
    this.clearTimer()
    this.inFlight?.abort()
    this.inFlight = undefined
    void this.capture.dispose()
  }

  private tick(): void {
    if (this.aborted || this.stopping) return
    const now = this.capture.secondsRecorded()
    const level = this.capture.level()
    const sounding = level >= SILENCE_LEVEL
    if (sounding) {
      this.speechSeen = true
      this.silenceSeconds = 0
    } else {
      this.silenceSeconds += TICK_MS / 1000
    }
    const quiet = this.watch.observe(sounding)
    this.publishTick(now, level, quiet.remainingSeconds)
    // `onAutoStop` runs before `stop()` so the UI can leave "recording" before
    // the final pass starts; `stop()` is idempotent, so a manual stop racing
    // this call is harmless.
    if (quiet.elapsed) {
      this.options.onAutoStop?.()
      this.stop()
      return
    }

    const pending = now - this.cursor
    if (pending <= 0) return
    if (!this.options.streamingPreview) return
    const reachedCap = pending >= this.options.segmentSeconds
    const quietBoundary = pending >= MIN_SEGMENT_SECONDS && this.speechSeen && this.silenceSeconds >= SILENCE_SECONDS
    if (reachedCap || quietBoundary) this.cutSegment(now)
  }

  /** One telemetry frame for the status bar (timer, level, countdown). */
  private publishTick(elapsedSeconds: number, level: number, autoStopRemainingSeconds: number | null): void {
    const onTick = this.options.onTick
    if (onTick === undefined) return
    onTick({
      elapsedSeconds,
      level,
      autoStopSeconds: this.options.autoStopSeconds,
      autoStopRemainingSeconds
    })
  }

  /** Submit `[cursor, endSeconds)` as one preview segment. */
  private cutSegment(endSeconds: number): void {
    const from = this.cursor
    this.cursor = endSeconds
    this.speechSeen = false
    this.silenceSeconds = 0
    if (this.capture.peak(from, endSeconds) < MIN_PEAK) return
    this.submit(this.capture.slice(from, endSeconds), false)
  }

  private submit(samples: Float32Array, isFinal: boolean): void {
    if (samples.length < MIN_SAMPLES) return
    const payload = audioBase64(encodeWave(samples))
    this.queue = this.queue.then(async () => {
      if (this.aborted) return undefined
      const controller = new AbortController()
      this.inFlight = controller
      try {
        const result = await this.options.transcribe(payload, this.options.language, controller.signal)
        if (this.aborted) return undefined
        if (!result.ok) {
          this.options.onError(new Error(result.error.message))
          return undefined
        }
        const text = result.value.text.trim()
        if (text === '') return undefined
        this.segments.push(text)
        if (!isFinal) this.options.onPreview(this.segments.join(' '))
        return undefined
      } catch (error) {
        if (this.aborted) return undefined
        this.options.onError(toError(error))
        return undefined
      } finally {
        if (this.inFlight === controller) this.inFlight = undefined
      }
    })
    return undefined
  }

  private async finish(total: number): Promise<void> {
    // Let the queued preview segments land before deciding on the final text.
    await this.queue.catch(() => undefined)
    if (this.aborted) return
    this.options.onPhase?.('finalizing')

    let finalText = ''
    const seconds = Math.min(total, SPEECH_MAX_RECORDING_SECONDS)
    if (seconds >= MIN_TAIL_SECONDS) {
      const controller = new AbortController()
      this.inFlight = controller
      try {
        const samples = this.capture.slice(0, seconds)
        if (samples.length >= MIN_SAMPLES && this.capture.peak(0, seconds) >= MIN_PEAK) {
          const result = await this.options.transcribe(audioBase64(encodeWave(samples)), this.options.language, controller.signal)
          if (this.aborted) return
          if (result.ok) finalText = result.value.text.trim()
          else this.options.onError(new Error(result.error.message))
        }
      } catch (error) {
        if (this.aborted) return
        this.options.onError(toError(error))
      } finally {
        if (this.inFlight === controller) this.inFlight = undefined
      }
    }

    const preview = this.segments.join(' ')
    const text = finalText !== '' ? finalText : preview
    this.ended = true
    await this.capture.dispose()
    if (this.aborted) return
    this.options.onEnd(text)
  }

  private clearTimer(): void {
    if (this.timer === undefined) return
    clearInterval(this.timer)
    this.timer = undefined
  }
}

/** Localized by the caller: capture failures carry a kind, others their message. */
export function captureFailureMessage(error: Error): { kind: CaptureError['kind'] | ''; message: string } {
  if (error instanceof CaptureError) return { kind: error.kind, message: error.message }
  return { kind: '', message: error.message }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
