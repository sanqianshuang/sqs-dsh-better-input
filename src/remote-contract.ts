import { z } from 'zod'
import type { BetterInputSettings, BetterInputSettingsPatch, BetterInputSettingsView, PolishRoute } from './config.js'

export const textSchema = z.string()

export const booleanSchema = z.boolean().optional()

/**
 * The settings document, as it crosses the wire.
 *
 * **Every** key of `BetterInputSettings` must appear here, and every key must
 * also be patchable below. The gateway runs these schemas over incoming
 * arguments (`decode()` → `codec.create().parse(value)`) and passes the *parsed
 * result* to the service, and a zod object **strips** undeclared keys — so a
 * setting missing from `betterInputSettingsPatchSchema` is silently dropped on
 * its way into `updateSettings`. The RPC still answers `ok`, the local draft is
 * cleared as if it saved, and the value reverts on the next read. That is
 * exactly how `autoStopSeconds` was lost (fixed in `0.2.0-rc.2-sqs.4`). Guard:
 * `npm run check:routes` (§1) compares all three lists.
 */
export const betterInputSettingsSchema = z.object({
  language: z.string(),
  maxRecordingSeconds: z.number(),
  streamingPreview: z.boolean(),
  segmentSeconds: z.number(),
  autoStopSeconds: z.number(),
  polishingEnabled: z.boolean(),
  polishFollowInputModel: z.boolean(),
  polishProvider: z.string(),
  polishModel: z.string(),
  polishReasoningEffort: z.string(),
  polishPrompt: z.string(),
  optimizeFollowInputModel: z.boolean(),
  optimizeProvider: z.string(),
  optimizeModel: z.string(),
  optimizeReasoningEffort: z.string(),
  optimizePrompt: z.string(),
  contextTurns: z.number()
})

export const betterInputSettingsPatchSchema = z.object({
  language: z.string().optional(),
  maxRecordingSeconds: z.number().optional(),
  streamingPreview: z.boolean().optional(),
  segmentSeconds: z.number().optional(),
  autoStopSeconds: z.number().optional(),
  polishingEnabled: z.boolean().optional(),
  polishFollowInputModel: z.boolean().optional(),
  polishProvider: z.string().optional(),
  polishModel: z.string().optional(),
  polishReasoningEffort: z.string().optional(),
  polishPrompt: z.string().optional(),
  optimizeFollowInputModel: z.boolean().optional(),
  optimizeProvider: z.string().optional(),
  optimizeModel: z.string().optional(),
  optimizeReasoningEffort: z.string().optional(),
  optimizePrompt: z.string().optional(),
  contextTurns: z.number().optional()
})

export const betterInputSettingsViewSchema = z.object({
  available: z.boolean(),
  writable: z.boolean(),
  settings: betterInputSettingsSchema,
  overridden: z.array(z.string()),
  defaultRoute: z.object({ provider: z.string(), model: z.string() }).nullable(),
  defaultPolishPrompt: z.string(),
  defaultOptimizePrompt: z.string()
})

export const reasoningEffortSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional()
})

export const resolveModelEffortsResultSchema = z.object({
  efforts: z.array(reasoningEffortSchema),
  defaultEffort: z.string().optional()
})

/**
 * The route an assist will actually call, resolved on the **Host**.
 *
 * `source` records which input won, so the browser can render an honest follow
 * row and a failure can be attributed instead of guessed at:
 *
 *   - `composer` — the Session's live model selection.
 *   - `settings` — the route configured for the feature (follow is off, or the
 *     composer's selection is genuinely unavailable).
 *   - `none`     — neither side named a usable route.
 *
 * The Host answers this because it owns both inputs: the settings document it
 * reads itself, and the Session's selection, which reaches it through the
 * session controller. The browser's own copy of the composer selection is a
 * render-time snapshot (see `src/client/composer-model.ts`) and must never be
 * the last word on which model a request is billed to.
 */
export const assistRouteViewSchema = z.object({
  provider: z.string(),
  model: z.string(),
  /** Thinking tier for the assist; `''` means the plugin's "thinking off" default. */
  reasoningEffort: z.string(),
  source: z.enum(['composer', 'settings', 'none'])
})

export const polishRouteSchema = z.object({
  provider: z.string(),
  providerName: z.string(),
  model: z.string(),
  modelName: z.string(),
  reasoningEfforts: z.array(reasoningEffortSchema),
  defaultReasoningEffort: z.string().optional()
})

export const listRoutesResultSchema = z.array(polishRouteSchema)

export const polishResultSchema = z.string()

export const optimizeResultSchema = z.string()

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number()
})

export const templateInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
  tags: z.array(z.string()).optional()
})

export const templateListResultSchema = z.object({
  templates: z.array(templateSchema)
})

export const templateSaveResultSchema = z.object({
  template: templateSchema
})

export const templateRemoveResultSchema = z.object({
  removed: z.boolean()
})

export const aboutInfoSchema = z.object({
  repository: z.string(),
  repositorySlug: z.string(),
  version: z.string(),
  license: z.string(),
  updateCommand: z.string(),
  updateCommandNpx: z.string()
})

/**
 * Speech schemas.
 *
 * `transcribeSpeech` carries one complete recording as base64. The Host
 * validates size and the canonical WAV header itself (`src/speech/wave.ts`)
 * before the bytes reach dsh's speech service.
 */
export const transcribeSpeechRequestSchema = z.object({
  audioBase64: z.string(),
  language: z.string()
})

export const speechTranscriptSchema = z.object({
  text: z.string(),
  audioSeconds: z.number(),
  inferenceSeconds: z.number()
})

export const speechProviderStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  languages: z.array(z.string()),
  preparation: z.string(),
  detail: z.string()
})

export const speechStatusSchema = z.object({
  service: z.boolean(),
  available: z.boolean(),
  providers: z.array(speechProviderStatusSchema),
  selection: z.object({ providerId: z.string(), language: z.string() }).nullable(),
  maxRecordingSeconds: z.number(),
  detail: z.string()
})

export const speechPrepareRequestSchema = z.object({
  providerId: z.string()
})

export const updateCheckResultSchema = z.object({
  status: z.enum(['up-to-date', 'update-available', 'unpublished', 'error']),
  installed: z.string(),
  latest: z.string().nullable(),
  updateCommand: z.string(),
  updateCommandNpx: z.string()
})

export type AboutInfoWire = z.infer<typeof aboutInfoSchema>
export type UpdateCheckResultWire = z.infer<typeof updateCheckResultSchema>
export type TemplateWire = z.infer<typeof templateSchema>
export type TemplateInputWire = z.infer<typeof templateInputSchema>

export type BetterInputSettingsWire = z.infer<typeof betterInputSettingsSchema>
export type BetterInputSettingsPatchWire = z.infer<typeof betterInputSettingsPatchSchema>
export type BetterInputSettingsViewWire = z.infer<typeof betterInputSettingsViewSchema>
export type PolishRouteWire = z.infer<typeof polishRouteSchema>
export type ReasoningEffortWire = z.infer<typeof reasoningEffortSchema>
export type ResolveModelEffortsResultWire = z.infer<typeof resolveModelEffortsResultSchema>
export type AssistRouteView = z.infer<typeof assistRouteViewSchema>
export type SpeechTranscriptWire = z.infer<typeof speechTranscriptSchema>
export type SpeechStatusWire = z.infer<typeof speechStatusSchema>
export type SpeechProviderStatusWire = z.infer<typeof speechProviderStatusSchema>
export type { BetterInputSettings, BetterInputSettingsPatch, BetterInputSettingsView, PolishRoute, ReasoningEffortInfo, SpeechProviderStatus, SpeechStatusView, SpeechTranscriptView } from './config.js'
