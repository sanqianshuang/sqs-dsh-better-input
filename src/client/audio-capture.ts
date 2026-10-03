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

import { SPEECH_SAMPLE_RATE } from '../config.js'

/**
 * Why capture could not start, for localized messaging by the caller.
 *
 * `no-device` is separate from `unavailable` on purpose: `NotFoundError`
 * (and `OverconstrainedError`) mean the *machine* has no usable input, which the
 * user fixes by plugging a microphone in — not by changing the origin. Blaming
 * HTTPS for a missing device sends them down the wrong path entirely.
 */
export type CaptureFailureKind = 'unavailable' | 'permission' | 'interrupted' | 'no-device'

/** Capture failure whose `kind` the caller maps onto a localized string. */
export class CaptureError extends Error {
  readonly kind: CaptureFailureKind

  constructor(kind: CaptureFailureKind, message?: string) {
    super(message ?? kind)
    this.name = 'CaptureError'
    this.kind = kind
  }
}

const CHUNK_SECONDS = 0.25
const BYTES_PER_SAMPLE = 2

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext

/**
 * One microphone acquisition.
 *
 * Samples are retained at the rate the AudioContext actually runs at and are
 * converted to 16 kHz on demand, so a browser that ignores the requested
 * sample rate still produces a valid recording.
 */
export class MicrophoneCapture {
  private stream: MediaStream | undefined
  private context: AudioContext | undefined
  private source: MediaStreamAudioSourceNode | undefined
  private processor: ScriptProcessorNode | undefined
  private sink: GainNode | undefined
  private samples = new Float32Array(0)
  private frames = 0
  private captureRate = SPEECH_SAMPLE_RATE
  private released = false
  private disposed = false

  /** Acquire the microphone and start buffering samples. */
  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || navigator.mediaDevices?.getUserMedia === undefined) {
      throw new CaptureError('unavailable', 'getUserMedia is not available in this browser')
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      })
    } catch (error) {
      throw toCaptureError(error)
    }
    // The user may have cancelled while the permission prompt was open.
    if (this.disposed) {
      stopTracks(stream)
      throw new CaptureError('interrupted', 'capture was cancelled')
    }
    this.stream = stream

    const Constructor = audioContextConstructor()
    if (Constructor === undefined) {
      throw this.releaseDevice(stream, 'Web Audio is not available in this browser')
    }
    const context = createAudioContext(Constructor)
    if (context === undefined) {
      // Both attempts to build the graph failed. The device has already been
      // acquired at this point, and the caller only reports the failure — it
      // never receives a capture to dispose — so the tracks must be stopped
      // here or the browser's recording indicator stays on for the life of the
      // page (this is the same leak as an un-released `MediaStream`).
      throw this.releaseDevice(stream, 'Web Audio could not be started in this browser')
    }
    this.context = context
    this.captureRate = context.sampleRate > 0 ? context.sampleRate : SPEECH_SAMPLE_RATE

    try {
      this.source = context.createMediaStreamSource(stream)
      this.processor = context.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (event) => this.collect(event)
      // A ScriptProcessorNode is only pulled while it reaches the destination;
      // a zero-gain sink keeps that alive without echoing into the speakers.
      this.sink = context.createGain()
      this.sink.gain.value = 0
      this.source.connect(this.processor)
      this.processor.connect(this.sink)
      this.sink.connect(context.destination)
    } catch (error) {
      // A node can be refused (context limit, unsupported graph). Same rule as
      // above: never leave the microphone open behind a thrown error.
      await this.release()
      throw new CaptureError('unavailable', error instanceof Error ? error.message : undefined)
    }

    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        // A suspended context still buffers nothing; recording will simply be
        // empty and the caller reports it as such.
      }
    }
  }

  /**
   * Hand the device back and build the failure the caller reports.
   *
   * Used by every failure between acquiring the stream and returning a working
   * capture. The caller of `start()` only reports the thrown error — it never
   * receives a capture to `dispose()` — so without this the `MediaStream` stays
   * live and the browser keeps showing that the microphone is recording. The
   * stream is also cleared so a later `release()`/`dispose()` cannot act on a
   * stream that was never published.
   */
  private releaseDevice(stream: MediaStream, message: string): CaptureError {
    this.stream = undefined
    stopTracks(stream)
    return new CaptureError('unavailable', message)
  }

  /** Seconds captured so far, in capture-rate terms. */
  secondsRecorded(): number {
    return this.frames / this.captureRate
  }

  /** Root-mean-square level of the trailing window, 0 when idle. */
  level(windowSeconds = CHUNK_SECONDS): number {
    const windowFrames = Math.min(this.frames, Math.max(1, Math.round(windowSeconds * this.captureRate)))
    if (windowFrames <= 0) return 0
    const from = this.frames - windowFrames
    let sum = 0
    for (let index = from; index < this.frames; index += 1) {
      const value = this.samples[index] ?? 0
      sum += value * value
    }
    return Math.sqrt(sum / windowFrames)
  }

  /** Largest absolute sample in a range, used to skip silent segments. */
  peak(fromSeconds: number, toSeconds: number): number {
    const range = this.range(fromSeconds, toSeconds)
    let peak = 0
    for (let index = 0; index < range.length; index += 1) {
      const value = Math.abs(range[index] ?? 0)
      if (value > peak) peak = value
    }
    return peak
  }

  /** Copy a capture-time range as 16 kHz mono samples. */
  slice(fromSeconds: number, toSeconds: number): Float32Array {
    const range = this.range(fromSeconds, toSeconds)
    if (this.captureRate === SPEECH_SAMPLE_RATE) return range
    return resampleLinear(range, this.captureRate, SPEECH_SAMPLE_RATE)
  }

  /**
   * Release the microphone and the audio graph, keeping the samples.
   *
   * Called as soon as the user stops speaking so the browser indicator goes
   * away while the final transcription is still running.
   */
  async release(): Promise<void> {
    if (this.released) return
    this.released = true
    const processor = this.processor
    this.processor = undefined
    if (processor !== undefined) {
      processor.onaudioprocess = null
      try {
        processor.disconnect()
      } catch {
        // Already torn down by the browser.
      }
    }
    disconnect(this.source)
    this.source = undefined
    disconnect(this.sink)
    this.sink = undefined
    stopTracks(this.stream)
    this.stream = undefined
    const context = this.context
    this.context = undefined
    if (context !== undefined) {
      try {
        await context.close()
      } catch {
        // Closing an already-closed context is not an error for us.
      }
    }
  }

  /** Release the microphone and drop the buffered samples. */
  async dispose(): Promise<void> {
    this.disposed = true
    await this.release()
    this.samples = new Float32Array(0)
    this.frames = 0
  }

  private collect(event: AudioProcessingEvent): void {
    if (this.disposed || this.released) return
    const channel = event.inputBuffer.getChannelData(0)
    if (channel.length === 0) return
    this.ensure(channel.length)
    this.samples.set(channel, this.frames)
    this.frames += channel.length
  }

  private ensure(extra: number): void {
    if (this.frames + extra <= this.samples.length) return
    let capacity = Math.max(4096, this.samples.length * 2)
    while (capacity < this.frames + extra) capacity *= 2
    const next = new Float32Array(capacity)
    next.set(this.samples.subarray(0, this.frames))
    this.samples = next
  }

  private range(fromSeconds: number, toSeconds: number): Float32Array {
    const from = Math.max(0, Math.round(fromSeconds * this.captureRate))
    const to = Math.min(this.frames, Math.round(toSeconds * this.captureRate))
    if (to <= from) return new Float32Array(0)
    return this.samples.slice(from, to)
  }
}

/** Whether this browser can capture at all (secure context + Web Audio). */
export function isCaptureSupported(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  return navigator.mediaDevices?.getUserMedia !== undefined && audioContextConstructor() !== undefined
}

/**
 * Encode 16 kHz mono samples as the canonical PCM16 WAV the Host validates.
 *
 * Field for field: RIFF/WAVE/`fmt `/16/PCM=1/mono/16000/byteRate 32000/
 * blockAlign 2/bits 16/`data`, RIFF size = length - 8, data size =
 * length - 44, an even PCM length, and at least one sample.
 */
export function encodeWave(samples: Float32Array): Uint8Array {
  const header = 44
  const dataBytes = samples.length * BYTES_PER_SAMPLE
  const bytes = new Uint8Array(header + dataBytes)
  const view = new DataView(bytes.buffer)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SPEECH_SAMPLE_RATE, true)
  view.setUint32(28, SPEECH_SAMPLE_RATE * BYTES_PER_SAMPLE, true)
  view.setUint16(32, BYTES_PER_SAMPLE, true)
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(header + index * BYTES_PER_SAMPLE, Math.round(value * 32767), true)
  }
  return bytes
}

/** Base64 for the JSON Remote carrier, chunked to avoid argument-count limits. */
export function audioBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

/** Linear resampling; adequate for a fallback path off the 16 kHz happy path. */
export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (samples.length === 0 || fromRate === toRate || fromRate <= 0) return samples
  const length = Math.max(1, Math.round((samples.length * toRate) / fromRate))
  const output = new Float32Array(length)
  const step = (samples.length - 1) / Math.max(1, length - 1)
  for (let index = 0; index < length; index += 1) {
    const position = index * step
    const lower = Math.floor(position)
    const upper = Math.min(samples.length - 1, lower + 1)
    const weight = position - lower
    const a = samples[lower] ?? 0
    const b = samples[upper] ?? 0
    output[index] = a + (b - a) * weight
  }
  return output
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index))
}

function disconnect(node: { disconnect(): void } | undefined): void {
  if (node === undefined) return
  try {
    node.disconnect()
  } catch {
    // Already disconnected.
  }
}

function stopTracks(stream: MediaStream | undefined): void {
  if (stream === undefined) return
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // Track already ended.
    }
  }
}

/**
 * Build the audio graph's context, preferring the requested 16 kHz rate.
 *
 * The rate is a hint: browsers that ignore it still resample the device stream
 * later (see `slice`). Both attempts can throw — an exhausted context budget or
 * a blocked audio permission is not rare — and the second failure is what used
 * to escape `start()` with the microphone still open.
 *
 * @returns the context, or `undefined` when neither attempt succeeded.
 *
 * Exported for `check:routes`, which drives the failing branches with stub
 * constructors — the same reason `toCaptureError` is exported. Nothing else in
 * the build can reach them.
 */
export function createAudioContext(Constructor: AudioContextConstructor): AudioContext | undefined {
  try {
    return new Constructor({ sampleRate: SPEECH_SAMPLE_RATE })
  } catch {
    try {
      return new Constructor()
    } catch {
      return undefined
    }
  }
}

function audioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  // `AudioContext` is a global binding rather than a member of the `Window`
  // interface, so read it off `globalThis`.
  const holder = globalThis as { AudioContext?: AudioContextConstructor; webkitAudioContext?: AudioContextConstructor }
  return holder.AudioContext ?? holder.webkitAudioContext
}

/**
 * Classify a `getUserMedia` rejection into the kind the UI localizes.
 *
 * Exported for `check:routes`: the mapping is the difference between telling a
 * user "connect a microphone" and blaming their origin for a missing device, and
 * nothing else in the build can see it.
 */
export function toCaptureError(error: unknown): CaptureError {
  // `name` is read structurally rather than through `instanceof DOMException`:
  // a rejection can arrive as a plain Error (or a cross-realm DOMException,
  // which fails `instanceof` in this realm), and losing it would silently
  // downgrade a denied permission to the generic "unavailable" sentence.
  const name = error instanceof Error || (typeof error === 'object' && error !== null)
    ? String((error as { name?: unknown }).name ?? '')
    : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new CaptureError('permission', error instanceof Error ? error.message : undefined)
  }
  if (name === 'AbortError') {
    return new CaptureError('interrupted', error instanceof Error ? error.message : undefined)
  }
  // No input device, or the one requested cannot satisfy the constraints.
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return new CaptureError('no-device', error instanceof Error ? error.message : undefined)
  }
  return new CaptureError('unavailable', error instanceof Error ? error.message : undefined)
}
