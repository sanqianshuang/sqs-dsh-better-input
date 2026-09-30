#!/usr/bin/env unrun
/**
 * Guard for the native speech audio contract.
 *
 * Background: this plugin records in the browser and hands the WAV to dsh's
 * speech service through its own Remote, so the audio never passes dsh's own
 * intake validation (`@deepseek-ai/dsh-experimental-speech-to-text` → `./wave`).
 * Two silent failure classes follow, and neither `tsc` nor the build catches
 * either of them:
 *
 *   1. the browser encoder drifting from the canonical 16 kHz mono PCM16 WAV
 *      layout — every recording then fails at the Host with an unhelpful error;
 *   2. the client-side ceiling disagreeing with the Host-side one — the plugin
 *      would record something the Host refuses, or refuse something valid.
 *
 * When a dsh install is resolvable, dsh's own `validateWave` runs as the
 * authoritative oracle and every encoder output is checked against it.
 *
 * Usage:
 *   unrun scripts/check-speech-audio.ts
 *   DSH_SPEECH_WAVE=/path/to/dsh-experimental-speech-to-text/lib/types/wave.js unrun scripts/check-speech-audio.ts
 */

import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { audioBase64, encodeWave, resampleLinear } from '../src/client/audio-capture.js'
import { SilenceWatch, TICK_MS } from '../src/client/native-speech.js'
import { decodeBase64Audio, validateSpeechWave } from '../src/speech/wave.js'
import { DEFAULT_AUTO_STOP_SECONDS, DEFAULT_SETTINGS, MAX_AUTO_STOP_SECONDS, normalizeSpeechLanguage, SPEECH_MAX_RECORDING_SECONDS, validateSettings } from '../src/config.js'
import { normalizeSettings } from '../src/settings/store.js'

const failures: string[] = []
const pass = (message: string, detail = '') => console.log(`PASS  ${message}${detail ? `  [${detail}]` : ''}`)
const fail = (message: string, detail = '') => {
  failures.push(message)
  console.log(`FAIL  ${message}${detail ? `  [${detail}]` : ''}`)
}
const check = (message: string, condition: boolean, detail = '') => {
  if (condition) pass(message, detail)
  else fail(message, detail)
}

// --- authoritative oracle, when a dsh install is present -------------------
const candidates = [
  process.env.DSH_SPEECH_WAVE,
  '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-experimental-speech-to-text/lib/types/wave.js'
].filter((value): value is string => typeof value === 'string' && value.length > 0)

let authoritative: ((audio: Uint8Array, maxDurationSeconds: number) => number) | undefined
for (const candidate of candidates) {
  if (!existsSync(candidate)) continue
  try {
    const module = (await import(pathToFileURL(candidate).href)) as { validateWave?: unknown }
    if (typeof module.validateWave === 'function') {
      authoritative = module.validateWave as typeof authoritative
      console.log(`check-speech-audio: authoritative validator ${candidate}`)
      break
    }
  } catch {
    // fall through to the next candidate; the local assertions still run
  }
}
if (authoritative === undefined) {
  console.log('check-speech-audio: dsh validator not resolvable — checking this plugin only (set DSH_SPEECH_WAVE to cross-check)')
}

const tone = (seconds: number, sampleRate = 16000): Float32Array => {
  const samples = new Float32Array(Math.round(seconds * sampleRate))
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 0.4
  }
  return samples
}

/**
 * Read a duration without ever throwing, so a rejected recording is reported as
 * a FAIL line instead of aborting the run with a stack trace.
 */
const durationOf = (read: () => number): { seconds: number; error: string } => {
  try {
    return { seconds: read(), error: '' }
  } catch (error) {
    return { seconds: -1, error: error instanceof Error ? error.message : String(error) }
  }
}

// --- 1. the encoder produces exactly what dsh accepts ----------------------
for (const seconds of [0.1, 1, 3.5, 12, SPEECH_MAX_RECORDING_SECONDS]) {
  const wav = encodeWave(tone(seconds))
  const ours = durationOf(() => validateSpeechWave(wav, SPEECH_MAX_RECORDING_SECONDS))
  check(`our intake reads encodeWave(${seconds}s)`, ours.error === '' && Math.abs(ours.seconds - seconds) < 1e-6, ours.error || `${ours.seconds}s`)
  if (authoritative !== undefined) {
    const oracle = durationOf(() => authoritative!(wav, SPEECH_MAX_RECORDING_SECONDS))
    check(`dsh accepts encodeWave(${seconds}s)`, oracle.error === '' && Math.abs(oracle.seconds - seconds) < 1e-6, oracle.error || `${oracle.seconds}s`)
  }
}

// --- 2. both ceilings agree, at the boundary and one sample past it --------
const atLimit = encodeWave(tone(SPEECH_MAX_RECORDING_SECONDS))
check('a recording of exactly the ceiling is admitted', durationOf(() => validateSpeechWave(atLimit, SPEECH_MAX_RECORDING_SECONDS)).error === '')
check('the base64 payload of exactly the ceiling is admitted', durationOf(() => decodeBase64Audio(audioBase64(atLimit)).length).error === '')
check('the base64 payload past the ceiling is rejected', rejects(() => decodeBase64Audio(audioBase64(encodeWave(tone(SPEECH_MAX_RECORDING_SECONDS + 1))))))
check('a recording past the ceiling is rejected', rejects(() => validateSpeechWave(encodeWave(tone(SPEECH_MAX_RECORDING_SECONDS + 1)), SPEECH_MAX_RECORDING_SECONDS)))

// --- 3. our intake agrees with dsh's on a spread of random recordings ------
if (authoritative !== undefined) {
  let agreed = 0
  let compared = 0
  for (let index = 0; index < 200; index += 1) {
    const samples = Math.floor(Math.random() * 16000 * 8) + 800
    const wav = encodeWave(new Float32Array(samples))
    compared += 1
    const theirs = durationOf(() => authoritative!(wav, SPEECH_MAX_RECORDING_SECONDS))
    const ours = durationOf(() => validateSpeechWave(wav, SPEECH_MAX_RECORDING_SECONDS))
    if (theirs.error === '' && ours.error === '' && Math.abs(theirs.seconds - ours.seconds) < 1e-9) agreed += 1
  }
  check('our intake matches dsh on random recordings', agreed === compared, `${agreed}/${compared}`)
}

// --- 4. both reject the same malformed inputs ------------------------------
const malformed: Record<string, Uint8Array> = {
  'empty payload': new Uint8Array(44),
  'odd PCM length': (() => { const wav = encodeWave(tone(1)); return wav.subarray(0, wav.length - 1) })(),
  'wrong sample rate': (() => { const wav = encodeWave(tone(1)); new DataView(wav.buffer).setUint32(24, 44100, true); return wav })(),
  'stereo header': (() => { const wav = encodeWave(tone(1)); new DataView(wav.buffer).setUint16(22, 2, true); return wav })(),
  'wrong RIFF size': (() => { const wav = encodeWave(tone(1)); new DataView(wav.buffer).setUint32(4, 1, true); return wav })(),
  'wrong bits per sample': (() => { const wav = encodeWave(tone(1)); new DataView(wav.buffer).setUint16(34, 8, true); return wav })(),
  'not RIFF': (() => { const wav = encodeWave(tone(1)); wav[0] = 0x58; return wav })()
}
for (const [name, bytes] of Object.entries(malformed)) {
  check(`our intake rejects ${name}`, rejects(() => validateSpeechWave(bytes, SPEECH_MAX_RECORDING_SECONDS)))
  if (authoritative !== undefined) {
    check(`dsh rejects ${name}`, rejects(() => authoritative(bytes, SPEECH_MAX_RECORDING_SECONDS)))
  }
}

// --- 5. the Remote carrier is lossless ------------------------------------
const original = encodeWave(tone(2))
check('base64 round-trip is byte-identical', Buffer.compare(Buffer.from(original), Buffer.from(decodeBase64Audio(audioBase64(original)))) === 0, `${original.length} bytes`)

// --- 6. off-rate capture still produces a canonical recording -------------
const resampled = resampleLinear(tone(2, 48000), 48000, 16000)
check('48 kHz capture resamples to the same duration', Math.abs(resampled.length / 16000 - 2) < 0.001, `${resampled.length} samples`)
check('resampled audio validates', durationOf(() => validateSpeechWave(encodeWave(resampled), SPEECH_MAX_RECORDING_SECONDS)).seconds > 1.9)

// --- 7. stored settings migrate onto the values the recognizer accepts ----
const migrated = normalizeSettings({
  language: 'zh-CN',
  maxRecordingSeconds: 600,
  polishingEnabled: true
})
check('a legacy BCP-47 language is narrowed', migrated.language === 'zh', migrated.language)
check('the legacy 600 s limit is repaired', migrated.maxRecordingSeconds === SPEECH_MAX_RECORDING_SECONDS, String(migrated.maxRecordingSeconds))
check('streaming preview defaults on for existing installs', migrated.streamingPreview === true)
check('a streaming segment length is present', Number.isSafeInteger(migrated.segmentSeconds), String(migrated.segmentSeconds))
for (const [stored, expected] of [['zh-CN', 'zh'], ['en-US', 'en'], ['yue', 'yue'], ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['auto', ''], ['', ''], ['fr-FR', '']]) {
  check(`language ${JSON.stringify(stored)} → ${JSON.stringify(expected)}`, normalizeSpeechLanguage(stored) === expected, normalizeSpeechLanguage(stored))
}

// --- 8. the silence auto-stop window ---------------------------------------
check('the auto-stop defaults on for existing installs', migrated.autoStopSeconds === DEFAULT_AUTO_STOP_SECONDS, String(migrated.autoStopSeconds))
check('a stored auto-stop window survives normalization', normalizeSettings({ autoStopSeconds: 25 }).autoStopSeconds === 25)
check('0 disables the auto-stop and is preserved', normalizeSettings({ autoStopSeconds: 0 }).autoStopSeconds === 0)
check('an unusable auto-stop window is repaired', normalizeSettings({ autoStopSeconds: 1 }).autoStopSeconds === DEFAULT_AUTO_STOP_SECONDS)
check('validateSettings rejects a 1 s auto-stop window', rejects(() => validateSettings({ ...DEFAULT_SETTINGS, autoStopSeconds: 1 })))
check('validateSettings accepts 0 and the ceiling', (() => {
  validateSettings({ ...DEFAULT_SETTINGS, autoStopSeconds: 0 })
  validateSettings({ ...DEFAULT_SETTINGS, autoStopSeconds: MAX_AUTO_STOP_SECONDS })
  return true
})())

// --- 9. the countdown contract the status bar renders ----------------------
const watch = new SilenceWatch(DEFAULT_AUTO_STOP_SECONDS, TICK_MS / 1000)
const framesPerSecond = 1000 / TICK_MS
let reading = watch.observe(false)
check('the countdown does not run before the first sound', reading.remainingSeconds === null && !reading.elapsed, String(reading.remainingSeconds))
reading = watch.observe(true)
check('the first sound arms the whole window', reading.remainingSeconds === DEFAULT_AUTO_STOP_SECONDS && !reading.elapsed, String(reading.remainingSeconds))
let quietFrames = 0
while (!reading.elapsed && quietFrames < 10 * DEFAULT_AUTO_STOP_SECONDS * framesPerSecond) {
  reading = watch.observe(false)
  quietFrames += 1
}
check(
  'it fires after exactly the configured silence',
  reading.elapsed && quietFrames === DEFAULT_AUTO_STOP_SECONDS * framesPerSecond,
  `${quietFrames} frames`
)
const resumed = watch.observe(true)
check('a new sound resets the countdown', !resumed.elapsed && resumed.remainingSeconds === DEFAULT_AUTO_STOP_SECONDS, String(resumed.remainingSeconds))

const disabled = new SilenceWatch(0, TICK_MS / 1000)
disabled.observe(true)
let disabledReading = disabled.observe(false)
for (let index = 0; index < 10 * framesPerSecond; index += 1) disabledReading = disabled.observe(false)
check('a disabled auto-stop never fires', !disabledReading.elapsed && disabledReading.remainingSeconds === null, String(disabledReading.remainingSeconds))

if (failures.length > 0) {
  console.error(`\n${failures.length} speech audio check(s) failed — recordings would be rejected by dsh, or silently send the wrong layout.`)
  process.exit(1)
}
console.log(`\nOK  ${authoritative === undefined ? 'local checks only' : 'cross-checked against dsh'} · ceiling ${SPEECH_MAX_RECORDING_SECONDS}s`)

function rejects(run: () => unknown): boolean {
  try {
    run()
    return false
  } catch {
    return true
  }
}
