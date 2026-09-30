import { n as PACKAGE_NAME } from "./identity-CzaR1Taa.js";
//#region src/remote.ts
/**
* Build one strict codec for the CLIENT face.
*
* The client face exists only to describe the wire shape to
* `ctx.remote.$mount`; the actual byte validation happens on the Host. This is
* not an assumption — it is how dsh is wired (verified as recently as
* 0.2.0-rc.2; the client carrier below is byte-identical to 0.1.7-rc.2):
*
*   - `@deepseek-ai/dsh-api-gateway/lib/index.js` (Host) is the ONLY place that
*     runs `codec.create().parse(value)`. Validation lives in `decode()`.
*   - `…/lib/client.js` contains ZERO `.create()` calls. Its `$mount` path only
*     calls `requireStrictCodecs`, which inspects `codec.mode === 'strict'` and
*     never reads `typeSymbol` or invokes the factory. `prepareInvocation()`
*     forwards raw argument values straight to the RPC carrier.
*
* So materializing a real schema in the browser is pure dead weight: it pulls
* all of zod (~280 KB) into `lib/client.js` for a factory that is never called.
* The `create()` here is therefore lazy AND schema-free — it never imports zod.
*
* The eager `import { …Schema } from './remote-contract.js'` that used to sit
* at the top of this file was the single value-reachability edge that dragged
* zod into the browser bundle, because `src/client/index.ts` needs
* `TYPERT_REMOTE` as a value.
*
* The placeholder satisfies `TypertSchema` ({ parse(value) }) structurally, so
* the client face still typechecks. It is unreachable at runtime; if a future
* dsh ever validates on the client, `parse` throws loudly instead of silently
* accepting bad bytes. The Host manifest in `typert.ts` keeps the real zod
* schemas.
*/
function codec(typeSymbol) {
	return {
		mode: "strict",
		typeSymbol,
		create: () => ({ parse(value) {
			throw new Error(`sqs-dsh-better-input: client-face codec ${typeSymbol} was materialized. The client must never validate wire bytes (the Host does). If this fires, the client-face descriptor is being used for validation it should not own.`);
		} })
	};
}
/** Type symbol for one of this plugin's own wire types. */
const symbol = (name) => `${PACKAGE_NAME}#${name}`;
/** The client-face Typert manifest; mirrors the Host face in `typert.ts`. */
const TYPERT_REMOTE = {
	package: PACKAGE_NAME,
	descriptors: [
		{
			id: `${PACKAGE_NAME}#betterInput/getSettings`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "getSettings",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("BetterInputSettingsView"))
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
				codec: codec(symbol("BetterInputSettingsPatch"))
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("BetterInputSettingsView"))
		},
		{
			id: `${PACKAGE_NAME}#betterInput/listRoutes`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "listRoutes",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("PolishRoute[]"))
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
				codec: codec("string")
			}, {
				name: "model",
				wire: "model",
				source: "json",
				codec: codec("string")
			}],
			result: codec(symbol("ResolveModelEffortsResult"))
		},
		{
			id: `${PACKAGE_NAME}#betterInput/getAbout`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "getAbout",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("AboutInfo"))
		},
		{
			id: `${PACKAGE_NAME}#betterInput/checkForUpdate`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "checkForUpdate",
			invocation: { kind: "direct" },
			parameters: [],
			cancellation: { parameter: "signal" },
			result: codec(symbol("UpdateCheckResult"))
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
					codec: codec("string")
				},
				{
					name: "provider",
					wire: "provider",
					source: "json",
					codec: codec("string")
				},
				{
					name: "model",
					wire: "model",
					source: "json",
					codec: codec("string")
				}
			],
			cancellation: { parameter: "signal" },
			result: codec("string")
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
					codec: codec("string")
				},
				{
					name: "provider",
					wire: "provider",
					source: "json",
					codec: codec("string")
				},
				{
					name: "model",
					wire: "model",
					source: "json",
					codec: codec("string")
				},
				{
					name: "context",
					wire: "context",
					source: "json",
					codec: codec("string")
				}
			],
			cancellation: { parameter: "signal" },
			result: codec("string")
		},
		{
			id: `${PACKAGE_NAME}#betterInput/templatesList`,
			service: "BetterInputPolish",
			namespace: "betterInput",
			method: "templatesList",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("TemplateListResult"))
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
				codec: codec(symbol("TemplateInput"))
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("TemplateSaveResult"))
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
				codec: codec("string")
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("TemplateRemoveResult"))
		},
		{
			id: `${PACKAGE_NAME}#betterInput/speechStatus`,
			service: "BetterInputSpeech",
			namespace: "betterInput",
			method: "speechStatus",
			invocation: { kind: "direct" },
			parameters: [],
			result: codec(symbol("SpeechStatusView"))
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
				codec: codec("string")
			}],
			result: codec(symbol("SpeechStatusView"))
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
				codec: codec("string")
			}, {
				name: "language",
				wire: "language",
				source: "json",
				codec: codec("string")
			}],
			cancellation: { parameter: "signal" },
			result: codec(symbol("SpeechTranscriptView"))
		}
	]
};
//#endregion
export { TYPERT_REMOTE, TYPERT_REMOTE as default };

//# sourceMappingURL=remote.js.map