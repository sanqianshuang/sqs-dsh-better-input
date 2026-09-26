import { t as PACKAGE_NAME } from "./identity-CJx2xczc.js";
import { z } from "zod";
//#region src/remote-contract.ts
const textSchema = z.string();
z.boolean().optional();
const betterInputSettingsSchema = z.object({
	language: z.string(),
	maxRecordingSeconds: z.number(),
	polishingEnabled: z.boolean(),
	polishProvider: z.string(),
	polishModel: z.string(),
	polishReasoningEffort: z.string(),
	polishPrompt: z.string(),
	optimizeEnabled: z.boolean(),
	optimizeProvider: z.string(),
	optimizeModel: z.string(),
	optimizeReasoningEffort: z.string(),
	optimizePrompt: z.string(),
	contextTurns: z.number()
});
const betterInputSettingsPatchSchema = z.object({
	language: z.string().optional(),
	maxRecordingSeconds: z.number().optional(),
	polishingEnabled: z.boolean().optional(),
	polishProvider: z.string().optional(),
	polishModel: z.string().optional(),
	polishReasoningEffort: z.string().optional(),
	polishPrompt: z.string().optional(),
	optimizeEnabled: z.boolean().optional(),
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
		}
	],
	/**
	* The typed-registry model block.
	*
	* This is REQUIRED by dsh 0.1.7's typert loader, not optional metadata:
	* `validateTypertManifest` reads `manifest.model` and demands an object whose
	* `services` / `events` / `objects` are arrays (see `dsh-typert-loader/lib/index.js`
	* :89-92, and `requireObject` at :119-122). A missing `model` fails the whole
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
					signature: "polish(transcript: string, provider: string, model: string, signal: AbortSignal): Promise<string>",
					summary: "Polish one transcript through a selected dsh route.",
					jsDoc: "/** Polish one transcript through a selected dsh route. */"
				},
				{
					kind: "method",
					name: "optimize",
					signature: "optimize(text: string, provider: string, model: string, context: string, signal: AbortSignal): Promise<string>",
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
					name: "BetterInputSettingsView",
					declaration: "export interface BetterInputSettingsView { available: boolean; writable: boolean; settings: BetterInputSettings; overridden: string[] }"
				},
				{
					name: "BetterInputSettingsPatch",
					declaration: "export type BetterInputSettingsPatch = Partial<BetterInputSettings>"
				},
				{
					name: "PolishRoute",
					declaration: "export interface ReasoningEffortInfo { id: string; name: string; description?: string } export interface PolishRoute { provider: string; providerName: string; model: string; modelName: string; reasoningEfforts: readonly ReasoningEffortInfo[]; defaultReasoningEffort?: string }"
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
		}],
		events: [],
		objects: []
	}
};
//#endregion
export { TYPERT, TYPERT as default };

//# sourceMappingURL=typert.js.map