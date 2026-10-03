import { z } from 'zod';
export declare const textSchema: z.ZodString;
export declare const booleanSchema: z.ZodOptional<z.ZodBoolean>;
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
export declare const betterInputSettingsSchema: z.ZodObject<{
    language: z.ZodString;
    maxRecordingSeconds: z.ZodNumber;
    streamingPreview: z.ZodBoolean;
    segmentSeconds: z.ZodNumber;
    autoStopSeconds: z.ZodNumber;
    polishingEnabled: z.ZodBoolean;
    polishFollowInputModel: z.ZodBoolean;
    polishProvider: z.ZodString;
    polishModel: z.ZodString;
    polishReasoningEffort: z.ZodString;
    polishPrompt: z.ZodString;
    optimizeFollowInputModel: z.ZodBoolean;
    optimizeProvider: z.ZodString;
    optimizeModel: z.ZodString;
    optimizeReasoningEffort: z.ZodString;
    optimizePrompt: z.ZodString;
    contextTurns: z.ZodNumber;
}, z.core.$strip>;
export declare const betterInputSettingsPatchSchema: z.ZodObject<{
    language: z.ZodOptional<z.ZodString>;
    maxRecordingSeconds: z.ZodOptional<z.ZodNumber>;
    streamingPreview: z.ZodOptional<z.ZodBoolean>;
    segmentSeconds: z.ZodOptional<z.ZodNumber>;
    autoStopSeconds: z.ZodOptional<z.ZodNumber>;
    polishingEnabled: z.ZodOptional<z.ZodBoolean>;
    polishFollowInputModel: z.ZodOptional<z.ZodBoolean>;
    polishProvider: z.ZodOptional<z.ZodString>;
    polishModel: z.ZodOptional<z.ZodString>;
    polishReasoningEffort: z.ZodOptional<z.ZodString>;
    polishPrompt: z.ZodOptional<z.ZodString>;
    optimizeFollowInputModel: z.ZodOptional<z.ZodBoolean>;
    optimizeProvider: z.ZodOptional<z.ZodString>;
    optimizeModel: z.ZodOptional<z.ZodString>;
    optimizeReasoningEffort: z.ZodOptional<z.ZodString>;
    optimizePrompt: z.ZodOptional<z.ZodString>;
    contextTurns: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const betterInputSettingsViewSchema: z.ZodObject<{
    available: z.ZodBoolean;
    writable: z.ZodBoolean;
    settings: z.ZodObject<{
        language: z.ZodString;
        maxRecordingSeconds: z.ZodNumber;
        streamingPreview: z.ZodBoolean;
        segmentSeconds: z.ZodNumber;
        autoStopSeconds: z.ZodNumber;
        polishingEnabled: z.ZodBoolean;
        polishFollowInputModel: z.ZodBoolean;
        polishProvider: z.ZodString;
        polishModel: z.ZodString;
        polishReasoningEffort: z.ZodString;
        polishPrompt: z.ZodString;
        optimizeFollowInputModel: z.ZodBoolean;
        optimizeProvider: z.ZodString;
        optimizeModel: z.ZodString;
        optimizeReasoningEffort: z.ZodString;
        optimizePrompt: z.ZodString;
        contextTurns: z.ZodNumber;
    }, z.core.$strip>;
    overridden: z.ZodArray<z.ZodString>;
    defaultRoute: z.ZodNullable<z.ZodObject<{
        provider: z.ZodString;
        model: z.ZodString;
    }, z.core.$strip>>;
    defaultPolishPrompt: z.ZodString;
    defaultOptimizePrompt: z.ZodString;
}, z.core.$strip>;
export declare const reasoningEffortSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const resolveModelEffortsResultSchema: z.ZodObject<{
    efforts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    defaultEffort: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
export declare const assistRouteViewSchema: z.ZodObject<{
    provider: z.ZodString;
    model: z.ZodString;
    reasoningEffort: z.ZodString;
    source: z.ZodEnum<{
        settings: "settings";
        composer: "composer";
        none: "none";
    }>;
}, z.core.$strip>;
export declare const polishRouteSchema: z.ZodObject<{
    provider: z.ZodString;
    providerName: z.ZodString;
    model: z.ZodString;
    modelName: z.ZodString;
    reasoningEfforts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    defaultReasoningEffort: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const listRoutesResultSchema: z.ZodArray<z.ZodObject<{
    provider: z.ZodString;
    providerName: z.ZodString;
    model: z.ZodString;
    modelName: z.ZodString;
    reasoningEfforts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    defaultReasoningEffort: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const polishResultSchema: z.ZodString;
export declare const optimizeResultSchema: z.ZodString;
export declare const templateSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    content: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strip>;
export declare const templateInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const templateListResultSchema: z.ZodObject<{
    templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        content: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const templateSaveResultSchema: z.ZodObject<{
    template: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        content: z.ZodString;
        tags: z.ZodArray<z.ZodString>;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const templateRemoveResultSchema: z.ZodObject<{
    removed: z.ZodBoolean;
}, z.core.$strip>;
export declare const aboutInfoSchema: z.ZodObject<{
    repository: z.ZodString;
    repositorySlug: z.ZodString;
    version: z.ZodString;
    license: z.ZodString;
    updateCommand: z.ZodString;
    updateCommandNpx: z.ZodString;
}, z.core.$strip>;
/**
 * Speech schemas.
 *
 * `transcribeSpeech` carries one complete recording as base64. The Host
 * validates size and the canonical WAV header itself (`src/speech/wave.ts`)
 * before the bytes reach dsh's speech service.
 */
export declare const transcribeSpeechRequestSchema: z.ZodObject<{
    audioBase64: z.ZodString;
    language: z.ZodString;
}, z.core.$strip>;
export declare const speechTranscriptSchema: z.ZodObject<{
    text: z.ZodString;
    audioSeconds: z.ZodNumber;
    inferenceSeconds: z.ZodNumber;
}, z.core.$strip>;
export declare const speechProviderStatusSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    location: z.ZodString;
    languages: z.ZodArray<z.ZodString>;
    preparation: z.ZodString;
    detail: z.ZodString;
}, z.core.$strip>;
export declare const speechStatusSchema: z.ZodObject<{
    service: z.ZodBoolean;
    available: z.ZodBoolean;
    providers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        location: z.ZodString;
        languages: z.ZodArray<z.ZodString>;
        preparation: z.ZodString;
        detail: z.ZodString;
    }, z.core.$strip>>;
    selection: z.ZodNullable<z.ZodObject<{
        providerId: z.ZodString;
        language: z.ZodString;
    }, z.core.$strip>>;
    maxRecordingSeconds: z.ZodNumber;
    detail: z.ZodString;
}, z.core.$strip>;
export declare const speechPrepareRequestSchema: z.ZodObject<{
    providerId: z.ZodString;
}, z.core.$strip>;
export declare const updateCheckResultSchema: z.ZodObject<{
    status: z.ZodEnum<{
        "up-to-date": "up-to-date";
        "update-available": "update-available";
        unpublished: "unpublished";
        error: "error";
    }>;
    installed: z.ZodString;
    latest: z.ZodNullable<z.ZodString>;
    updateCommand: z.ZodString;
    updateCommandNpx: z.ZodString;
}, z.core.$strip>;
export type AboutInfoWire = z.infer<typeof aboutInfoSchema>;
export type UpdateCheckResultWire = z.infer<typeof updateCheckResultSchema>;
export type TemplateWire = z.infer<typeof templateSchema>;
export type TemplateInputWire = z.infer<typeof templateInputSchema>;
export type BetterInputSettingsWire = z.infer<typeof betterInputSettingsSchema>;
export type BetterInputSettingsPatchWire = z.infer<typeof betterInputSettingsPatchSchema>;
export type BetterInputSettingsViewWire = z.infer<typeof betterInputSettingsViewSchema>;
export type PolishRouteWire = z.infer<typeof polishRouteSchema>;
export type ReasoningEffortWire = z.infer<typeof reasoningEffortSchema>;
export type ResolveModelEffortsResultWire = z.infer<typeof resolveModelEffortsResultSchema>;
export type AssistRouteView = z.infer<typeof assistRouteViewSchema>;
export type SpeechTranscriptWire = z.infer<typeof speechTranscriptSchema>;
export type SpeechStatusWire = z.infer<typeof speechStatusSchema>;
export type SpeechProviderStatusWire = z.infer<typeof speechProviderStatusSchema>;
export type { BetterInputSettings, BetterInputSettingsPatch, BetterInputSettingsView, PolishRoute, ReasoningEffortInfo, SpeechProviderStatus, SpeechStatusView, SpeechTranscriptView } from './config.js';
