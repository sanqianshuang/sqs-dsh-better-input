import { n as PACKAGE_NAME } from "./identity-CzaR1Taa.js";
import { z } from "zod";
//#region src/remote-contract.ts
const textSchema = z.string();
z.boolean().optional();
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
const betterInputSettingsSchema = z.object({
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
});
const betterInputSettingsPatchSchema = z.object({
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
});
const betterInputSettingsViewSchema = z.object({
	available: z.boolean(),
	writable: z.boolean(),
	settings: betterInputSettingsSchema,
	overridden: z.array(z.string()),
	defaultRoute: z.object({
		provider: z.string(),
		model: z.string()
	}).nullable(),
	defaultPolishPrompt: z.string(),
	defaultOptimizePrompt: z.string()
});
const reasoningEffortSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional()
});
const resolveModelEffortsResultSchema = z.object({
	efforts: z.array(reasoningEffortSchema),
	defaultEffort: z.string().optional()
});
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
const assistRouteViewSchema = z.object({
	provider: z.string(),
	model: z.string(),
	/** Thinking tier for the assist; `''` means the plugin's "thinking off" default. */
	reasoningEffort: z.string(),
	source: z.enum([
		"composer",
		"settings",
		"none"
	])
});
const polishRouteSchema = z.object({
	provider: z.string(),
	providerName: z.string(),
	model: z.string(),
	modelName: z.string(),
	reasoningEfforts: z.array(reasoningEffortSchema),
	defaultReasoningEffort: z.string().optional()
});
const listRoutesResultSchema = z.array(polishRouteSchema);
const polishResultSchema = z.string();
const optimizeResultSchema = z.string();
const templateSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	content: z.string(),
	tags: z.array(z.string()),
	createdAt: z.number(),
	updatedAt: z.number()
});
const templateInputSchema = z.object({
	id: z.string().optional(),
	name: z.string(),
	description: z.string().optional(),
	content: z.string(),
	tags: z.array(z.string()).optional()
});
const templateListResultSchema = z.object({ templates: z.array(templateSchema) });
const templateSaveResultSchema = z.object({ template: templateSchema });
const templateRemoveResultSchema = z.object({ removed: z.boolean() });
const aboutInfoSchema = z.object({
	repository: z.string(),
	repositorySlug: z.string(),
	version: z.string(),
	license: z.string(),
	updateCommand: z.string(),
	updateCommandNpx: z.string()
});
z.object({
	audioBase64: z.string(),
	language: z.string()
});
const speechTranscriptSchema = z.object({
	text: z.string(),
	audioSeconds: z.number(),
	inferenceSeconds: z.number()
});
const speechProviderStatusSchema = z.object({
	id: z.string(),
	name: z.string(),
	location: z.string(),
	languages: z.array(z.string()),
	preparation: z.string(),
	detail: z.string()
});
const speechStatusSchema = z.object({
	service: z.boolean(),
	available: z.boolean(),
	providers: z.array(speechProviderStatusSchema),
	selection: z.object({
		providerId: z.string(),
		language: z.string()
	}).nullable(),
	maxRecordingSeconds: z.number(),
	detail: z.string()
});
z.object({ providerId: z.string() });
const updateCheckResultSchema = z.object({
	status: z.enum([
		"up-to-date",
		"update-available",
		"unpublished",
		"error"
	]),
	installed: z.string(),
	latest: z.string().nullable(),
	updateCommand: z.string(),
	updateCommandNpx: z.string()
});
//#endregion
//#region src/typert.ts
/**
* Materialize one strict codec for a schema.
*
* dsh 0.1.7 tightened the Typert boundary: a `mode: 'strict'` codec must carry
* a lazy `create()` factory returning a runtime schema with a `parse()` method
* (see `TypertCodec` in `@deepseek-ai/dsh-typert-protocol`). Earlier dsh
* carried the schema directly on a `schema` property; 0.1.7 rejects that with
* "strict codec has no create() factory" and the whole entry then fails to
* activate, so the plugin never mounts.
*
* Zod schemas already satisfy the `TypertSchema` contract (`parse(value)`), so
* only deferral is needed. Memoized because the registry may call `create()`
* more than once.
*/
function codec(typeSymbol, schema) {
	let materialized;
	return {
		mode: "strict",
		typeSymbol,
		create: () => {
			materialized ??= schema;
			return materialized;
		}
	};
}
/** Type symbol for one of this plugin's own wire types. */
const symbol = (name) => `${PACKAGE_NAME}#${name}`;
/**
* The Host-side Typert manifest. It must mirror `TYPERT_REMOTE` (the client
* face) method-for-method; a mismatch is rejected at the boundary.
*/
const TYPERT = {
	package: PACKAGE_NAME,
	face: "host",
	schemas: [],
	invocations: [
		{
			id: `${PACKAGE_NAME}#betterInput/getSettings`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "getSettings",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("BetterInputSettingsView"), betterInputSettingsViewSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/updateSettings`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "updateSettings",
			invocation: { kind: "direct" },
			parameters: [{
				name: "patch",
				wire: "patch",
				source: "json",
				codec: codec(symbol("BetterInputSettingsPatch"), betterInputSettingsPatchSchema)
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("BetterInputSettingsView"), betterInputSettingsViewSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/listRoutes`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "listRoutes",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("PolishRoute[]"), listRoutesResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/resolveModelEfforts`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "resolveModelEfforts",
			invocation: { kind: "direct" },
			parameters: [{
				name: "provider",
				wire: "provider",
				source: "json",
				codec: codec("string", textSchema)
			}, {
				name: "model",
				wire: "model",
				source: "json",
				codec: codec("string", textSchema)
			}],
			result: codec(symbol("ResolveModelEffortsResult"), resolveModelEffortsResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/resolveAssistRoute`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "resolveAssistRoute",
			invocation: { kind: "direct" },
			parameters: [{
				name: "feature",
				wire: "feature",
				source: "json",
				codec: codec("string", textSchema)
			}, {
				name: "sessionId",
				wire: "sessionId",
				source: "json",
				codec: codec("string", textSchema)
			}],
			result: codec(symbol("AssistRouteView"), assistRouteViewSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/getAbout`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "getAbout",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("AboutInfo"), aboutInfoSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/checkForUpdate`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "checkForUpdate",
			invocation: { kind: "direct" },
			parameters: [],
			cancellation: { parameter: "signal" },
			result: codec(symbol("UpdateCheckResult"), updateCheckResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/polish`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "polish",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "transcript",
					wire: "transcript",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "provider",
					wire: "provider",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "model",
					wire: "model",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "effort",
					wire: "effort",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "sessionId",
					wire: "sessionId",
					source: "json",
					codec: codec("string", textSchema)
				}
			],
			cancellation: { parameter: "signal" },
			result: codec("string", polishResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/optimize`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "optimize",
			invocation: { kind: "direct" },
			parameters: [
				{
					name: "text",
					wire: "text",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "provider",
					wire: "provider",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "model",
					wire: "model",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "context",
					wire: "context",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "effort",
					wire: "effort",
					source: "json",
					codec: codec("string", textSchema)
				},
				{
					name: "sessionId",
					wire: "sessionId",
					source: "json",
					codec: codec("string", textSchema)
				}
			],
			cancellation: { parameter: "signal" },
			result: codec("string", optimizeResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/templatesList`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "templatesList",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("TemplateList"), templateListResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/templatesSave`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "templatesSave",
			invocation: { kind: "direct" },
			parameters: [{
				name: "template",
				wire: "template",
				source: "json",
				codec: codec(symbol("TemplateInput"), templateInputSchema)
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("TemplateSaveResult"), templateSaveResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/templatesRemove`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "templatesRemove",
			invocation: { kind: "direct" },
			parameters: [{
				name: "id",
				wire: "id",
				source: "json",
				codec: codec("string", textSchema)
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("TemplateRemoveResult"), templateRemoveResultSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/speechStatus`,
			service: "BetterInputSpeech",
			namespace: "betterInput",
			method: "speechStatus",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("SpeechStatusView"), speechStatusSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/speechPrepare`,
			service: "BetterInputSpeech",
			namespace: "betterInput",
			method: "speechPrepare",
			invocation: { kind: "direct" },
			parameters: [{
				name: "providerId",
				wire: "providerId",
				source: "json",
				codec: codec("string", textSchema)
			}],
			result: codec(symbol("SpeechStatusView"), speechStatusSchema)
		},
		{
			id: `${PACKAGE_NAME}#betterInput/transcribeSpeech`,
			service: "BetterInputSpeech",
			namespace: "betterInput",
			method: "transcribeSpeech",
			invocation: { kind: "direct" },
			parameters: [{
				name: "audioBase64",
				wire: "audioBase64",
				source: "json",
				codec: codec("string", textSchema)
			}, {
				name: "language",
				wire: "language",
				source: "json",
				codec: codec("string", textSchema)
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("SpeechTranscriptView"), speechTranscriptSchema)
		}
	],
	/**
	* The typed-registry model block.
	*
	* This is REQUIRED by dsh's typert loader, not optional metadata:
	* `validateTypertManifest` reads `manifest.model` and demands an object whose
	* `services` / `events` / `objects` are arrays (see `dsh-typert-loader/lib/index.js`
	* :89-92, and `requireObject` at :119-122 — unchanged in 0.2.0-rc.2). A missing
	* `model` fails the whole
	* entry with "typert-loader: <pkg> TYPERT.model must be an object", the entry
	* never activates, and the browser web boot then refuses to render the UI.
	*
	* Removing the file-input / OCR feature dropped this block by accident in
	* 0.1.0-0.1.2 (`convertFile` and `ConvertFileResult` were the only intended
	* deletions). Keep `model` in sync with `invocations` above and with the
	* service surface in `polish/service.ts`.
	*/
	model: {
		services: [{
			description: "Host-side dsh route discovery and transcript polishing.",
			summary: "Voice transcript polishing service.",
			tags: [],
			jsDoc: "/** Host-side dsh route discovery and transcript polishing. */",
			key: "BetterInputPolish",
			exportName: "BetterInputPolishService",
			members: [
				{
					kind: "method",
					name: "getSettings",
					signature: "getSettings(): BetterInputSettingsView",
					summary: "Read the current plugin settings.",
					jsDoc: "/** Read the current plugin settings. */"
				},
				{
					kind: "method",
					name: "updateSettings",
					signature: "updateSettings(patch: BetterInputSettingsPatch, signal: AbortSignal): Promise<BetterInputSettingsView>",
					summary: "Update plugin settings when the request has not been cancelled.",
					jsDoc: "/** Update plugin settings when the request has not been cancelled. */"
				},
				{
					kind: "method",
					name: "listRoutes",
					signature: "listRoutes(): Promise<PolishRoute[]>",
					summary: "List models already registered in dsh.",
					jsDoc: "/** List models already registered in dsh. */"
				},
				{
					kind: "method",
					name: "resolveModelEfforts",
					signature: "resolveModelEfforts(provider: string, model: string): Promise<{ efforts: readonly ReasoningEffortInfo[]; defaultEffort?: string }>",
					summary: "Resolve reasoning-effort tiers for one route (lazy).",
					jsDoc: "/** Resolve reasoning-effort tiers for one route (lazy). */"
				},
				{
					kind: "method",
					name: "resolveAssistRoute",
					signature: "resolveAssistRoute(feature: string, sessionId: string): Promise<AssistRouteView>",
					summary: "Resolve the model route an assist will call, from the Host side.",
					jsDoc: "/** Resolve the model route an assist will call, from the Host side. */"
				},
				{
					kind: "method",
					name: "getAbout",
					signature: "getAbout(): AboutInfo",
					summary: "Read the installed plugin identity and repository info.",
					jsDoc: "/** Read the installed plugin identity and repository info. */"
				},
				{
					kind: "method",
					name: "checkForUpdate",
					signature: "checkForUpdate(signal: AbortSignal): Promise<UpdateCheckResult>",
					summary: "Check the npm registry for the latest published version.",
					jsDoc: "/** Check the npm registry for the latest published version. */"
				},
				{
					kind: "method",
					name: "polish",
					signature: "polish(transcript: string, provider: string, model: string, effort: string, sessionId: string, signal: AbortSignal): Promise<string>",
					summary: "Polish one transcript through a selected dsh route.",
					jsDoc: "/** Polish one transcript through a selected dsh route. */"
				},
				{
					kind: "method",
					name: "optimize",
					signature: "optimize(text: string, provider: string, model: string, context: string, effort: string, sessionId: string, signal: AbortSignal): Promise<string>",
					summary: "Optimize one prompt through a selected dsh route.",
					jsDoc: "/** Optimize one prompt through a selected dsh route. */"
				},
				{
					kind: "method",
					name: "templatesList",
					signature: "templatesList(): Promise<TemplateListResult>",
					summary: "List all saved prompt templates, newest first.",
					jsDoc: "/** List all saved prompt templates, newest first. */"
				},
				{
					kind: "method",
					name: "templatesSave",
					signature: "templatesSave(template: TemplateInput, signal: AbortSignal): Promise<TemplateSaveResult>",
					summary: "Create or update one prompt template on the Host filesystem.",
					jsDoc: "/** Create or update one prompt template on the Host filesystem. */"
				},
				{
					kind: "method",
					name: "templatesRemove",
					signature: "templatesRemove(id: string, signal: AbortSignal): Promise<TemplateRemoveResult>",
					summary: "Remove one prompt template by id.",
					jsDoc: "/** Remove one prompt template by id. */"
				}
			],
			types: [
				{
					name: "ComposerModelRoute",
					declaration: "export interface ComposerModelRoute { readonly provider: string; readonly model: string }"
				},
				{
					name: "EffectiveModelRoute",
					declaration: "export interface EffectiveModelRoute { readonly provider: string; readonly model: string; readonly reasoningEffort: string }"
				},
				{
					name: "BetterInputSettings",
					declaration: "export interface BetterInputSettings { language: string; maxRecordingSeconds: number; streamingPreview: boolean; segmentSeconds: number; autoStopSeconds: number; polishingEnabled: boolean; polishFollowInputModel: boolean; polishProvider: string; polishModel: string; polishReasoningEffort: string; polishPrompt: string; optimizeFollowInputModel: boolean; optimizeProvider: string; optimizeModel: string; optimizeReasoningEffort: string; optimizePrompt: string; contextTurns: number }"
				},
				{
					name: "BetterInputSettingsView",
					declaration: "export interface BetterInputSettingsView { available: boolean; writable: boolean; settings: BetterInputSettings; overridden: string[]; defaultRoute: ComposerModelRoute | null; defaultPolishPrompt: string; defaultOptimizePrompt: string }"
				},
				{
					name: "BetterInputSettingsPatch",
					declaration: "export type BetterInputSettingsPatch = Partial<BetterInputSettings>"
				},
				{
					name: "ReasoningEffortInfo",
					declaration: "export interface ReasoningEffortInfo { id: string; name: string; description?: string }"
				},
				{
					name: "PolishRoute",
					declaration: "export interface PolishRoute { provider: string; providerName: string; model: string; modelName: string; reasoningEfforts: readonly ReasoningEffortInfo[]; defaultReasoningEffort?: string }"
				},
				{
					name: "AssistRouteView",
					declaration: "export interface AssistRouteView { provider: string; model: string; reasoningEffort: string; source: 'composer' | 'settings' | 'none' }"
				},
				{
					name: "AboutInfo",
					declaration: "export interface AboutInfo { repository: string; repositorySlug: string; version: string; license: string; updateCommand: string; updateCommandNpx: string }"
				},
				{
					name: "UpdateCheckResult",
					declaration: "export type UpdateCheckResult = { status: 'up-to-date' | 'update-available' | 'unpublished' | 'error'; installed: string; latest: string | null; updateCommand: string; updateCommandNpx: string }"
				},
				{
					name: "BetterInputTemplate",
					declaration: "export interface BetterInputTemplate { id: string; name: string; description: string; content: string; tags: readonly string[]; createdAt: number; updatedAt: number }"
				},
				{
					name: "TemplateInput",
					declaration: "export interface TemplateInput { id?: string; name: string; description?: string; content: string; tags?: readonly string[] }"
				},
				{
					name: "TemplateListResult",
					declaration: "export interface TemplateListResult { templates: readonly BetterInputTemplate[] }"
				},
				{
					name: "TemplateSaveResult",
					declaration: "export interface TemplateSaveResult { template: BetterInputTemplate }"
				},
				{
					name: "TemplateRemoveResult",
					declaration: "export interface TemplateRemoveResult { removed: boolean }"
				}
			]
		}, {
			description: "Host-side intake for the native dsh recognizers.",
			summary: "Native speech transcription service.",
			tags: [],
			jsDoc: "/** Host-side intake for the native dsh recognizers. */",
			key: "BetterInputSpeech",
			exportName: "BetterInputSpeechService",
			members: [
				{
					kind: "method",
					name: "speechStatus",
					signature: "speechStatus(): Promise<SpeechStatusView>",
					summary: "Read the registered dsh recognizers and their readiness.",
					jsDoc: "/** Read the registered dsh recognizers and their readiness. */"
				},
				{
					kind: "method",
					name: "speechPrepare",
					signature: "speechPrepare(providerId: string): Promise<SpeechStatusView>",
					summary: "Start or join dsh-owned recognizer preparation.",
					jsDoc: "/** Start or join dsh-owned recognizer preparation. */"
				},
				{
					kind: "method",
					name: "transcribeSpeech",
					signature: "transcribeSpeech(audioBase64: string, language: string, signal: AbortSignal): Promise<SpeechTranscriptView>",
					summary: "Transcribe one complete 16 kHz mono PCM16 WAV recording.",
					jsDoc: "/** Transcribe one complete 16 kHz mono PCM16 WAV recording. */"
				}
			],
			types: [
				{
					name: "SpeechProviderStatus",
					declaration: "export interface SpeechProviderStatus { id: string; name: string; location: string; languages: readonly string[]; preparation: string; detail: string }"
				},
				{
					name: "SpeechStatusView",
					declaration: "export interface SpeechStatusView { service: boolean; available: boolean; providers: readonly SpeechProviderStatus[]; selection: { providerId: string; language: string } | null; maxRecordingSeconds: number; detail: string }"
				},
				{
					name: "SpeechTranscriptView",
					declaration: "export interface SpeechTranscriptView { readonly text: string; readonly audioSeconds: number; readonly inferenceSeconds: number }"
				}
			]
		}],
		events: [],
		objects: []
	}
};
//#endregion
export { TYPERT, TYPERT as default };

//# sourceMappingURL=typert.js.map