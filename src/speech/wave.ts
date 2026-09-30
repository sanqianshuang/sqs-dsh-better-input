/**
 * Intake validation for browser recordings crossing this plugin's own Remote.
 *
 * Why this exists at all: the audio the browser records is submitted to dsh's
 * speech service through `speechToText.resolve()` / `.transcribe()` — it never
 * passes the experimental speech Remote, which is where dsh validates its own
 * intake (`@deepseek-ai/dsh-experimental-speech-to-text` → `./wave`). That
 * module is also not a runtime dependency of this plugin (our dependency on the
 * package is type-only, and dev dependencies are absent from an `npm pack`
 * install), so the canonical WAV contract is mirrored here instead.
 *
 * The mirror is deliberately strict and byte-for-byte equivalent to dsh's
 * `validateWave`: a malformed header, a sample-rate mismatch or an odd PCM
 * length must be rejected here, before base64 audio reaches the native worker.
 */

import { SPEECH_MAX_AUDIO_BYTES, SPEECH_SAMPLE_RATE } from '../config.js'

const HEADER_BYTES = 44
const BYTES_PER_SECOND = SPEECH_SAMPLE_RATE * 2

function ascii(view: DataView, offset: number, length: number): string {
  let out = ''
  for (let index = 0; index < length; index += 1) out += String.fromCharCode(view.getUint8(offset + index))
  return out
}

/**
 * Decode wire base64 after enforcing the encoded-size ceiling.
 *
 * The ceiling is applied to the encoded length first so an oversized or
 * adversarial payload is rejected before it is materialised as bytes.
 *
 * @param value - base64 audio with no data-URL prefix.
 * @throws when the payload exceeds the configured byte ceiling.
 */
export function decodeBase64Audio(value: string): Uint8Array {
  if (value.length > Math.ceil(SPEECH_MAX_AUDIO_BYTES / 3) * 4) {
    throw new Error('sqs-dsh-better-input: recording exceeds the maximum audio size')
  }
  return new Uint8Array(Buffer.from(value, 'base64'))
}

/**
 * Read a canonical 16 kHz mono PCM16 WAV recording, rejecting inconsistent
 * lengths.
 *
 * @param audio - decoded wire bytes.
 * @param maxSeconds - maximum admitted recording duration.
 * @returns complete recording duration in seconds.
 */
export function validateSpeechWave(audio: Uint8Array, maxSeconds: number): number {
  // Every field dsh's own `validateWave` checks, in the same order.
  if (audio.length < HEADER_BYTES + 2) throw invalidWave()
  const view = new DataView(audio.buffer, audio.byteOffset, audio.byteLength)
  if (
    ascii(view, 0, 4) !== 'RIFF' ||
    ascii(view, 8, 4) !== 'WAVE' ||
    ascii(view, 12, 4) !== 'fmt ' ||
    view.getUint32(16, true) !== 16 ||
    view.getUint16(20, true) !== 1 ||
    view.getUint16(22, true) !== 1 ||
    view.getUint32(24, true) !== SPEECH_SAMPLE_RATE ||
    view.getUint32(28, true) !== BYTES_PER_SECOND ||
    view.getUint16(32, true) !== 2 ||
    view.getUint16(34, true) !== 16 ||
    ascii(view, 36, 4) !== 'data' ||
    view.getUint32(4, true) !== audio.length - 8 ||
    view.getUint32(40, true) !== audio.length - HEADER_BYTES ||
    (audio.length - HEADER_BYTES) % 2 !== 0
  ) {
    throw invalidWave()
  }
  const seconds = (audio.length - HEADER_BYTES) / BYTES_PER_SECOND
  if (seconds > maxSeconds) {
    throw new Error(`sqs-dsh-better-input: recording exceeds ${maxSeconds} seconds`)
  }
  return seconds
}

function invalidWave(): Error {
  return new Error(
    `sqs-dsh-better-input: audio must be a canonical ${SPEECH_SAMPLE_RATE / 1000} kHz mono PCM16 WAV recording`
  )
}
