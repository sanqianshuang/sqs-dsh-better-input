import type { Context } from '@deepseek-ai/cordis'
import { BetterInputPolishService } from './polish/service.js'
import { BetterInputSpeechService } from './speech/service.js'

export const name = 'sqs-dsh-better-input'

/**
 * Host half of sqs-dsh-better-input.
 *
 * Two services back the browser half:
 *
 * - `BetterInputPolishService` (namespace `betterInput`) owns dsh route
 *   discovery, transcript polishing, prompt optimization and the template
 *   library, reusing dsh's own LLM routes and credentials.
 * - `BetterInputSpeechService` (same namespace) is the intake for the native
 *   recognizers: it validates 16 kHz mono PCM16 WAV and hands the audio to
 *   dsh's own speech service, whose local SenseVoice provider transcribes it on
 *   this machine. dsh's speech service is looked up lazily, so a composition
 *   without the optional voice-input bundle still activates this plugin.
 */
export async function apply(ctx: Context): Promise<void> {
  await ctx.plugin(BetterInputPolishService)
  await ctx.plugin(BetterInputSpeechService)

  ctx.effect(() => {
    return () => undefined
  }, 'sqs-dsh-better-input lifecycle')
}
