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
/**
 * Decode wire base64 after enforcing the encoded-size ceiling.
 *
 * The ceiling is applied to the encoded length first so an oversized or
 * adversarial payload is rejected before it is materialised as bytes.
 *
 * @param value - base64 audio with no data-URL prefix.
 * @throws when the payload exceeds the configured byte ceiling.
 */
export declare function decodeBase64Audio(value: string): Uint8Array;
/**
 * Read a canonical 16 kHz mono PCM16 WAV recording, rejecting inconsistent
 * lengths.
 *
 * @param audio - decoded wire bytes.
 * @param maxSeconds - maximum admitted recording duration.
 * @returns complete recording duration in seconds.
 */
export declare function validateSpeechWave(audio: Uint8Array, maxSeconds: number): number;
