import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type SpeechStatusView, type SpeechTranscriptView } from '../config.js';
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
export declare class BetterInputSpeechService extends TypertRemoteService {
    constructor(ctx: Context);
    /**
     * Read the recognizer roster and readiness for the settings page.
     *
     * Never throws: an uncomposed or provider-less speech service is reported as
     * `available: false` so the settings page can explain the situation instead
     * of showing a failed request.
     */
    speechStatus(): Promise<SpeechStatusView>;
    /**
     * Start or join dsh's provider-owned preparation task, then report the
     * resulting state.
     *
     * Preparation is Host-owned and is not tied to the browser connection, so
     * this only starts it; progress is observed by polling `speechStatus()`.
     */
    speechPrepare(providerId: string): Promise<SpeechStatusView>;
    /**
     * Transcribe one complete recording.
     *
     * `language` may be empty (automatic detection) or one of the provider's
     * advertised hints; anything else is normalized rather than forwarded, since
     * `resolve()` rejects an unadvertised language outright.
     */
    transcribeSpeech(audioBase64: string, language: string, signal: AbortSignal): Promise<SpeechTranscriptView>;
    /** `undefined` when the speech bundle is not part of the running composition. */
    private speech;
}
