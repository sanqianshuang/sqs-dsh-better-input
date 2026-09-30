window.__ModuleLoader__.load({
	id: "sqs-dsh-better-input",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/identity.ts
		/**
		* Single source of truth for this package's identity.
		*
		* Every externally visible name (the Typert package key, the npm package name
		* used by the update check, the settings namespace) derives from here so a
		* rename never leaves a stale literal behind.
		*/
		/** Stable identifier for this fork. Used as the Typert package key. */
		const PACKAGE_NAME = "sqs-dsh-better-input";
		//#endregion
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
		//#region src/client/strings.ts
		const zh = {
			voiceStart: "语音输入",
			voiceStop: "停止语音输入",
			voiceBusy: "正在处理…",
			voicePermissionDenied: "麦克风权限被拒绝",
			voiceCaptureUnavailable: "无法访问麦克风（需要 HTTPS 或 localhost）",
			listening: "正在聆听…",
			voiceCancel: "取消",
			autoStopIn: "{seconds} 秒后自动停止",
			autoStopTitle: "说完后静音 {seconds} 秒会自动停止并开始转写",
			autoStopLabel: "静音自动停止（秒）",
			autoStopHint: "说话后静音这么久就自动停止并开始转写；0 为关闭。默认 10 秒；关闭后只受“单次录音上限”约束。",
			transcribing: "正在转写…",
			polishing: "正在润色…",
			voiceFailed: "语音输入失败",
			polishNotConfigured: "未配置润色模型，请在设置页选择",
			polishFailedKeepOriginal: "润色失败，已保留原文",
			settingsTitle: "BetterInput 设置",
			settingsDescription: "配置语音识别与 AI 润色。润色复用你在 dsh 设置里已配置的模型，无需额外 API key。",
			loading: "加载中…",
			saveFailed: "保存失败，请重试",
			languageLabel: "识别语言",
			languageHint: "由 dsh 本地识别器（SenseVoice）提供，选「自动检测」时由模型判断语种。",
			languageAuto: "自动检测",
			languageCantonese: "粤语",
			speechStatusLabel: "本地识别器",
			speechStatusReady: "已就绪",
			speechStatusUnavailable: "不可用",
			speechStatusPreparing: "准备中",
			speechPrepareButton: "下载并准备模型",
			speechPrepareBusy: "准备中…",
			recordingLimitLabel: "单次录音上限（秒）",
			recordingLimitHint: "1–120 秒。上限来自 dsh 本地识别服务（16 kHz 单声道）。",
			streamingPreviewLabel: "边录边出字（分段预览）",
			streamingPreviewHint: "边说边把分段转写流式写入输入框；停止后再用整段录音重转一次作为最终稿，然后润色。关闭则只在停止后转写一次。",
			segmentSecondsLabel: "分段长度（秒）",
			segmentSecondsHint: "1–10 秒，默认 3。优先在静音处切分；越短上屏越快、越容易切断词。",
			polishLabel: "AI 润色",
			polishHint: "识别完成后用大模型清理转写文本（去口头禅、修正同音错字、加标点）。",
			on: "开",
			off: "关",
			polishModelLabel: "润色模型",
			polishModelHint: "选择 dsh 中已配置的模型路由。",
			polishModelNone: "（未选择）",
			polishEffortLabel: "润色思考强度",
			polishEffortHint: "控制大模型的推理深度。默认即适配器最低档，适合大多数场景。",
			polishPromptLabel: "自定义润色提示词",
			polishPromptHint: "留空使用内置提示词。自定义提示词总是追加输出契约保护。",
			polishPromptPlaceholder: "可选：粘贴自定义提示词…",
			showDefaultPrompt: "查看内置提示词",
			hideDefaultPrompt: "收起内置提示词",
			defaultPromptLabel: "内置提示词",
			effortDefaultLabel: "默认（关闭思考）",
			effortLoadingLabel: "加载思考强度选项…",
			routesStatus: "可用模型路由",
			routesUnavailable: "不可用",
			optimizeButton: "优化提示词",
			optimizeBusy: "优化中…",
			optimizeFailed: "优化失败，请重试",
			optimizeEmpty: "输入框为空，无需优化",
			optimizePanelTitle: "提示词优化结果",
			optimizeOriginalLabel: "原文",
			optimizeOptimizedLabel: "优化后",
			optimizeAdopt: "采纳",
			optimizeCancel: "取消",
			optimizeNotConfigured: "未配置优化模型，请在设置页开启",
			optimizeSectionLabel: "提示词优化",
			optimizeModelLabel: "优化模型",
			optimizeModelHint: "选择 dsh 中已配置的模型路由。",
			optimizeEffortLabel: "优化思考强度",
			optimizeEffortHint: "控制大模型的推理深度。默认即适配器最低档，适合大多数场景。",
			optimizePromptLabel: "自定义优化提示词",
			optimizePromptHint: "留空使用内置提示词。自定义提示词总是追加输出契约保护。",
			optimizePromptPlaceholder: "可选：粘贴自定义提示词…",
			contextTurnsLabel: "上下文引用轮数",
			contextTurnsHint: "优化时引用最近 N 轮对话作为上下文，0 为禁用。默认 3 轮。",
			aboutTitle: "关于与更新",
			aboutVersionLabel: "当前版本",
			aboutRepositoryLabel: "项目地址",
			aboutChangelogLabel: "更新日志",
			aboutLicenseLabel: "许可证",
			checkUpdateButton: "检查更新",
			checkingUpdate: "检查中…",
			updateUpToDate: "当前已是最新版本。",
			updateAvailable: "发现新版本",
			updateUnpublished: "该版本未在 npm 上公开发布。",
			updateCheckFailed: "检查更新失败",
			updateCommandLabel: "已全局安装 dsh CLI，执行",
			updateCommandNpxLabel: "未全局安装，改用 npx 执行",
			updateCommandPick: "按你的安装方式二选一即可",
			voiceSectionLabel: "语音识别",
			polishSectionLabel: "提示词润色",
			templatesTitle: "提示词模板",
			templatesDescription: "把常用提示词存成模板，在输入框键入 / 即可搜索并插入。",
			templatesNew: "新建模板",
			templatesEdit: "编辑",
			templatesSave: "保存",
			templatesCancel: "取消",
			templatesDelete: "删除",
			templatesDeleteConfirm: "再次点击确认删除",
			templatesEmpty: "还没有模板，点击「新建模板」创建第一个。",
			templatesLoadFailed: "模板加载失败",
			templatesRetry: "重试",
			templatesActionFailed: "操作失败，请重试",
			templatesNameLabel: "名称",
			templatesNamePlaceholder: "例如：代码评审助手",
			templatesDescriptionLabel: "描述",
			templatesDescriptionPlaceholder: "可选：这个模板用来做什么",
			templatesContentLabel: "内容",
			templatesContentPlaceholder: "插入输入框的提示词正文…",
			templatesTagsLabel: "标签",
			templatesTagsHint: "逗号分隔，最多 8 个，用于菜单搜索。"
		};
		const en = {
			voiceStart: "Voice input",
			voiceStop: "Stop voice input",
			voiceBusy: "Processing…",
			voicePermissionDenied: "Microphone permission was denied",
			voiceCaptureUnavailable: "Cannot access the microphone (HTTPS or localhost required)",
			listening: "Listening…",
			voiceCancel: "Cancel",
			autoStopIn: "Auto-stop in {seconds}s",
			autoStopTitle: "Stops and transcribes after {seconds} seconds without speech",
			autoStopLabel: "Auto-stop after silence (seconds)",
			autoStopHint: "Stop and transcribe once this many seconds pass without speech; 0 disables it. 10 by default; with it off only the recording limit applies.",
			transcribing: "Transcribing…",
			polishing: "Polishing…",
			voiceFailed: "Voice input failed",
			polishNotConfigured: "No polish model configured, please choose one in Settings",
			polishFailedKeepOriginal: "Polishing failed, original kept",
			settingsTitle: "BetterInput Settings",
			settingsDescription: "Configure voice recognition and AI polishing. Polishing reuses the models already configured in dsh — no extra API key needed.",
			loading: "Loading…",
			saveFailed: "Failed to save, please retry",
			languageLabel: "Recognition language",
			languageHint: "Provided by the dsh local recognizer (SenseVoice). Automatic lets the model decide.",
			languageAuto: "Automatic",
			languageCantonese: "Cantonese",
			speechStatusLabel: "Local recognizer",
			speechStatusReady: "Ready",
			speechStatusUnavailable: "Unavailable",
			speechStatusPreparing: "Preparing",
			speechPrepareButton: "Download and prepare",
			speechPrepareBusy: "Preparing…",
			recordingLimitLabel: "Recording limit (seconds)",
			recordingLimitHint: "1–120 seconds. The ceiling comes from the dsh local recognition service (16 kHz mono).",
			streamingPreviewLabel: "Stream text while recording (segmented preview)",
			streamingPreviewHint: "Transcribes in segments and streams them into the draft as you speak; after you stop, the whole recording is transcribed once more as the final transcript, then polished. Off transcribes only once, after stopping.",
			segmentSecondsLabel: "Segment length (seconds)",
			segmentSecondsHint: "1–10 seconds, 3 by default. Segments are cut at pauses when possible; shorter shows text sooner but splits words more often.",
			polishLabel: "AI polishing",
			polishHint: "Clean the transcript with an LLM after recognition (fillers, homophone fixes, punctuation).",
			on: "On",
			off: "Off",
			polishModelLabel: "Polish model",
			polishModelHint: "Pick a model route already configured in dsh.",
			polishModelNone: "(none)",
			polishEffortLabel: "Polishing thinking effort",
			polishEffortHint: "Controls the model inference depth. Default uses the adapter baseline (lightest tier).",
			polishPromptLabel: "Custom polish prompt",
			polishPromptHint: "Empty uses the built-in prompt. A custom prompt always keeps the output-contract guard.",
			polishPromptPlaceholder: "Optional: paste a custom prompt…",
			showDefaultPrompt: "Show the built-in prompt",
			hideDefaultPrompt: "Hide the built-in prompt",
			defaultPromptLabel: "Built-in prompt",
			effortDefaultLabel: "Default (thinking off)",
			effortLoadingLabel: "Loading reasoning effort options…",
			routesStatus: "Available model routes",
			routesUnavailable: "unavailable",
			optimizeButton: "Optimize prompt",
			optimizeBusy: "Optimizing…",
			optimizeFailed: "Optimization failed, please retry",
			optimizeEmpty: "Input is empty, nothing to optimize",
			optimizePanelTitle: "Prompt optimization result",
			optimizeOriginalLabel: "Original",
			optimizeOptimizedLabel: "Optimized",
			optimizeAdopt: "Adopt",
			optimizeCancel: "Cancel",
			optimizeNotConfigured: "No optimize model configured, enable it in Settings",
			optimizeSectionLabel: "Prompt optimization",
			optimizeModelLabel: "Optimize model",
			optimizeModelHint: "Pick a model route already configured in dsh.",
			optimizeEffortLabel: "Optimize thinking effort",
			optimizeEffortHint: "Controls the model inference depth. Default uses the adapter baseline (lightest tier).",
			optimizePromptLabel: "Custom optimize prompt",
			optimizePromptHint: "Empty uses the built-in prompt. A custom prompt always keeps the output-contract guard.",
			optimizePromptPlaceholder: "Optional: paste a custom prompt…",
			contextTurnsLabel: "Context turns",
			contextTurnsHint: "Include recent N turns as context for optimization. 0 = disabled. Default 3.",
			aboutTitle: "About & Updates",
			aboutVersionLabel: "Installed version",
			aboutRepositoryLabel: "Repository",
			aboutChangelogLabel: "Changelog",
			aboutLicenseLabel: "License",
			checkUpdateButton: "Check for updates",
			checkingUpdate: "Checking…",
			updateUpToDate: "You are up to date.",
			updateAvailable: "A new version is available",
			updateUnpublished: "This version is not published on npm.",
			updateCheckFailed: "Update check failed",
			updateCommandLabel: "With a global dsh CLI, run",
			updateCommandNpxLabel: "Without a global dsh CLI, run via npx",
			updateCommandPick: "Use either one depending on how you installed DSH",
			voiceSectionLabel: "Voice Recognition",
			polishSectionLabel: "Prompt Polishing",
			templatesTitle: "Prompt Templates",
			templatesDescription: "Save frequently used prompts as templates, then type / in the input box to search and insert.",
			templatesNew: "New template",
			templatesEdit: "Edit",
			templatesSave: "Save",
			templatesCancel: "Cancel",
			templatesDelete: "Delete",
			templatesDeleteConfirm: "Click again to confirm",
			templatesEmpty: "No templates yet. Create your first one with \"New template\".",
			templatesLoadFailed: "Failed to load templates",
			templatesRetry: "Retry",
			templatesActionFailed: "Action failed, please retry",
			templatesNameLabel: "Name",
			templatesNamePlaceholder: "e.g. Code review assistant",
			templatesDescriptionLabel: "Description",
			templatesDescriptionPlaceholder: "Optional: what this template is for",
			templatesContentLabel: "Content",
			templatesContentPlaceholder: "Prompt body inserted into the input box…",
			templatesTagsLabel: "Tags",
			templatesTagsHint: "Comma separated, up to 8, used for menu search."
		};
		/** Namespace owning every BetterInput surface string. Registered into the DSH
		* locale runtime; slots declaring this namespace receive the typed `t`. */
		const BETTER_INPUT_NS = "better-input";
		//#endregion
		//#region src/config.ts
		/**
		* dsh's speech service only accepts canonical 16 kHz mono PCM16 WAV
		* (`@deepseek-ai/dsh-experimental-speech-to-text/wave`), so every constant the
		* browser needs to build a WAV and every limit the Host enforces is derived
		* from this sample rate.
		*/
		const SPEECH_SAMPLE_RATE = 16e3;
		/**
		* Language hints accepted by the local SenseVoice provider (`auto` is the
		* provider's own value; this plugin stores `''` for it, which is also what
		* `resolve()` treats as "use the configured default").
		*/
		const SPEECH_LANGUAGE_HINTS = [
			"zh",
			"en",
			"yue",
			"ja",
			"ko"
		];
		/**
		* Out-of-the-box defaults: every toggle ON so new users get the full
		* experience immediately; reasoning effort left empty, which the Host
		* translates to "thinking off" (the model's `off` tier when it exposes
		* one, otherwise the adapter's own default).
		* Provider/model stay empty and get auto-filled on first settings page
		* load via SettingsController (first route returned by listRoutes).
		*/
		const DEFAULT_SETTINGS = Object.freeze({
			language: "",
			maxRecordingSeconds: 120,
			streamingPreview: true,
			segmentSeconds: 3,
			autoStopSeconds: 10,
			polishingEnabled: true,
			polishProvider: "",
			polishModel: "",
			polishReasoningEffort: "",
			polishPrompt: "",
			optimizeEnabled: true,
			optimizeProvider: "",
			optimizeModel: "",
			optimizeReasoningEffort: "",
			optimizePrompt: "",
			contextTurns: 3
		});
		function isValidRecordingLimit(value) {
			return Number.isSafeInteger(value) && value >= 1 && value <= 120;
		}
		function isValidSegmentSeconds(value) {
			return Number.isSafeInteger(value) && value >= 1 && value <= 10;
		}
		/** `0` means "no silence auto-stop"; anything else must be a usable window. */
		function isValidAutoStopSeconds(value) {
			if (!Number.isSafeInteger(value)) return false;
			if (value === 0) return true;
			return value >= 3 && value <= 120;
		}
		/** Resolve the effective recording cap from stored settings. */
		function effectiveRecordingSeconds(settings) {
			return isValidRecordingLimit(settings.maxRecordingSeconds) ? settings.maxRecordingSeconds : 120;
		}
		/** Resolve the effective streaming segment length from stored settings. */
		function effectiveSegmentSeconds(settings) {
			return isValidSegmentSeconds(settings.segmentSeconds) ? settings.segmentSeconds : 3;
		}
		/** Resolve the effective silence auto-stop window; `0` means disabled. */
		function effectiveAutoStopSeconds(settings) {
			return isValidAutoStopSeconds(settings.autoStopSeconds) ? settings.autoStopSeconds : 10;
		}
		//#endregion
		//#region src/client/audio-capture.ts
		/**
		* Browser microphone capture for the native dsh recognizers.
		*
		* dsh's speech service accepts exactly one audio format: a canonical 16 kHz
		* mono PCM16 WAV (`@deepseek-ai/dsh-experimental-speech-to-text/wave`). This
		* module owns that contract on the browser side — capture, resample, encode —
		* and keeps the recorded samples so a finished recording can still be sliced
		* (preview segments) or re-encoded (the final authoritative pass) after the
		* microphone itself has been released.
		*
		* The previous implementation used the Web Speech API, which streamed results
		* out of the browser and never owned the audio. Recognising locally means we do
		* own the audio, hence the explicit format handling here.
		*/
		/** Capture failure whose `kind` the caller maps onto a localized string. */
		var CaptureError = class extends Error {
			kind;
			constructor(kind, message) {
				super(message ?? kind);
				this.name = "CaptureError";
				this.kind = kind;
			}
		};
		const CHUNK_SECONDS = .25;
		const BYTES_PER_SAMPLE = 2;
		/**
		* One microphone acquisition.
		*
		* Samples are retained at the rate the AudioContext actually runs at and are
		* converted to 16 kHz on demand, so a browser that ignores the requested
		* sample rate still produces a valid recording.
		*/
		var MicrophoneCapture = class {
			stream;
			context;
			source;
			processor;
			sink;
			samples = /* @__PURE__ */ new Float32Array(0);
			frames = 0;
			captureRate = SPEECH_SAMPLE_RATE;
			released = false;
			disposed = false;
			/** Acquire the microphone and start buffering samples. */
			async start() {
				if (typeof navigator === "undefined" || navigator.mediaDevices?.getUserMedia === void 0) throw new CaptureError("unavailable", "getUserMedia is not available in this browser");
				let stream;
				try {
					stream = await navigator.mediaDevices.getUserMedia({ audio: {
						channelCount: 1,
						echoCancellation: true,
						noiseSuppression: true
					} });
				} catch (error) {
					throw toCaptureError(error);
				}
				if (this.disposed) {
					stopTracks(stream);
					throw new CaptureError("interrupted", "capture was cancelled");
				}
				this.stream = stream;
				const Constructor = audioContextConstructor();
				if (Constructor === void 0) {
					stopTracks(stream);
					throw new CaptureError("unavailable", "Web Audio is not available in this browser");
				}
				let context;
				try {
					context = new Constructor({ sampleRate: SPEECH_SAMPLE_RATE });
				} catch {
					context = new Constructor();
				}
				this.context = context;
				this.captureRate = context.sampleRate > 0 ? context.sampleRate : SPEECH_SAMPLE_RATE;
				this.source = context.createMediaStreamSource(stream);
				this.processor = context.createScriptProcessor(4096, 1, 1);
				this.processor.onaudioprocess = (event) => this.collect(event);
				this.sink = context.createGain();
				this.sink.gain.value = 0;
				this.source.connect(this.processor);
				this.processor.connect(this.sink);
				this.sink.connect(context.destination);
				if (context.state === "suspended") try {
					await context.resume();
				} catch {}
			}
			/** Seconds captured so far, in capture-rate terms. */
			secondsRecorded() {
				return this.frames / this.captureRate;
			}
			/** Root-mean-square level of the trailing window, 0 when idle. */
			level(windowSeconds = CHUNK_SECONDS) {
				const windowFrames = Math.min(this.frames, Math.max(1, Math.round(windowSeconds * this.captureRate)));
				if (windowFrames <= 0) return 0;
				const from = this.frames - windowFrames;
				let sum = 0;
				for (let index = from; index < this.frames; index += 1) {
					const value = this.samples[index] ?? 0;
					sum += value * value;
				}
				return Math.sqrt(sum / windowFrames);
			}
			/** Largest absolute sample in a range, used to skip silent segments. */
			peak(fromSeconds, toSeconds) {
				const range = this.range(fromSeconds, toSeconds);
				let peak = 0;
				for (let index = 0; index < range.length; index += 1) {
					const value = Math.abs(range[index] ?? 0);
					if (value > peak) peak = value;
				}
				return peak;
			}
			/** Copy a capture-time range as 16 kHz mono samples. */
			slice(fromSeconds, toSeconds) {
				const range = this.range(fromSeconds, toSeconds);
				if (this.captureRate === 16e3) return range;
				return resampleLinear(range, this.captureRate, SPEECH_SAMPLE_RATE);
			}
			/**
			* Release the microphone and the audio graph, keeping the samples.
			*
			* Called as soon as the user stops speaking so the browser indicator goes
			* away while the final transcription is still running.
			*/
			async release() {
				if (this.released) return;
				this.released = true;
				const processor = this.processor;
				this.processor = void 0;
				if (processor !== void 0) {
					processor.onaudioprocess = null;
					try {
						processor.disconnect();
					} catch {}
				}
				disconnect(this.source);
				this.source = void 0;
				disconnect(this.sink);
				this.sink = void 0;
				stopTracks(this.stream);
				this.stream = void 0;
				const context = this.context;
				this.context = void 0;
				if (context !== void 0) try {
					await context.close();
				} catch {}
			}
			/** Release the microphone and drop the buffered samples. */
			async dispose() {
				this.disposed = true;
				await this.release();
				this.samples = /* @__PURE__ */ new Float32Array(0);
				this.frames = 0;
			}
			collect(event) {
				if (this.disposed || this.released) return;
				const channel = event.inputBuffer.getChannelData(0);
				if (channel.length === 0) return;
				this.ensure(channel.length);
				this.samples.set(channel, this.frames);
				this.frames += channel.length;
			}
			ensure(extra) {
				if (this.frames + extra <= this.samples.length) return;
				let capacity = Math.max(4096, this.samples.length * 2);
				while (capacity < this.frames + extra) capacity *= 2;
				const next = new Float32Array(capacity);
				next.set(this.samples.subarray(0, this.frames));
				this.samples = next;
			}
			range(fromSeconds, toSeconds) {
				const from = Math.max(0, Math.round(fromSeconds * this.captureRate));
				const to = Math.min(this.frames, Math.round(toSeconds * this.captureRate));
				if (to <= from) return /* @__PURE__ */ new Float32Array(0);
				return this.samples.slice(from, to);
			}
		};
		/**
		* Encode 16 kHz mono samples as the canonical PCM16 WAV the Host validates.
		*
		* Field for field: RIFF/WAVE/`fmt `/16/PCM=1/mono/16000/byteRate 32000/
		* blockAlign 2/bits 16/`data`, RIFF size = length - 8, data size =
		* length - 44, an even PCM length, and at least one sample.
		*/
		function encodeWave(samples) {
			const header = 44;
			const dataBytes = samples.length * BYTES_PER_SAMPLE;
			const bytes = new Uint8Array(header + dataBytes);
			const view = new DataView(bytes.buffer);
			writeAscii(view, 0, "RIFF");
			view.setUint32(4, 36 + dataBytes, true);
			writeAscii(view, 8, "WAVE");
			writeAscii(view, 12, "fmt ");
			view.setUint32(16, 16, true);
			view.setUint16(20, 1, true);
			view.setUint16(22, 1, true);
			view.setUint32(24, SPEECH_SAMPLE_RATE, true);
			view.setUint32(28, SPEECH_SAMPLE_RATE * BYTES_PER_SAMPLE, true);
			view.setUint16(32, BYTES_PER_SAMPLE, true);
			view.setUint16(34, 16, true);
			writeAscii(view, 36, "data");
			view.setUint32(40, dataBytes, true);
			for (let index = 0; index < samples.length; index += 1) {
				const value = Math.max(-1, Math.min(1, samples[index] ?? 0));
				view.setInt16(header + index * BYTES_PER_SAMPLE, Math.round(value * 32767), true);
			}
			return bytes;
		}
		/** Base64 for the JSON Remote carrier, chunked to avoid argument-count limits. */
		function audioBase64(bytes) {
			let binary = "";
			const chunk = 32768;
			for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
			return btoa(binary);
		}
		/** Linear resampling; adequate for a fallback path off the 16 kHz happy path. */
		function resampleLinear(samples, fromRate, toRate) {
			if (samples.length === 0 || fromRate === toRate || fromRate <= 0) return samples;
			const length = Math.max(1, Math.round(samples.length * toRate / fromRate));
			const output = new Float32Array(length);
			const step = (samples.length - 1) / Math.max(1, length - 1);
			for (let index = 0; index < length; index += 1) {
				const position = index * step;
				const lower = Math.floor(position);
				const upper = Math.min(samples.length - 1, lower + 1);
				const weight = position - lower;
				const a = samples[lower] ?? 0;
				const b = samples[upper] ?? 0;
				output[index] = a + (b - a) * weight;
			}
			return output;
		}
		function writeAscii(view, offset, text) {
			for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
		}
		function disconnect(node) {
			if (node === void 0) return;
			try {
				node.disconnect();
			} catch {}
		}
		function stopTracks(stream) {
			if (stream === void 0) return;
			for (const track of stream.getTracks()) try {
				track.stop();
			} catch {}
		}
		function audioContextConstructor() {
			if (typeof window === "undefined") return void 0;
			const holder = globalThis;
			return holder.AudioContext ?? holder.webkitAudioContext;
		}
		function toCaptureError(error) {
			const name = error instanceof DOMException ? error.name : "";
			if (name === "NotAllowedError" || name === "SecurityError") return new CaptureError("permission", error instanceof Error ? error.message : void 0);
			if (name === "AbortError") return new CaptureError("interrupted", error instanceof Error ? error.message : void 0);
			return new CaptureError("unavailable", error instanceof Error ? error.message : void 0);
		}
		/** Never cut a segment shorter than this, even on a clean pause. */
		const MIN_SEGMENT_SECONDS = 1.2;
		/** Trailing fragment below this is dropped rather than submitted. */
		const MIN_TAIL_SECONDS = .4;
		/** Silence long enough to be treated as a sentence boundary. */
		const SILENCE_SECONDS = .45;
		/** RMS below this counts as silence (quiet room noise sits well under it). */
		const SILENCE_LEVEL = .012;
		/** Peak below this means the segment holds no speech at all. */
		const MIN_PEAK = .005;
		/** Shortest payload worth submitting; the Host rejects WAV under 46 bytes. */
		const MIN_SAMPLES = 1600;
		/**
		* Quiet-window slack, in seconds.
		*
		* `quiet` is a sum of frame lengths, so 50 × 0.2 s can land at 9.999999999999998
		* and hold the countdown one frame (200 ms) past the window the user was shown.
		*/
		const QUIET_EPSILON_SECONDS = 1e-6;
		/**
		* The silence auto-stop timer: "speak, then stop talking, and the recording
		* finishes by itself".
		*
		* Deliberately pure and free of Web Audio so the guard script can drive it:
		* the whole user-visible contract is here — the countdown never runs before the
		* first sound (`hasSpoken`), any new sound resets it to the full window, and it
		* cannot fire at all when the window is `0` (disabled).
		*/
		var SilenceWatch = class {
			limitSeconds;
			tickSeconds;
			spoken = false;
			quiet = 0;
			constructor(limitSeconds, tickSeconds) {
				this.limitSeconds = limitSeconds;
				this.tickSeconds = tickSeconds;
			}
			observe(sounding) {
				if (sounding) {
					this.spoken = true;
					this.quiet = 0;
				} else this.quiet += this.tickSeconds;
				const remainingSeconds = this.remainingSeconds();
				return {
					hasSpoken: this.spoken,
					quietSeconds: this.quiet,
					remainingSeconds,
					elapsed: remainingSeconds !== null && remainingSeconds <= 0
				};
			}
			/** Seconds left in the window, `null` while counting is not allowed. */
			remainingSeconds() {
				if (this.limitSeconds <= 0 || !this.spoken) return null;
				const remaining = this.limitSeconds - this.quiet;
				return remaining <= QUIET_EPSILON_SECONDS ? 0 : remaining;
			}
		};
		function sessionOptionsFor(settings, transcribe, callbacks) {
			return {
				language: settings.language,
				segmentSeconds: effectiveSegmentSeconds(settings),
				streamingPreview: settings.streamingPreview !== false,
				autoStopSeconds: effectiveAutoStopSeconds(settings),
				transcribe,
				...callbacks
			};
		}
		var NativeSpeechSession = class {
			options;
			capture = new MicrophoneCapture();
			segments = [];
			timer;
			/** Seconds already submitted as preview segments. */
			cursor = 0;
			speechSeen = false;
			/** Silence since the last cut, used by the segment cutter. */
			silenceSeconds = 0;
			/**
			* The auto-stop timer, replaced on every `start()`.
			*
			* Kept separate from `silenceSeconds` on purpose: cutting a segment resets
			* that one, and the countdown the user is watching must not jump back to the
			* full window every time a preview segment is cut.
			*/
			watch = new SilenceWatch(0, 200 / 1e3);
			/** Serialises transcriptions: the native worker is serial anyway. */
			queue = Promise.resolve();
			inFlight;
			stopping = false;
			aborted = false;
			ended = false;
			constructor(options) {
				this.options = options;
			}
			get active() {
				return this.timer !== void 0 && !this.stopping && !this.aborted;
			}
			/** Acquire the microphone and begin cutting preview segments. */
			async start() {
				try {
					await this.capture.start();
				} catch (error) {
					if (this.aborted || this.stopping || this.ended) return;
					this.options.onError(toError(error));
					return;
				}
				if (this.aborted || this.stopping) {
					this.capture.dispose();
					return;
				}
				this.options.onPhase?.("capturing");
				this.watch = new SilenceWatch(this.options.autoStopSeconds, 200 / 1e3);
				this.timer = setInterval(() => this.tick(), 200);
			}
			/** Finish the recording: flush the tail, then transcribe the whole thing. */
			stop() {
				if (this.stopping || this.aborted || this.ended) return;
				this.stopping = true;
				this.clearTimer();
				const total = this.capture.secondsRecorded();
				if (this.options.streamingPreview && total - this.cursor >= MIN_TAIL_SECONDS) this.cutSegment(total);
				this.capture.release();
				this.finish(total);
			}
			/** Discard everything: no callbacks, no transcript, microphone released. */
			abort() {
				if (this.aborted) return;
				this.aborted = true;
				this.stopping = true;
				this.clearTimer();
				this.inFlight?.abort();
				this.inFlight = void 0;
				this.capture.dispose();
			}
			tick() {
				if (this.aborted || this.stopping) return;
				const now = this.capture.secondsRecorded();
				const level = this.capture.level();
				const sounding = level >= SILENCE_LEVEL;
				if (sounding) {
					this.speechSeen = true;
					this.silenceSeconds = 0;
				} else this.silenceSeconds += 200 / 1e3;
				const quiet = this.watch.observe(sounding);
				this.publishTick(now, level, quiet.remainingSeconds);
				if (quiet.elapsed) {
					this.options.onAutoStop?.();
					this.stop();
					return;
				}
				const pending = now - this.cursor;
				if (pending <= 0) return;
				if (!this.options.streamingPreview) return;
				const reachedCap = pending >= this.options.segmentSeconds;
				const quietBoundary = pending >= MIN_SEGMENT_SECONDS && this.speechSeen && this.silenceSeconds >= SILENCE_SECONDS;
				if (reachedCap || quietBoundary) this.cutSegment(now);
			}
			/** One telemetry frame for the status bar (timer, level, countdown). */
			publishTick(elapsedSeconds, level, autoStopRemainingSeconds) {
				const onTick = this.options.onTick;
				if (onTick === void 0) return;
				onTick({
					elapsedSeconds,
					level,
					autoStopSeconds: this.options.autoStopSeconds,
					autoStopRemainingSeconds
				});
			}
			/** Submit `[cursor, endSeconds)` as one preview segment. */
			cutSegment(endSeconds) {
				const from = this.cursor;
				this.cursor = endSeconds;
				this.speechSeen = false;
				this.silenceSeconds = 0;
				if (this.capture.peak(from, endSeconds) < MIN_PEAK) return;
				this.submit(this.capture.slice(from, endSeconds), false);
			}
			submit(samples, isFinal) {
				if (samples.length < MIN_SAMPLES) return;
				const payload = audioBase64(encodeWave(samples));
				this.queue = this.queue.then(async () => {
					if (this.aborted) return void 0;
					const controller = new AbortController();
					this.inFlight = controller;
					try {
						const result = await this.options.transcribe(payload, this.options.language, controller.signal);
						if (this.aborted) return void 0;
						if (!result.ok) {
							this.options.onError(new Error(result.error.message));
							return;
						}
						const text = result.value.text.trim();
						if (text === "") return void 0;
						this.segments.push(text);
						if (!isFinal) this.options.onPreview(this.segments.join(" "));
						return;
					} catch (error) {
						if (this.aborted) return void 0;
						this.options.onError(toError(error));
						return;
					} finally {
						if (this.inFlight === controller) this.inFlight = void 0;
					}
				});
			}
			async finish(total) {
				await this.queue.catch(() => void 0);
				if (this.aborted) return;
				this.options.onPhase?.("finalizing");
				let finalText = "";
				const seconds = Math.min(total, 120);
				if (seconds >= MIN_TAIL_SECONDS) {
					const controller = new AbortController();
					this.inFlight = controller;
					try {
						const samples = this.capture.slice(0, seconds);
						if (samples.length >= MIN_SAMPLES && this.capture.peak(0, seconds) >= MIN_PEAK) {
							const result = await this.options.transcribe(audioBase64(encodeWave(samples)), this.options.language, controller.signal);
							if (this.aborted) return;
							if (result.ok) finalText = result.value.text.trim();
							else this.options.onError(new Error(result.error.message));
						}
					} catch (error) {
						if (this.aborted) return;
						this.options.onError(toError(error));
					} finally {
						if (this.inFlight === controller) this.inFlight = void 0;
					}
				}
				const preview = this.segments.join(" ");
				const text = finalText !== "" ? finalText : preview;
				this.ended = true;
				await this.capture.dispose();
				if (this.aborted) return;
				this.options.onEnd(text);
			}
			clearTimer() {
				if (this.timer === void 0) return;
				clearInterval(this.timer);
				this.timer = void 0;
			}
		};
		/** Localized by the caller: capture failures carry a kind, others their message. */
		function captureFailureMessage(error) {
			if (error instanceof CaptureError) return {
				kind: error.kind,
				message: error.message
			};
			return {
				kind: "",
				message: error.message
			};
		}
		function toError(error) {
			return error instanceof Error ? error : new Error(String(error));
		}
		//#endregion
		//#region src/client/voice-session.ts
		const NOTICE_STATES = /* @__PURE__ */ new Set(["error", "polish-error"]);
		const VOICE_ERROR_DISMISS_MS = 2600;
		const EMPTY_VOICE_METER = Object.freeze({
			elapsedSeconds: 0,
			level: 0,
			autoStopSeconds: 0,
			autoStopRemainingSeconds: null
		});
		var VoiceMeter = class {
			snapshot = EMPTY_VOICE_METER;
			listeners = /* @__PURE__ */ new Set();
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			publish(next) {
				const current = this.snapshot;
				if (current.elapsedSeconds === next.elapsedSeconds && current.level === next.level && current.autoStopSeconds === next.autoStopSeconds && current.autoStopRemainingSeconds === next.autoStopRemainingSeconds) return;
				this.snapshot = next;
				for (const listener of this.listeners) listener();
			}
			reset() {
				this.publish(EMPTY_VOICE_METER);
			}
			dispose() {
				this.listeners.clear();
				this.snapshot = EMPTY_VOICE_METER;
			}
		};
		/**
		* Shared voice-input state for one session, written from scratch for
		* sqs-dsh-better-input. The microphone button and the recognition bar both
		* subscribe; the bar can request stop/cancel through the same instance.
		*/
		var VoiceInputSession = class {
			/** Recording telemetry, subscribed to only by the recognition bar. */
			meter = new VoiceMeter();
			snapshot = {
				state: "idle",
				detail: ""
			};
			listeners = /* @__PURE__ */ new Set();
			stopListeners = /* @__PURE__ */ new Set();
			cancelListeners = /* @__PURE__ */ new Set();
			epoch = 0;
			errorTimer;
			captureEpoch() {
				return this.epoch;
			}
			isCurrentEpoch(epoch) {
				return this.epoch === epoch;
			}
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			onStopRequested = (listener) => {
				this.stopListeners.add(listener);
				return () => this.stopListeners.delete(listener);
			};
			onCancelRequested = (listener) => {
				this.cancelListeners.add(listener);
				return () => this.cancelListeners.delete(listener);
			};
			setState(state, detail = "") {
				const nextDetail = NOTICE_STATES.has(state) ? detail : "";
				if (this.snapshot.state === state && this.snapshot.detail === nextDetail) return;
				this.clearErrorTimer();
				this.snapshot = {
					state,
					detail: nextDetail
				};
				this.emit();
				if (NOTICE_STATES.has(state)) this.errorTimer = setTimeout(() => {
					this.errorTimer = void 0;
					if (NOTICE_STATES.has(this.snapshot.state)) this.setState("idle");
				}, VOICE_ERROR_DISMISS_MS);
			}
			requestStop() {
				for (const listener of this.stopListeners) listener();
			}
			requestCancel() {
				if (this.snapshot.state !== "transcribing" && this.snapshot.state !== "polishing") return;
				this.epoch += 1;
				for (const listener of this.cancelListeners) listener();
				this.setState("idle");
			}
			dispose() {
				this.clearErrorTimer();
				this.meter.dispose();
				this.listeners.clear();
				this.stopListeners.clear();
				this.cancelListeners.clear();
			}
			clearErrorTimer() {
				if (this.errorTimer === void 0) return;
				clearTimeout(this.errorTimer);
				this.errorTimer = void 0;
			}
			emit() {
				for (const listener of this.listeners) listener();
			}
		};
		function useVoiceInputSession(session) {
			return (0, react.useSyncExternalStore)(session.subscribe, session.getSnapshot, session.getSnapshot);
		}
		/** Subscribe to the live recording telemetry of one session. */
		function useVoiceMeter(session) {
			return (0, react.useSyncExternalStore)(session.meter.subscribe, session.meter.getSnapshot, session.meter.getSnapshot);
		}
		//#endregion
		//#region src/client/MicrophoneButton.tsx
		/**
		* The microphone button in the composer tool row. Click to start recording,
		* click again to stop.
		*
		* The recording is transcribed by dsh's own local recognizer
		* (`remote.transcribeSpeech` → `ctx.speechToText`, the SenseVoice provider from
		* the optional voice-input bundle) instead of the browser's Web Speech API.
		* While recording, the text of each finished segment streams into the draft;
		* when the user stops, one pass over the whole recording produces the
		* authoritative transcript and AI polishing runs on that.
		*/
		function MicrophoneButton({ useInput, inputActions, voiceSession, remote, useSettings, t }) {
			const state = useVoiceInputSession(voiceSession).state;
			const setState = (next, detail = "") => voiceSession.setState(next, detail);
			const input = useInput((state) => state);
			const speechRef = (0, react.useRef)(null);
			const baseDraftRef = (0, react.useRef)("");
			const mountedRef = (0, react.useRef)(true);
			const stopRef = (0, react.useRef)(null);
			const polishAbortRef = (0, react.useRef)(null);
			const recordingTimerRef = (0, react.useRef)(null);
			const settingsRef = (0, react.useRef)(null);
			/** First non-fatal transcription error of the current session, if any. */
			const speechErrorRef = (0, react.useRef)(null);
			/** Set when capture itself failed, which makes `onEnd` meaningless. */
			const captureFailedRef = (0, react.useRef)(false);
			const settingsFace = useSettings();
			if (settingsFace.status === "ready") settingsRef.current = settingsFace.settings;
			const latestDraftRef = (0, react.useRef)(input.draft);
			(0, react.useEffect)(() => {
				latestDraftRef.current = input.draft;
			}, [input.draft]);
			(0, react.useEffect)(() => {
				mountedRef.current = true;
				const stop = voiceSession.onStopRequested(() => stopRef.current?.());
				const cancel = voiceSession.onCancelRequested(() => {
					speechRef.current?.abort();
					polishAbortRef.current?.abort();
				});
				return () => {
					mountedRef.current = false;
					stop();
					cancel();
					speechRef.current?.abort();
					speechRef.current = null;
					polishAbortRef.current?.abort();
					polishAbortRef.current = null;
					clearRecordingTimer(recordingTimerRef);
					voiceSession.meter.reset();
					voiceSession.setState("idle");
				};
			}, [voiceSession]);
			const active = state === "starting" || state === "recording";
			const busy = state === "transcribing" || state === "polishing";
			const settings = settingsFace.status === "ready" ? settingsFace.settings : settingsRef.current;
			const polishingEnabled = settings?.polishingEnabled ?? false;
			const polishProvider = (settings?.polishProvider ?? "").trim();
			const polishModel = (settings?.polishModel ?? "").trim();
			const polishConfigured = polishingEnabled && polishProvider !== "" && polishModel !== "";
			/** Localized capture failure; the kind decides which sentence the user sees. */
			const captureDetail = (kind, message) => {
				if (kind === "permission") return t("voicePermissionDenied");
				if (kind === "unavailable") return t("voiceCaptureUnavailable");
				return message !== "" ? message : t("voiceFailed");
			};
			const startListening = () => {
				if (active || busy) return;
				const baseDraft = input.draft;
				baseDraftRef.current = baseDraft;
				captureFailedRef.current = false;
				speechErrorRef.current = null;
				voiceSession.meter.reset();
				setState("starting");
				const writeDraft = (text) => {
					const next = updateDraft(baseDraft, text);
					latestDraftRef.current = next;
					inputActions.setDraft(next);
					return next;
				};
				const session = new NativeSpeechSession(sessionOptionsFor(settingsRef.current ?? DEFAULT_SETTINGS, (audio, language, signal) => remote.transcribeSpeech(audio, language, signal), {
					onPreview: (text) => {
						if (!mountedRef.current || captureFailedRef.current) return;
						writeDraft(text);
					},
					onError: (error) => {
						const failure = captureFailureMessage(error);
						if (failure.kind === "interrupted") return;
						if (failure.kind !== "") {
							captureFailedRef.current = true;
							voiceSession.meter.reset();
							if (mountedRef.current) setState("error", captureDetail(failure.kind, failure.message));
							return;
						}
						speechErrorRef.current ??= error;
					},
					onTick: (tick) => {
						if (!mountedRef.current) return;
						voiceSession.meter.publish(tick);
					},
					onAutoStop: () => {
						clearRecordingTimer(recordingTimerRef);
						if (mountedRef.current) setState("transcribing");
					},
					onEnd: (text) => {
						speechRef.current = null;
						clearRecordingTimer(recordingTimerRef);
						voiceSession.meter.reset();
						if (!mountedRef.current || captureFailedRef.current) return;
						const transcript = text.trim();
						const speechError = speechErrorRef.current;
						speechErrorRef.current = null;
						if (transcript === "") {
							if (speechError !== null) setState("error", speechError.message);
							else setState("idle");
							return;
						}
						const draftAtStop = writeDraft(transcript);
						const current = settingsRef.current;
						if (current !== null && current.polishingEnabled && current.polishProvider.trim() !== "" && current.polishModel.trim() !== "") polishDraft({
							transcript,
							baseDraft,
							draftAtStop,
							provider: current.polishProvider,
							model: current.polishModel,
							remote,
							setState,
							latestDraftRef,
							actionsRef: { current: inputActions },
							polishAbortRef
						});
						else setState("idle");
					}
				}));
				speechRef.current = session;
				session.start().then(() => {
					if (!mountedRef.current || speechRef.current !== session) return;
					if (!session.active) return;
					setState("recording");
					armRecordingTimer(recordingTimerRef, effectiveRecordingSeconds(settingsRef.current ?? DEFAULT_SETTINGS), () => {
						speechRef.current?.stop();
					});
				});
			};
			const stopListening = () => {
				clearRecordingTimer(recordingTimerRef);
				if (!active) return;
				setState("transcribing");
				speechRef.current?.stop();
			};
			stopRef.current = stopListening;
			const tooltip = busy ? t("voiceBusy") : active ? t("voiceStop") : state === "polish-error" ? t("polishFailedKeepOriginal") : state === "error" ? t("voiceFailed") : !polishConfigured ? `${t("voiceStart")} — ${t("polishNotConfigured")}` : t("voiceStart");
			const label = busy ? "…" : active ? t("voiceStop") : t("voiceStart");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": label,
				"aria-pressed": active,
				disabled: busy,
				title: tooltip,
				onClick: active ? stopListening : startListening,
				"data-better-input-state": state,
				"data-better-input-polish-configured": polishConfigured ? "yes" : "no",
				style: buttonStyle$2(active, busy, !polishConfigured),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MicrophoneIcon, {})
			});
		}
		async function polishDraft(options) {
			if (options.provider.trim() === "" || options.model.trim() === "") return;
			const controller = new AbortController();
			options.polishAbortRef.current = controller;
			options.setState("polishing");
			try {
				const result = await options.remote.polish(options.transcript, options.provider, options.model, controller.signal);
				if (controller.signal.aborted) return;
				if (!shouldApplyPolishResult(options.latestDraftRef.current, options.draftAtStop, options.baseDraft)) {
					options.setState("idle");
					return;
				}
				if (!result.ok) {
					options.setState("polish-error", result.error.message);
					return;
				}
				const text = result.value.trim() !== "" ? result.value.trim() : options.transcript;
				const nextDraft = updateDraft(options.baseDraft, text);
				options.latestDraftRef.current = nextDraft;
				options.actionsRef.current.setDraft(nextDraft);
				options.setState("idle");
			} catch (error) {
				if (controller.signal.aborted) return;
				options.setState("polish-error", error instanceof Error ? error.message : "Polishing failed");
			} finally {
				if (options.polishAbortRef.current === controller) options.polishAbortRef.current = null;
			}
		}
		/**
		* Only replace the draft when the user has not edited it since our own last
		* write. Both the text we wrote last (`draftAtStop` — the finished transcript,
		* or the last streamed preview segment) and the untouched base draft count as
		* unchanged.
		*
		* This matters more since the preview became segmented: the text on screen
		* while recording is a *preview*, and the authoritative transcript that arrives
		* after stopping can differ from it. Comparing against the text this session
		* wrote is what keeps a user's mid-recording edit from being overwritten.
		*/
		function shouldApplyPolishResult(currentDraft, draftAtStop, baseDraft) {
			const current = collapseDraft(currentDraft);
			return current === collapseDraft(draftAtStop) || current === collapseDraft(baseDraft);
		}
		function collapseDraft(text) {
			return text.replace(/\s+/g, " ").trim();
		}
		function buttonStyle$2(active, busy, polishUnconfigured) {
			return {
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: 28,
				height: 28,
				padding: 0,
				border: "none",
				borderRadius: 6,
				background: active ? "var(--dsw-alias-state-business-primary, #4f8cff)" : "transparent",
				color: active ? "#fff" : "var(--dsw-alias-label-primary, inherit)",
				cursor: busy ? "default" : "pointer",
				opacity: busy ? .5 : polishUnconfigured ? .75 : 1,
				flex: "none"
			};
		}
		function MicrophoneIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				"aria-hidden": "true",
				fill: "none",
				height: "16",
				viewBox: "0 0 16 16",
				width: "16",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 1.75a2.25 2.25 0 0 0-2.25 2.25v3.5a2.25 2.25 0 0 0 4.5 0V4A2.25 2.25 0 0 0 8 1.75Z",
					stroke: "currentColor",
					strokeLinejoin: "round",
					strokeWidth: "1.4"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12.25V14M5.5 14h5",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					strokeWidth: "1.4"
				})]
			});
		}
		/** Append transcript to a base draft with one space separator. */
		function updateDraft(baseDraft, transcript) {
			const text = transcript.trim();
			if (text === "") return baseDraft;
			if (baseDraft === "") return text;
			if (/\s$/.test(baseDraft) || /^\s/.test(text)) return baseDraft + text;
			return `${baseDraft} ${text}`;
		}
		function armRecordingTimer(timerRef, seconds, stop) {
			clearRecordingTimer(timerRef);
			timerRef.current = setTimeout(stop, Math.max(1, seconds) * 1e3);
		}
		function clearRecordingTimer(timerRef) {
			if (timerRef.current === null) return;
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		//#endregion
		//#region src/client/OptimizeButton.tsx
		/**
		* The ✨ optimize button rendered above the composer card (in
		* `conversation.input.dock`), right-aligned. Click reads the current draft,
		* calls the Host LLM to optimize it, then shows a confirmation panel with
		* the original and optimized text. The draft is replaced only when the user
		* clicks "Adopt".
		*/
		function OptimizeButton({ useChat, useInput, inputActions, remote, useSettings, t }) {
			const [state, setState] = (0, react.useState)({ kind: "idle" });
			const settingsFace = useSettings();
			const abortRef = (0, react.useRef)(null);
			const input = useInput((state) => state);
			const chat = useChat((area) => area);
			const draftRef = (0, react.useRef)(input.draft);
			(0, react.useEffect)(() => {
				draftRef.current = input.draft;
			}, [input.draft]);
			(0, react.useEffect)(() => {
				return () => {
					abortRef.current?.abort();
				};
			}, []);
			const settings = settingsFace.status === "ready" ? settingsFace.settings : null;
			const provider = settings?.optimizeProvider.trim() ?? "";
			const model = settings?.optimizeModel.trim() ?? "";
			const modelConfigured = provider !== "" && model !== "";
			const handleClick = async () => {
				if (state.kind === "optimizing") return;
				const draft = draftRef.current.trim();
				if (draft === "") {
					setState({
						kind: "error",
						message: t("optimizeEmpty")
					});
					return;
				}
				if (!modelConfigured) {
					setState({
						kind: "error",
						message: t("optimizeNotConfigured")
					});
					return;
				}
				abortRef.current?.abort();
				const controller = new AbortController();
				abortRef.current = controller;
				setState({ kind: "optimizing" });
				try {
					const contextTurns = settings?.contextTurns ?? 3;
					const context = contextTurns > 0 ? extractConversationContext(chat.legacy.nodes, contextTurns) : "";
					const result = await remote.optimize(draft, provider, model, context, controller.signal);
					if (controller.signal.aborted) return;
					if (!result.ok) {
						setState({
							kind: "error",
							message: result.error.message
						});
						return;
					}
					const optimized = result.value.trim();
					if (optimized === "") {
						setState({
							kind: "error",
							message: t("optimizeFailed")
						});
						return;
					}
					setState({
						kind: "result",
						original: draft,
						optimized
					});
				} catch (error) {
					if (controller.signal.aborted) return;
					setState({
						kind: "error",
						message: error instanceof Error ? error.message : t("optimizeFailed")
					});
				} finally {
					if (abortRef.current === controller) abortRef.current = null;
				}
			};
			const handleAdopt = () => {
				if (state.kind !== "result") return;
				inputActions.setDraft(state.optimized);
				setState({ kind: "idle" });
			};
			const handleCancel = () => {
				setState({ kind: "idle" });
			};
			const busy = state.kind === "optimizing";
			const disabled = busy || !modelConfigured;
			const buttonTitle = modelConfigured ? t("optimizeButton") : t("optimizeNotConfigured");
			const errorToast = state.kind === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorToastPortal, {
				message: state.message,
				onDismiss: handleCancel
			}) : null;
			const confirmModal = state.kind === "result" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfirmModalPortal, {
				title: t("optimizePanelTitle"),
				originalLabel: t("optimizeOriginalLabel"),
				optimizedLabel: t("optimizeOptimizedLabel"),
				original: state.original,
				optimized: state.optimized,
				adoptLabel: t("optimizeAdopt"),
				cancelLabel: t("optimizeCancel"),
				onAdopt: handleAdopt,
				onCancel: handleCancel
			}) : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: containerStyle,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-label": buttonTitle,
						title: buttonTitle,
						disabled,
						onClick: handleClick,
						style: buttonStyle$1(disabled),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SparkleIcon, {}), busy ? t("optimizeBusy") : ""]
					})
				}),
				errorToast,
				confirmModal
			] });
		}
		/** Ctrl/Cmd+A inside a `<pre>` selects only that block's text. */
		function selectAllInPre(e) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
				e.preventDefault();
				const range = document.createRange();
				range.selectNodeContents(e.currentTarget);
				const selection = window.getSelection();
				if (selection) {
					selection.removeAllRanges();
					selection.addRange(range);
				}
			}
		}
		function OptimizeConfirmPanel(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: modalContentStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: panelTitleStyle,
						children: props.title
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: compareRowStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: compareColStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: compareLabelStyle,
								children: props.originalLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								style: preStyle,
								tabIndex: 0,
								onKeyDown: selectAllInPre,
								children: props.original
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: compareColStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: compareLabelStyle,
								children: props.optimizedLabel
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								style: {
									...preStyle,
									borderColor: "var(--dsw-alias-state-business-primary, #4f8cff)"
								},
								tabIndex: 0,
								onKeyDown: selectAllInPre,
								children: props.optimized
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: panelActionsStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: cancelBtnStyle,
							onClick: props.onCancel,
							children: props.cancelLabel
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: adoptBtnStyle,
							onClick: props.onAdopt,
							children: props.adoptLabel
						})]
					})
				]
			});
		}
		/**
		* Comparison modal portalled to `document.body`. DSH renders slot content
		* inside shadow roots whose ancestors may clip or contain fixed-position
		* children, so the overlay must escape the component tree entirely.
		*/
		function ConfirmModalPortal(props) {
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: modalOverlayStyle,
				onClick: (e) => {
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed) return;
					props.onCancel();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					onClick: (e) => e.stopPropagation(),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(OptimizeConfirmPanel, { ...props })
				})
			}), document.body);
		}
		/**
		* Small error modal, also portalled to `document.body` for the same
		* stacking/escaping reasons as the comparison modal.
		*/
		function ErrorToastPortal({ message, onDismiss }) {
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: modalOverlayStyle,
				onClick: (e) => {
					const selection = window.getSelection();
					if (selection && !selection.isCollapsed) return;
					onDismiss();
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: errorModalStyle,
					onClick: (e) => e.stopPropagation(),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { flex: 1 },
						children: message
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: errorDismissStyle,
						onClick: onDismiss,
						children: "×"
					})]
				})
			}), document.body);
		}
		function SparkleIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				"aria-hidden": "true",
				fill: "none",
				height: "14",
				viewBox: "0 0 16 16",
				width: "14",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 1.5l1.3 3.7L13 6.5l-3.7 1.3L8 11.5 6.7 7.8 3 6.5l3.7-1.3L8 1.5z",
					fill: "currentColor"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M12.5 10.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z",
					fill: "currentColor",
					opacity: "0.6"
				})]
			});
		}
		/**
		* Extract recent conversation context from the message array. Returns a
		* plain-text summary of the last N user/assistant turns, formatted as:
		*
		*   User: <message text>
		*   Assistant: <response text (truncated at 500 chars)>
		*
		* Returns an empty string when there are no user/assistant nodes.
		*/
		function extractConversationContext(nodes, maxTurns) {
			const relevant = [];
			for (const node of nodes) if (node.kind === "user") {
				const text = node.content.filter((c) => c.type === "text").map((c) => c.text).join("");
				if (text.trim()) relevant.push({
					role: "user",
					text: text.trim()
				});
			} else if (node.kind === "assistant") {
				const text = node.blocks.filter((b) => b.kind === "text").map((b) => b.text).join("");
				if (text.trim()) relevant.push({
					role: "assistant",
					text: text.trim().slice(0, 500)
				});
			}
			const recent = relevant.slice(-maxTurns * 2);
			if (recent.length === 0) return "";
			return recent.map((entry) => entry.role === "user" ? `User: ${entry.text}` : `Assistant: ${entry.text}`).join("\n");
		}
		const containerStyle = {
			display: "inline-flex",
			alignItems: "center",
			height: 26,
			flex: "none"
		};
		const buttonStyle$1 = (disabled) => ({
			display: "inline-flex",
			alignItems: "center",
			gap: 4,
			height: 26,
			padding: "0 8px",
			border: "none",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary, inherit)",
			cursor: disabled ? "not-allowed" : "pointer",
			opacity: disabled ? .5 : 1,
			fontSize: 12,
			flex: "none"
		});
		const modalOverlayStyle = {
			position: "fixed",
			inset: 0,
			background: "rgba(0,0,0,0.35)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 99998
		};
		const modalContentStyle = {
			padding: 14,
			borderRadius: 10,
			background: "var(--dsw-alias-bg-layer-2, #fff)",
			border: "1px solid var(--dsw-alias-border-l2, #e0e0e0)",
			boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
			width: "min(640px, 92vw)",
			zIndex: 99999
		};
		const panelTitleStyle = {
			fontSize: 14,
			fontWeight: 600,
			marginBottom: 10,
			color: "var(--dsw-alias-label-primary, inherit)"
		};
		const compareRowStyle = {
			display: "flex",
			gap: 10,
			maxHeight: 300
		};
		const compareColStyle = {
			flex: 1,
			display: "flex",
			flexDirection: "column",
			minWidth: 0
		};
		const compareLabelStyle = {
			fontSize: 11,
			color: "var(--dsw-alias-label-secondary, #888)",
			marginBottom: 4
		};
		const preStyle = {
			margin: 0,
			padding: 10,
			fontSize: 12,
			lineHeight: 1.6,
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			overflow: "auto",
			maxHeight: 240,
			borderRadius: 6,
			border: "1px solid var(--dsw-alias-border-l2, #e8e8e8)",
			background: "var(--dsw-alias-bg-layer-1, #f9f9f9)",
			color: "var(--dsw-alias-label-primary, inherit)",
			fontFamily: "inherit"
		};
		const panelActionsStyle = {
			display: "flex",
			justifyContent: "flex-end",
			gap: 8,
			marginTop: 12
		};
		const adoptBtnStyle = {
			padding: "6px 16px",
			border: "none",
			borderRadius: 6,
			background: "var(--dsw-alias-state-business-primary, #4f8cff)",
			color: "#fff",
			cursor: "pointer",
			fontSize: 13
		};
		const cancelBtnStyle = {
			padding: "6px 16px",
			border: "1px solid var(--dsw-alias-border-l2, #ddd)",
			borderRadius: 6,
			background: "transparent",
			color: "var(--dsw-alias-label-primary, inherit)",
			cursor: "pointer",
			fontSize: 13
		};
		const errorModalStyle = {
			padding: "10px 14px",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-2, #fff)",
			border: "1px solid var(--dsw-alias-state-error-secondary, #f5c2c7)",
			boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
			color: "var(--dsw-alias-state-error-primary, #c33)",
			fontSize: 13,
			display: "flex",
			alignItems: "center",
			gap: 10,
			zIndex: 99999,
			maxWidth: 420,
			width: "min(420px, 90vw)"
		};
		const errorDismissStyle = {
			border: "none",
			background: "transparent",
			color: "inherit",
			cursor: "pointer",
			fontSize: 18,
			padding: 0,
			lineHeight: 1,
			flex: "none"
		};
		//#endregion
		//#region src/client/VoiceRecognitionBar.tsx
		/** Bars in the level meter: 22 × 3 px + gaps = the 108 px the CSS reserves. */
		const METER_BARS = 22;
		/** Input level that fills the meter; speech RMS sits well below it. */
		const METER_FULL_LEVEL = .12;
		const RING_RADIUS = 7;
		const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
		/** Seconds below which the countdown turns red. */
		const COUNTDOWN_URGENT_SECONDS = 3;
		/**
		* The recognition status bar above the composer.
		*
		* Shows the live state, a stopwatch for the current listening session, a level
		* meter fed by the capture's own RMS, and — once the user has spoken and gone
		* quiet — the countdown to the silence auto-stop. Renders nothing when idle.
		*
		* Timer and level come from `session.meter`, a store that only this component
		* subscribes to: they change five times a second, which would otherwise
		* re-render the microphone button (and every other session subscriber) too.
		*/
		function VoiceRecognitionBar({ voiceSession, t }) {
			const snapshot = useVoiceInputSession(voiceSession);
			const meter = useVoiceMeter(voiceSession);
			const active = snapshot.state === "starting" || snapshot.state === "recording";
			const busy = snapshot.state === "transcribing" || snapshot.state === "polishing";
			const historyRef = (0, react.useRef)([]);
			(0, react.useEffect)(() => {
				if (!active) {
					historyRef.current = [];
					return;
				}
				const next = [...historyRef.current, meter.level];
				if (next.length > METER_BARS) next.splice(0, next.length - METER_BARS);
				historyRef.current = next;
			}, [active, meter.level]);
			const label = active ? t("listening") : snapshot.state === "transcribing" ? t("transcribing") : snapshot.state === "polishing" ? t("polishing") : snapshot.state === "polish-error" ? t("polishFailedKeepOriginal") : snapshot.state === "error" ? t("voiceFailed") : "";
			if (label === "") return null;
			const remaining = active ? meter.autoStopRemainingSeconds : null;
			const countdown = remaining === null || meter.autoStopSeconds <= 0 ? null : {
				seconds: Math.ceil(remaining),
				fraction: Math.max(0, Math.min(1, remaining / meter.autoStopSeconds))
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "sqs-bi-bar",
				"data-better-input-bar": "true",
				"data-better-input-bar-layout": "dock-card",
				"data-state": snapshot.state,
				role: "status",
				children: [
					active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sqs-bi-dot",
						"aria-hidden": "true"
					}) : busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sqs-bi-spin",
						"aria-hidden": "true"
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sqs-bi-label",
						children: label
					}),
					active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sqs-bi-clock",
						"aria-hidden": "true",
						children: formatClock(meter.elapsedSeconds)
					}) : null,
					active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LevelMeter, { history: historyRef.current }) : null,
					snapshot.detail !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "sqs-bi-detail",
						children: snapshot.detail
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "sqs-bi-space" }),
					countdown !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "sqs-bi-count",
						"data-urgent": countdown.seconds <= COUNTDOWN_URGENT_SECONDS ? "true" : "false",
						title: t("autoStopTitle", { seconds: meter.autoStopSeconds }),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CountdownRing, { fraction: countdown.fraction }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							children: t("autoStopIn", { seconds: countdown.seconds })
						})]
					}) : null,
					active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "sqs-bi-btn",
						"data-tone": "danger",
						onClick: () => voiceSession.requestStop(),
						children: t("voiceStop")
					}) : null,
					busy ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "sqs-bi-btn",
						"data-tone": "ghost",
						onClick: () => voiceSession.requestCancel(),
						children: t("voiceCancel")
					}) : null
				]
			});
		}
		/** `mm:ss`, the stopwatch shown next to the listening label. */
		function formatClock(seconds) {
			const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
			const minutes = Math.floor(total / 60);
			return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
		}
		function LevelMeter({ history }) {
			const offset = METER_BARS - history.length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "sqs-bi-meter",
				"aria-hidden": "true",
				children: Array.from({ length: METER_BARS }, (_, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: { height: `${barHeight(index >= offset ? history[index - offset] ?? 0 : 0)}px` } }, index))
			});
		}
		/** Map an RMS level onto a 2–18 px bar; square-root keeps speech readable. */
		function barHeight(level) {
			const normalized = Math.sqrt(Math.max(0, Math.min(1, level / METER_FULL_LEVEL)));
			return 2 + Math.round(normalized * 16);
		}
		function CountdownRing({ fraction }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "sqs-bi-ring",
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					className: "sqs-bi-ring-track",
					cx: "8",
					cy: "8",
					r: RING_RADIUS
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "8",
					cy: "8",
					r: RING_RADIUS,
					strokeDasharray: RING_CIRCUMFERENCE,
					strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction)
				})]
			});
		}
		//#endregion
		//#region src/client/settings-controller.ts
		const EMPTY_SPEECH = {
			service: false,
			available: false,
			providers: [],
			selection: null,
			maxRecordingSeconds: 120,
			detail: ""
		};
		const EMPTY_ABOUT = {
			repository: "",
			repositorySlug: "",
			version: "",
			license: "",
			updateCommand: "",
			updateCommandNpx: ""
		};
		const EMPTY_VIEW = {
			available: false,
			writable: false,
			settings: { ...DEFAULT_SETTINGS },
			overridden: [],
			defaultPolishPrompt: "",
			defaultOptimizePrompt: ""
		};
		/**
		* Settings read/write controller for the settings page and the microphone
		* flow. Owns the remote calls and a simple external store so both the page
		* and the voice button observe the same values. Also caches per-model
		* reasoning-effort metadata loaded lazily through resolveModelEfforts so
		* opening the effort dropdown never double-fetches across renders.
		*/
		var SettingsController = class {
			remote;
			settingsSnapshot = {
				status: "loading",
				view: EMPTY_VIEW,
				detail: ""
			};
			routesSnapshot = {
				status: "loading",
				routes: [],
				detail: ""
			};
			effortsSnapshot = {};
			aboutSnapshot = {
				status: "loading",
				about: EMPTY_ABOUT,
				detail: ""
			};
			updateSnapshot = {
				status: "idle",
				update: null,
				detail: ""
			};
			speechSnapshot = {
				status: "loading",
				view: EMPTY_SPEECH,
				preparing: false,
				detail: ""
			};
			listeners = /* @__PURE__ */ new Set();
			disposed = false;
			constructor(remote) {
				this.remote = remote;
			}
			getSettingsSnapshot = () => this.settingsSnapshot;
			getRoutesSnapshot = () => this.routesSnapshot;
			getEffortsSnapshot = () => this.effortsSnapshot;
			getAboutSnapshot = () => this.aboutSnapshot;
			getUpdateSnapshot = () => this.updateSnapshot;
			getSpeechSnapshot = () => this.speechSnapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			async refreshSettings() {
				const result = await this.remote.getSettings();
				if (this.disposed) return;
				if (!result.ok) this.settingsSnapshot = {
					status: "error",
					view: EMPTY_VIEW,
					detail: result.error.message
				};
				else {
					this.settingsSnapshot = {
						status: "ready",
						view: result.value,
						detail: ""
					};
					this.autoPopulateDefaultRoutesIfNeeded(result.value.settings);
				}
				this.emit();
			}
			/**
			* Read dsh's speech service status through the plugin's Remote.
			*
			* Never fails the page: an unavailable or provider-less speech service is a
			* legitimate state (`available: false`), so the page explains it instead of
			* showing a request error.
			*/
			async refreshSpeechStatus() {
				const preparing = this.speechSnapshot.preparing;
				let next;
				try {
					const result = await this.remote.speechStatus();
					if (this.disposed) return;
					next = result.ok ? {
						status: "ready",
						view: result.value,
						preparing,
						detail: ""
					} : {
						status: "error",
						view: EMPTY_SPEECH,
						preparing,
						detail: result.error.message
					};
				} catch (error) {
					if (this.disposed) return;
					next = {
						status: "error",
						view: EMPTY_SPEECH,
						preparing,
						detail: error instanceof Error ? error.message : String(error)
					};
				}
				this.speechSnapshot = next;
				this.emit();
			}
			/** Start (or join) dsh's provider-owned preparation task, then re-read status. */
			async prepareSpeech(providerId) {
				if (this.speechSnapshot.preparing) return false;
				this.speechSnapshot = {
					...this.speechSnapshot,
					preparing: true
				};
				this.emit();
				let ok = false;
				try {
					const result = await this.remote.speechPrepare(providerId);
					ok = result.ok;
					if (this.disposed) return ok;
					if (!result.ok) {
						this.speechSnapshot = {
							status: "error",
							view: EMPTY_SPEECH,
							preparing: false,
							detail: result.error.message
						};
						this.emit();
						return false;
					}
					this.speechSnapshot = {
						status: "ready",
						view: result.value,
						preparing: false,
						detail: ""
					};
					this.emit();
					return true;
				} catch (error) {
					if (this.disposed) return false;
					this.speechSnapshot = {
						status: "error",
						view: EMPTY_SPEECH,
						preparing: false,
						detail: error instanceof Error ? error.message : String(error)
					};
					this.emit();
					return false;
				} finally {
					if (ok) await this.refreshSpeechStatus();
				}
			}
			async refreshRoutes() {
				const result = await this.remote.listRoutes();
				if (this.disposed) return;
				if (!result.ok) this.routesSnapshot = {
					status: "error",
					routes: [],
					detail: result.error.message
				};
				else {
					this.routesSnapshot = {
						status: "ready",
						routes: result.value,
						detail: ""
					};
					if (this.settingsSnapshot.status === "ready") this.autoPopulateDefaultRoutesIfNeeded(this.settingsSnapshot.view.settings);
				}
				this.emit();
			}
			autoPopulateDefaultRoutesIfNeeded = async (settings) => {
				const polishEmpty = settings.polishProvider === "" || settings.polishModel === "";
				const optimizeEmpty = settings.optimizeProvider === "" || settings.optimizeModel === "";
				if (!polishEmpty && !optimizeEmpty) return;
				const first = (this.routesSnapshot.status === "ready" && this.routesSnapshot.routes.length > 0 ? this.routesSnapshot.routes : await (async () => {
					if (this.disposed) return [];
					const rs = await this.remote.listRoutes();
					if (this.disposed || !rs.ok) return [];
					this.routesSnapshot = {
						status: "ready",
						routes: rs.value,
						detail: ""
					};
					this.emit();
					return rs.value;
				})())[0];
				if (first === void 0) return;
				const patch = {};
				if (polishEmpty) {
					patch.polishProvider = first.provider;
					patch.polishModel = first.model;
				}
				if (optimizeEmpty) {
					patch.optimizeProvider = first.provider;
					patch.optimizeModel = first.model;
				}
				await this.update(patch);
			};
			async update(patch) {
				const result = await this.remote.updateSettings(patch);
				if (this.disposed) return false;
				if (!result.ok) return false;
				this.settingsSnapshot = {
					status: "ready",
					view: result.value,
					detail: ""
				};
				this.emit();
				return true;
			}
			/**
			* Lazily fetch reasoning efforts for a route. Results are cached in the
			* controller so changing the effort dropdown back and forth doesn't
			* re-trigger remote calls. Returns a snapshot entry immediately — the
			* caller subscribes via `useEffortsSnapshot` to re-render when the data
			* lands.
			*/
			async ensureEffortsFor(provider, model) {
				if (provider === "" || model === "" || this.disposed) return;
				const key = `${provider}\u0000${model}`;
				if (this.effortsSnapshot[key] !== void 0) return;
				this.effortsSnapshot = {
					...this.effortsSnapshot,
					[key]: {
						status: "loading",
						efforts: [],
						detail: ""
					}
				};
				this.emit();
				try {
					const result = await this.remote.resolveModelEfforts(provider, model);
					if (this.disposed) return;
					if (result.ok) this.effortsSnapshot = {
						...this.effortsSnapshot,
						[key]: {
							status: "ready",
							efforts: result.value.efforts,
							defaultEffort: result.value.defaultEffort,
							detail: ""
						}
					};
					else this.effortsSnapshot = {
						...this.effortsSnapshot,
						[key]: {
							status: "error",
							efforts: [],
							detail: result.error.message
						}
					};
				} catch (error) {
					if (this.disposed) return;
					this.effortsSnapshot = {
						...this.effortsSnapshot,
						[key]: {
							status: "error",
							efforts: [],
							detail: error instanceof Error ? error.message : String(error)
						}
					};
				}
				this.emit();
			}
			async refreshAbout() {
				const result = await this.remote.getAbout();
				if (this.disposed) return;
				if (!result.ok) this.aboutSnapshot = {
					status: "error",
					about: EMPTY_ABOUT,
					detail: result.error.message
				};
				else this.aboutSnapshot = {
					status: "ready",
					about: result.value,
					detail: ""
				};
				this.emit();
			}
			async checkForUpdate() {
				if (this.disposed) return;
				if (this.updateSnapshot.status === "loading") return;
				this.updateSnapshot = {
					status: "loading",
					update: null,
					detail: ""
				};
				this.emit();
				try {
					const result = await this.remote.checkForUpdate();
					if (this.disposed) return;
					if (result.ok) this.updateSnapshot = {
						status: "ready",
						update: result.value,
						detail: ""
					};
					else this.updateSnapshot = {
						status: "error",
						update: null,
						detail: result.error.message
					};
				} catch (error) {
					if (this.disposed) return;
					this.updateSnapshot = {
						status: "error",
						update: null,
						detail: error instanceof Error ? error.message : String(error)
					};
				}
				this.emit();
			}
			dispose() {
				this.disposed = true;
				this.listeners.clear();
			}
			emit() {
				for (const listener of this.listeners) listener();
			}
		};
		function useSettingsSnapshot(controller) {
			return (0, react.useSyncExternalStore)(controller.subscribe, controller.getSettingsSnapshot, controller.getSettingsSnapshot);
		}
		function useRoutesSnapshot(controller) {
			return (0, react.useSyncExternalStore)(controller.subscribe, controller.getRoutesSnapshot, controller.getRoutesSnapshot);
		}
		function useEffortsSnapshot(controller) {
			return (0, react.useSyncExternalStore)(controller.subscribe, controller.getEffortsSnapshot, controller.getEffortsSnapshot);
		}
		function useAboutSnapshot(controller) {
			return (0, react.useSyncExternalStore)(controller.subscribe, controller.getAboutSnapshot, controller.getAboutSnapshot);
		}
		function useUpdateSnapshot(controller) {
			return (0, react.useSyncExternalStore)(controller.subscribe, controller.getUpdateSnapshot, controller.getUpdateSnapshot);
		}
		function useSpeechSnapshot(controller) {
			return (0, react.useSyncExternalStore)(controller.subscribe, controller.getSpeechSnapshot, controller.getSpeechSnapshot);
		}
		//#endregion
		//#region src/client/settings.tsx
		/** Endonyms: a language picker is more useful in the language itself. */
		const SPEECH_LANGUAGE_NAMES = {
			zh: "中文",
			en: "English",
			ja: "日本語",
			ko: "한국어"
		};
		function speechLanguageLabel(hint, t) {
			if (hint === "yue") return t("languageCantonese");
			return SPEECH_LANGUAGE_NAMES[hint] ?? hint;
		}
		/** Host-owned preparation phases that are still in flight. */
		function isPreparingPhase(phase) {
			return phase === "checking" || phase === "loading" || phase === "waking" || phase === "cancelling" || phase === "downloading";
		}
		function ReasoningEffortSelect(props) {
			const { settingsController, provider, model, storedEffort, onChange, t } = props;
			const efforts = useEffortsSnapshot(settingsController);
			(0, react.useEffect)(() => {
				if (provider === "" || model === "") return;
				settingsController.ensureEffortsFor(provider, model);
			}, [
				settingsController,
				provider,
				model
			]);
			if (provider === "" || model === "") return null;
			const entry = efforts[`${provider}\u0000${model}`];
			if (entry === void 0 || entry.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
				value: "",
				disabled: true,
				style: inputStyle$1,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: "",
					children: t("effortLoadingLabel")
				})
			});
			if (entry.status === "error" || entry.efforts.length === 0) return null;
			const items = entry.efforts;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				value: storedEffort,
				onChange: (event) => onChange(event.target.value),
				style: inputStyle$1,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: "",
					children: t("effortDefaultLabel")
				}), items.map((effort) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: effort.id,
					title: effort.description,
					children: effort.name
				}, effort.id))]
			});
		}
		/**
		* The BetterInput settings page. Renders the recognition and polishing
		* configuration; every field edits a local draft and saves on blur/change.
		*/
		function BetterInputSettingsSection({ close, settingsController, t }) {
			const settings = useSettingsSnapshot(settingsController);
			const routes = useRoutesSnapshot(settingsController);
			const about = useAboutSnapshot(settingsController);
			const update = useUpdateSnapshot(settingsController);
			const speech = useSpeechSnapshot(settingsController);
			const [drafts, setDrafts] = (0, react.useState)({});
			const [saveFailed, setSaveFailed] = (0, react.useState)(false);
			const [showDefaultPrompt, setShowDefaultPrompt] = (0, react.useState)(false);
			const [showDefaultOptimizePrompt, setShowDefaultOptimizePrompt] = (0, react.useState)(false);
			const draftsRef = (0, react.useRef)(drafts);
			draftsRef.current = drafts;
			(0, react.useEffect)(() => {
				settingsController.refreshSettings();
				settingsController.refreshRoutes();
				settingsController.refreshAbout();
				settingsController.refreshSpeechStatus();
			}, [settingsController]);
			const speechAwaitingRoster = speech.status === "ready" && speech.view.service && !speech.view.available;
			const speechPreparing = speech.preparing || speech.view.providers.some((provider) => isPreparingPhase(provider.preparation));
			(0, react.useEffect)(() => {
				if (!speechPreparing && !speechAwaitingRoster) return;
				let remaining = 20;
				const timer = setInterval(() => {
					remaining -= 1;
					if (remaining <= 0) clearInterval(timer);
					settingsController.refreshSpeechStatus();
				}, 1e3);
				return () => clearInterval(timer);
			}, [
				settingsController,
				speechPreparing,
				speechAwaitingRoster
			]);
			if (settings.status === "loading" || routes.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionFrame$1, {
				title: t("settingsTitle"),
				children: t("loading")
			});
			const field = (name, current) => ({
				text: drafts[name] ?? current,
				invalid: false
			});
			const setField = (name, value) => {
				setDrafts((prev) => ({
					...prev,
					[name]: value
				}));
			};
			const save = async (patch) => {
				setSaveFailed(false);
				if (await settingsController.update(patch)) setDrafts((prev) => {
					const next = { ...prev };
					for (const key of Object.keys(patch)) delete next[key];
					return next;
				});
				else setSaveFailed(true);
			};
			const s = settings.view.settings;
			const secondsField = field("maxRecordingSeconds", String(s.maxRecordingSeconds));
			const segmentField = field("segmentSeconds", String(s.segmentSeconds));
			const autoStopField = field("autoStopSeconds", String(s.autoStopSeconds));
			const polishPromptField = field("polishPrompt", s.polishPrompt);
			const optimizePromptField = field("optimizePrompt", s.optimizePrompt);
			const contextTurnsField = field("contextTurns", String(s.contextTurns));
			const maxRecordingSeconds = speech.view.available ? speech.view.maxRecordingSeconds : 120;
			const provider = speech.view.providers.find((item) => item.id === speech.view.selection?.providerId) ?? speech.view.providers[0];
			const speechReady = provider !== void 0 && (provider.preparation === "ready" || provider.preparation === "standby");
			const speechNeedsPrepare = provider !== void 0 && !speechReady && !isPreparingPhase(provider.preparation);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SectionFrame$1, {
				title: t("settingsTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: hintStyle$1,
						children: t("settingsDescription")
					}),
					saveFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle$1,
						children: t("saveFailed")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: sectionTitleStyle,
						children: t("voiceSectionLabel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("speechStatusLabel"),
						hint: speech.status === "error" ? speech.detail : speech.view.detail,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: statusRowStyle,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: speechReady ? statusOkStyle : statusWarnStyle,
									children: speech.status === "loading" ? t("loading") : speechReady ? `${provider?.name ?? ""} · ${t("speechStatusReady")}` : speech.view.service && !speech.view.available ? t("speechStatusPreparing") : isPreparingPhase(provider?.preparation ?? "") ? t("speechStatusPreparing") : t("speechStatusUnavailable")
								}),
								provider !== void 0 && provider.detail !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: statusDetailStyle,
									children: provider.detail
								}) : null,
								speechNeedsPrepare ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: toggleLinkStyle,
									onClick: () => void settingsController.prepareSpeech(provider?.id ?? ""),
									children: t("speechPrepareButton")
								}) : null,
								speech.preparing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: statusDetailStyle,
									children: t("speechPrepareBusy")
								}) : null
							]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("languageLabel"),
						hint: t("languageHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							value: s.language,
							onChange: (event) => void save({ language: event.target.value }),
							style: inputStyle$1,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("languageAuto")
							}), SPEECH_LANGUAGE_HINTS.map((hint) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: hint,
								children: speechLanguageLabel(hint, t)
							}, hint))]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("recordingLimitLabel"),
						hint: t("recordingLimitHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							max: maxRecordingSeconds,
							value: secondsField.text,
							onChange: (event) => setField("maxRecordingSeconds", event.target.value),
							onBlur: () => {
								const parsed = Number(secondsField.text);
								if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxRecordingSeconds) return;
								save({ maxRecordingSeconds: parsed });
							},
							style: inputStyle$1
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("streamingPreviewLabel"),
						hint: t("streamingPreviewHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: switchStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: s.streamingPreview,
								onChange: (event) => void save({ streamingPreview: event.target.checked })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: s.streamingPreview ? t("on") : t("off") })]
						})
					}),
					s.streamingPreview ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("segmentSecondsLabel"),
						hint: t("segmentSecondsHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							max: 10,
							value: segmentField.text,
							onChange: (event) => setField("segmentSeconds", event.target.value),
							onBlur: () => {
								const parsed = Number(segmentField.text);
								if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 10) return;
								save({ segmentSeconds: parsed });
							},
							style: inputStyle$1
						})
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("autoStopLabel"),
						hint: t("autoStopHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 0,
							max: 120,
							value: autoStopField.text,
							onChange: (event) => setField("autoStopSeconds", event.target.value),
							onBlur: () => {
								const parsed = Number(autoStopField.text);
								if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 120) return;
								if (parsed !== 0 && parsed < 3) return;
								save({ autoStopSeconds: parsed });
							},
							style: inputStyle$1
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: sectionTitleStyle,
						children: t("polishSectionLabel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("polishLabel"),
						hint: t("polishHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							style: switchStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: s.polishingEnabled,
								onChange: (event) => void save({ polishingEnabled: event.target.checked })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: s.polishingEnabled ? t("on") : t("off") })]
						})
					}),
					s.polishingEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("polishModelLabel"),
							hint: t("polishModelHint"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								value: drafts.polishProvider !== void 0 || drafts.polishModel !== void 0 ? `${drafts.polishProvider ?? s.polishProvider}\u0000${drafts.polishModel ?? s.polishModel}` : `${s.polishProvider}\u0000${s.polishModel}`,
								onChange: (event) => {
									const [provider, model] = event.target.value.split("\0");
									save({
										polishProvider: provider ?? "",
										polishModel: model ?? ""
									});
								},
								style: inputStyle$1,
								disabled: routes.status !== "ready" || routes.routes.length === 0,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "\0",
									children: t("polishModelNone")
								}), routes.status === "ready" && routes.routes.map((route) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
									value: `${route.provider}\u0000${route.model}`,
									children: [
										route.providerName,
										" / ",
										route.modelName
									]
								}, `${route.provider}\u0000${route.model}`))]
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
							label: t("polishEffortLabel"),
							hint: t("polishEffortHint"),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReasoningEffortSelect, {
								settingsController,
								provider: s.polishProvider,
								model: s.polishModel,
								storedEffort: s.polishReasoningEffort,
								onChange: (effortId) => void save({ polishReasoningEffort: effortId }),
								t
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
							label: t("polishPromptLabel"),
							hint: t("polishPromptHint"),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								value: polishPromptField.text,
								rows: 5,
								placeholder: t("polishPromptPlaceholder"),
								onChange: (event) => setField("polishPrompt", event.target.value),
								onBlur: () => void save({ polishPrompt: polishPromptField.text }),
								style: {
									...inputStyle$1,
									resize: "vertical",
									fontFamily: "monospace"
								}
							}), settings.view.defaultPolishPrompt !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setShowDefaultPrompt((prev) => !prev),
								style: toggleLinkStyle,
								children: showDefaultPrompt ? t("hideDefaultPrompt") : t("showDefaultPrompt")
							}), showDefaultPrompt ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								style: {
									margin: "6px 0 0",
									padding: 8,
									maxHeight: 220,
									overflow: "auto",
									whiteSpace: "pre-wrap",
									wordBreak: "break-word",
									fontSize: 11,
									lineHeight: 1.5,
									background: "var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))",
									border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))",
									borderRadius: 6,
									fontFamily: "monospace"
								},
								children: settings.view.defaultPolishPrompt
							}) : null] }) : null]
						})
					] }) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: {
							margin: "16px 0 0",
							fontSize: 14
						},
						children: t("optimizeSectionLabel")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("optimizeModelLabel"),
						hint: t("optimizeModelHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							value: drafts.optimizeProvider !== void 0 || drafts.optimizeModel !== void 0 ? `${drafts.optimizeProvider ?? s.optimizeProvider}\u0000${drafts.optimizeModel ?? s.optimizeModel}` : `${s.optimizeProvider}\u0000${s.optimizeModel}`,
							onChange: (event) => {
								const [provider, model] = event.target.value.split("\0");
								save({
									optimizeProvider: provider ?? "",
									optimizeModel: model ?? ""
								});
							},
							style: inputStyle$1,
							disabled: routes.status !== "ready" || routes.routes.length === 0,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "\0",
								children: t("polishModelNone")
							}), routes.status === "ready" && routes.routes.map((route) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
								value: `${route.provider}\u0000${route.model}`,
								children: [
									route.providerName,
									" / ",
									route.modelName
								]
							}, `${route.provider}\u0000${route.model}`))]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("optimizeEffortLabel"),
						hint: t("optimizeEffortHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReasoningEffortSelect, {
							settingsController,
							provider: s.optimizeProvider,
							model: s.optimizeModel,
							storedEffort: s.optimizeReasoningEffort,
							onChange: (effortId) => void save({ optimizeReasoningEffort: effortId }),
							t
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Field, {
						label: t("optimizePromptLabel"),
						hint: t("optimizePromptHint"),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							value: optimizePromptField.text,
							rows: 5,
							placeholder: t("optimizePromptPlaceholder"),
							onChange: (event) => setField("optimizePrompt", event.target.value),
							onBlur: () => void save({ optimizePrompt: optimizePromptField.text }),
							style: {
								...inputStyle$1,
								resize: "vertical",
								fontFamily: "monospace"
							}
						}), settings.view.defaultOptimizePrompt !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setShowDefaultOptimizePrompt((prev) => !prev),
							style: toggleLinkStyle,
							children: showDefaultOptimizePrompt ? t("hideDefaultPrompt") : t("showDefaultPrompt")
						}), showDefaultOptimizePrompt ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
							style: {
								margin: "6px 0 0",
								padding: 8,
								maxHeight: 220,
								overflow: "auto",
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								fontSize: 11,
								lineHeight: 1.5,
								background: "var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))",
								border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))",
								borderRadius: 6,
								fontFamily: "monospace"
							},
							children: settings.view.defaultOptimizePrompt
						}) : null] }) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("contextTurnsLabel"),
						hint: t("contextTurnsHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 0,
							max: 20,
							value: contextTurnsField.text,
							onChange: (event) => setField("contextTurns", event.target.value),
							onBlur: () => {
								const parsed = Number(contextTurnsField.text);
								if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 20) return;
								save({ contextTurns: parsed });
							},
							style: inputStyle$1
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						style: hintStyle$1,
						children: [
							t("routesStatus"),
							": ",
							routes.status === "ready" ? `${routes.routes.length}` : routes.detail || t("routesUnavailable")
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", { style: dividerStyle }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AboutUpdateSection, {
						aboutStatus: about.status,
						version: about.about.version,
						repository: about.about.repository,
						license: about.about.license,
						update,
						t,
						onCheckUpdate: () => void settingsController.checkForUpdate()
					})
				]
			});
		}
		function AboutUpdateSection(props) {
			const { aboutStatus, version, repository, license, update, t, onCheckUpdate } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 8
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						style: {
							margin: 0,
							fontSize: 14
						},
						children: t("aboutTitle")
					}),
					aboutStatus === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: 2,
							fontSize: 13,
							opacity: .85
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("aboutVersionLabel"),
								": ",
								version || "—"
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								t("aboutLicenseLabel"),
								": ",
								license || "—"
							] }),
							repository !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
								href: repository,
								target: "_blank",
								rel: "noreferrer",
								style: { color: "var(--dsw-alias-state-business-primary, #4f8cff)" },
								children: [
									t("aboutRepositoryLabel"),
									": ",
									repository
								]
							}) : null,
							repository !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
								href: `${repository.replace(/\/+$/, "")}/blob/main/CHANGELOG.md`,
								target: "_blank",
								rel: "noreferrer",
								style: { color: "var(--dsw-alias-state-business-primary, #4f8cff)" },
								children: t("aboutChangelogLabel")
							}) : null
						]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: 6
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onCheckUpdate,
								disabled: update.status === "loading",
								style: {
									width: "fit-content",
									padding: "6px 12px",
									borderRadius: 6,
									border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))",
									background: "var(--dsh-color-surface, transparent)",
									color: "var(--dsw-alias-label-primary, inherit)",
									fontSize: 13,
									cursor: update.status === "loading" ? "default" : "pointer"
								},
								children: update.status === "loading" ? t("checkingUpdate") : t("checkUpdateButton")
							}),
							update.status === "ready" && update.update !== null ? (() => {
								const status = update.update.status;
								if (status === "up-to-date") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle$1,
									children: t("updateUpToDate")
								});
								if (status === "unpublished") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: hintStyle$1,
									children: t("updateUnpublished")
								});
								if (status === "update-available") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										flexDirection: "column",
										gap: 4
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
											style: {
												...hintStyle$1,
												color: "var(--dsw-alias-state-error-primary, #e5484d)"
											},
											children: [
												t("updateAvailable"),
												": ",
												update.update.installed,
												" → ",
												update.update.latest
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: hintStyle$1,
											children: [t("updateCommandLabel"), ":"]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
											style: codeStyle,
											children: update.update.updateCommand
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: hintStyle$1,
											children: [t("updateCommandNpxLabel"), ":"]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
											style: codeStyle,
											children: update.update.updateCommandNpx
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: hintStyle$1,
											children: [t("updateCommandPick"), ":"]
										})
									]
								});
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: errorStyle$1,
									children: t("updateCheckFailed")
								});
							})() : null,
							update.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								style: errorStyle$1,
								children: [
									t("updateCheckFailed"),
									": ",
									update.detail
								]
							}) : null
						]
					})
				]
			});
		}
		function SectionFrame$1({ title, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: 16,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					style: {
						margin: 0,
						fontSize: 16
					},
					children: title
				}), children]
			});
		}
		function Field({ label, hint, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 4
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: 13,
							fontWeight: 600
						},
						children: label
					}),
					children,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle$1,
						children: hint
					})
				]
			});
		}
		const inputStyle$1 = {
			padding: "6px 8px",
			borderRadius: 6,
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))",
			background: "var(--dsw-alias-bg-layer-1, #f9f9f9)",
			color: "var(--dsw-alias-label-primary, inherit)",
			fontSize: 13
		};
		const hintStyle$1 = {
			margin: 0,
			fontSize: 12,
			opacity: .7
		};
		const errorStyle$1 = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-state-error-primary, #e5484d)"
		};
		const statusRowStyle = {
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 8,
			fontSize: 13
		};
		const statusOkStyle = { color: "var(--dsw-alias-state-success-primary, #2f9e44)" };
		const statusWarnStyle = { color: "var(--dsw-alias-state-warning-primary, #b8860b)" };
		const statusDetailStyle = {
			opacity: .7,
			fontSize: 12
		};
		const switchStyle = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			fontSize: 13
		};
		const toggleLinkStyle = {
			marginTop: 6,
			padding: 0,
			border: "none",
			background: "none",
			color: "var(--dsw-alias-state-business-primary, #4f8cff)",
			fontSize: 12,
			cursor: "pointer",
			textDecoration: "underline"
		};
		const dividerStyle = {
			margin: "8px 0",
			border: "none",
			borderTop: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))"
		};
		const sectionTitleStyle = {
			margin: "16px 0 0",
			fontSize: 14
		};
		const codeStyle = {
			padding: "6px 8px",
			overflow: "auto",
			whiteSpace: "pre-wrap",
			wordBreak: "break-all",
			fontSize: 12,
			fontFamily: "monospace",
			background: "var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))",
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))",
			borderRadius: 6
		};
		//#endregion
		//#region src/client/templates-source.ts
		/** Unique source name on the `/` trigger (the menu group title). */
		const TEMPLATES_SOURCE_NAME = "better-input-templates";
		const MAX_CANDIDATES = 50;
		/**
		* The input-trigger source that inserts stored prompt templates as literal
		* text on the `/` trigger.
		*
		* - `warm()` prefetches the template list when the input box mounts, so the
		*   first `/` keystroke already shows entries.
		* - `candidates()` filters by name / description / tag substring.
		* - `onPick()` returns `{ text: content }` — the trigger token span is
		*   replaced by the template body, so `/name` never persists in the draft
		*   and no lexicon/codec registration is needed.
		*/
		function createTemplatesSource(controller) {
			return {
				trigger: "/",
				name: TEMPLATES_SOURCE_NAME,
				order: 300,
				showGroupTitle: true,
				async candidates(_session, req) {
					const query = req.query.trim().toLowerCase();
					const templates = controller.getSnapshot().templates;
					return (query === "" ? templates : templates.filter((template) => template.name.toLowerCase().includes(query) || template.description !== "" && template.description.toLowerCase().includes(query) || template.tags.some((tag) => tag.toLowerCase().includes(query)))).slice(0, MAX_CANDIDATES).map((template) => ({
						name: template.name,
						...template.description === "" ? {} : { description: template.description },
						...template.tags.length === 0 ? {} : { hint: template.tags.join(" / ") },
						value: template.id
					}));
				},
				onPick(pick) {
					const id = pick.candidate.value ?? "";
					const template = controller.byId(id);
					if (template === void 0) return;
					return { text: template.content };
				},
				warm(_session) {
					controller.ensureLoaded();
				}
			};
		}
		//#endregion
		//#region src/client/templates-controller.ts
		/**
		* Client-side store for the prompt template library. Mirrors the settings
		* controller: an external-store class consumed via useSyncExternalStore,
		* one sticky initial fetch (also kicked off by the `/` trigger warm hook),
		* and optimistic list updates after save/remove so the menu and the settings
		* section stay in sync without refetching.
		*/
		const EMPTY_SNAPSHOT = {
			status: "loading",
			templates: [],
			detail: ""
		};
		function sortByRecency(templates) {
			return [...templates].sort((left, right) => right.updatedAt - left.updatedAt);
		}
		/** Split on ASCII and full-width commas, trim, drop empties. */
		function parseTags(raw) {
			return raw.split(/[,，]/).map((tag) => tag.trim()).filter((tag) => tag !== "");
		}
		var TemplatesController = class {
			remote;
			snapshot = EMPTY_SNAPSHOT;
			listeners = /* @__PURE__ */ new Set();
			disposed = false;
			loadPromise;
			constructor(remote) {
				this.remote = remote;
			}
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			byId = (id) => this.snapshot.templates.find((template) => template.id === id);
			/** Kick off the one-time initial fetch; safe to call repeatedly. */
			ensureLoaded = () => {
				if (this.loadPromise !== void 0 || this.disposed) return;
				this.loadPromise = this.refresh();
			};
			async refresh() {
				try {
					const result = await this.remote.templatesList();
					if (this.disposed) return;
					if (result.ok) this.snapshot = {
						status: "ready",
						templates: sortByRecency(result.value.templates),
						detail: ""
					};
					else this.snapshot = {
						status: "error",
						templates: [],
						detail: result.error.message
					};
				} catch (error) {
					if (this.disposed) return;
					this.snapshot = {
						status: "error",
						templates: [],
						detail: error instanceof Error ? error.message : String(error)
					};
				}
				this.emit();
			}
			/** Create or update one template; resolves false when the call failed. */
			async save(draft) {
				const tags = parseTags(draft.tags);
				const input = {
					name: draft.name,
					content: draft.content,
					...draft.id === void 0 ? {} : { id: draft.id },
					...draft.description === "" ? {} : { description: draft.description },
					...tags.length === 0 ? {} : { tags }
				};
				try {
					const result = await this.remote.templatesSave(input);
					if (this.disposed || !result.ok) return false;
					const saved = result.value.template;
					const rest = this.snapshot.templates.filter((template) => template.id !== saved.id);
					this.snapshot = {
						...this.snapshot,
						status: "ready",
						templates: sortByRecency([...rest, saved])
					};
					this.emit();
					return true;
				} catch {
					return false;
				}
			}
			/** Remove one template; resolves false when the call failed. */
			async remove(id) {
				try {
					const result = await this.remote.templatesRemove(id);
					if (this.disposed || !result.ok || !result.value.removed) return false;
					this.snapshot = {
						...this.snapshot,
						templates: this.snapshot.templates.filter((template) => template.id !== id)
					};
					this.emit();
					return true;
				} catch {
					return false;
				}
			}
			dispose() {
				this.disposed = true;
				this.listeners.clear();
			}
			emit() {
				for (const listener of this.listeners) listener();
			}
		};
		function useTemplatesSnapshot(controller) {
			return (0, react.useSyncExternalStore)(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
		}
		//#endregion
		//#region src/templates/model.ts
		const MAX_TEMPLATE_CONTENT_LENGTH = 8e3;
		//#endregion
		//#region src/client/templates-section.tsx
		/**
		* Settings section for the prompt template library: list saved templates,
		* create/edit through an inline form, and delete with a two-step confirm.
		* Mirrors the settings section conventions (framework-injected `t` + local
		* frame/field components + dsw CSS variables).
		*/
		const EMPTY_DRAFT = {
			name: "",
			description: "",
			tags: "",
			content: ""
		};
		function draftFromTemplate(template) {
			return {
				id: template.id,
				name: template.name,
				description: template.description,
				tags: [...template.tags].join(", "),
				content: template.content
			};
		}
		function TemplatesSection({ t, templatesController }) {
			const snapshot = useTemplatesSnapshot(templatesController);
			const [editor, setEditor] = (0, react.useState)({ kind: "closed" });
			const [busy, setBusy] = (0, react.useState)(false);
			const [actionFailed, setActionFailed] = (0, react.useState)(false);
			const [armedDeleteId, setArmedDeleteId] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				templatesController.refresh();
			}, [templatesController]);
			if (snapshot.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionFrame, {
				title: t("templatesTitle"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: hintStyle,
					children: t("loading")
				})
			});
			if (snapshot.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SectionFrame, {
				title: t("templatesTitle"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
					style: errorStyle,
					children: [
						t("templatesLoadFailed"),
						": ",
						snapshot.detail
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: buttonStyle,
					onClick: () => void templatesController.refresh(),
					children: t("templatesRetry")
				})]
			});
			const editing = editor.kind === "open" ? editor.draft : null;
			const saveDraft = async () => {
				if (editing === null || busy) return;
				if (editing.name.trim() === "" || editing.content.trim() === "") return;
				setBusy(true);
				setActionFailed(false);
				const ok = await templatesController.save(editing);
				setBusy(false);
				if (ok) setEditor({ kind: "closed" });
				else setActionFailed(true);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(SectionFrame, {
				title: t("templatesTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: hintStyle,
						children: t("templatesDescription")
					}),
					actionFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle,
						children: t("templatesActionFailed")
					}) : null,
					editing === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: buttonStyle,
						onClick: () => {
							setActionFailed(false);
							setArmedDeleteId(null);
							setEditor({
								kind: "open",
								draft: EMPTY_DRAFT
							});
						},
						children: t("templatesNew")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: editorStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 4
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: labelStyle,
									children: t("templatesNameLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: editing.name,
									maxLength: 60,
									placeholder: t("templatesNamePlaceholder"),
									onChange: (event) => setEditor({
										kind: "open",
										draft: {
											...editing,
											name: event.target.value
										}
									}),
									style: inputStyle
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 4
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: labelStyle,
									children: t("templatesDescriptionLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: editing.description,
									maxLength: 200,
									placeholder: t("templatesDescriptionPlaceholder"),
									onChange: (event) => setEditor({
										kind: "open",
										draft: {
											...editing,
											description: event.target.value
										}
									}),
									style: inputStyle
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 4
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: labelStyle,
									children: t("templatesTagsLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: editing.tags,
									placeholder: t("templatesTagsHint"),
									onChange: (event) => setEditor({
										kind: "open",
										draft: {
											...editing,
											tags: event.target.value
										}
									}),
									style: inputStyle
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: 4
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: labelStyle,
										children: t("templatesContentLabel")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										value: editing.content,
										rows: 6,
										maxLength: MAX_TEMPLATE_CONTENT_LENGTH,
										placeholder: t("templatesContentPlaceholder"),
										onChange: (event) => setEditor({
											kind: "open",
											draft: {
												...editing,
												content: event.target.value
											}
										}),
										style: {
											...inputStyle,
											resize: "vertical",
											fontFamily: "monospace"
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: hintStyle,
										children: [
											editing.content.length,
											" / ",
											MAX_TEMPLATE_CONTENT_LENGTH
										]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle,
									disabled: busy || editing.name.trim() === "" || editing.content.trim() === "",
									onClick: () => void saveDraft(),
									children: t("templatesSave")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle,
									disabled: busy,
									onClick: () => {
										setEditor({ kind: "closed" });
										setActionFailed(false);
									},
									children: t("templatesCancel")
								})]
							})
						]
					}),
					snapshot.templates.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: hintStyle,
						children: t("templatesEmpty")
					}) : null,
					snapshot.templates.map((template) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: cardStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "baseline",
									justifyContent: "space-between",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									style: { fontSize: 13 },
									children: template.name
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: hintStyle,
									children: new Date(template.updatedAt).toLocaleDateString()
								})]
							}),
							template.description !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: hintStyle,
								children: template.description
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: previewStyle,
								children: template.content.length > 120 ? `${template.content.slice(0, 120)}…` : template.content
							}),
							template.tags.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									display: "flex",
									flexWrap: "wrap",
									gap: 4
								},
								children: template.tags.map((tag) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: tagStyle,
									children: tag
								}, tag))
							}) : null,
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: buttonStyle,
									onClick: () => {
										setActionFailed(false);
										setArmedDeleteId(null);
										setEditor({
											kind: "open",
											draft: draftFromTemplate(template)
										});
									},
									children: t("templatesEdit")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									style: armedDeleteId === template.id ? deleteArmedStyle : buttonStyle,
									onClick: () => {
										if (armedDeleteId !== template.id) {
											setArmedDeleteId(template.id);
											return;
										}
										setArmedDeleteId(null);
										templatesController.remove(template.id).then((ok) => {
											if (!ok) setActionFailed(true);
										});
									},
									children: armedDeleteId === template.id ? t("templatesDeleteConfirm") : t("templatesDelete")
								})]
							})
						]
					}, template.id))
				]
			});
		}
		function SectionFrame({ title, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: 16,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					style: {
						margin: 0,
						fontSize: 16
					},
					children: title
				}), children]
			});
		}
		const editorStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 8,
			padding: 12,
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))",
			borderRadius: 6,
			background: "var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))"
		};
		const cardStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 6,
			padding: 12,
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))",
			borderRadius: 6
		};
		const previewStyle = {
			margin: 0,
			fontSize: 12,
			fontFamily: "monospace",
			whiteSpace: "pre-wrap",
			wordBreak: "break-all",
			opacity: .8
		};
		const tagStyle = {
			padding: "1px 6px",
			fontSize: 11,
			borderRadius: 4,
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))",
			opacity: .85
		};
		const labelStyle = {
			fontSize: 13,
			fontWeight: 600
		};
		const buttonStyle = {
			width: "fit-content",
			padding: "6px 12px",
			borderRadius: 6,
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))",
			background: "var(--dsh-color-surface, transparent)",
			color: "var(--dsw-alias-label-primary, inherit)",
			fontSize: 13,
			cursor: "pointer"
		};
		const deleteArmedStyle = {
			...buttonStyle,
			borderColor: "var(--dsw-alias-state-error-primary, #e5484d)",
			color: "var(--dsw-alias-state-error-primary, #e5484d)"
		};
		const inputStyle = {
			padding: "6px 8px",
			borderRadius: 6,
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))",
			background: "var(--dsw-alias-bg-layer-1, #f9f9f9)",
			color: "var(--dsw-alias-label-primary, inherit)",
			fontSize: 13
		};
		const hintStyle = {
			margin: 0,
			fontSize: 12,
			opacity: .7
		};
		const errorStyle = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-state-error-primary, #e5484d)"
		};
		//#endregion
		//#region src/client/styles.ts
		/**
		* Plugin-owned stylesheet, injected once into `document.head`.
		*
		* The status bar lives in `conversation.input.dock`, the same slot dsh's own
		* QueueDock occupies. A dock child is stretched to the **full width of the
		* conversation column** by the flex parent, so it must constrain itself or it
		* draws wider than the composer card above which it sits — dsh's QueueDock does
		* exactly this:
		*
		*   width: calc(100% - 2 * clearance - 2 * inset); max-width: card - 2 * inset
		*
		* We mirror the same two custom properties (`--dsh-composer-card-max-width`,
		* `--dsh-composer-side-clearance`) without the extra dock inset, so the bar lines
		* up edge to edge with the composer card in every layout, including the narrow
		* `embedded` variant. Fallbacks keep it sane if a future dsh drops the names.
		*/
		const PLUGIN_CSS = `
.sqs-bi-bar {
  box-sizing: border-box;
  width: calc(100% - 2 * var(--dsh-composer-side-clearance, 16px));
  max-width: var(--dsh-composer-card-max-width, 952px);
  margin: 0 auto;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 3px 8px;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.1));
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 18px;
  position: relative;
  overflow: hidden;
}
.sqs-bi-bar:after {
  content: "";
  position: absolute;
  inset: 0;
  border: 0.5px solid var(--dsw-alias-border-l1, transparent);
  border-radius: inherit;
  pointer-events: none;
}
.sqs-bi-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-error-secondary, #e5484d);
  animation: sqs-bi-pulse 1.2s ease-in-out infinite;
}
.sqs-bi-spin {
  flex: none;
  width: 11px;
  height: 11px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  opacity: 0.7;
  animation: sqs-bi-spin 0.9s linear infinite;
}
.sqs-bi-label {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary, inherit);
  font-weight: 500;
}
.sqs-bi-detail {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.75;
}
.sqs-bi-clock {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  padding: 0 6px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.16));
  color: var(--dsw-alias-label-primary, inherit);
}
.sqs-bi-meter {
  flex: 0 1 108px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 18px;
  overflow: hidden;
  opacity: 0.55;
}
.sqs-bi-meter i {
  flex: none;
  display: block;
  width: 3px;
  border-radius: 2px;
  background: currentColor;
  transition: height 0.12s linear;
}
.sqs-bi-space {
  flex: 1 1 auto;
  min-width: 4px;
}
.sqs-bi-count {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  padding: 0 6px 0 4px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.16));
  color: var(--dsw-alias-label-primary, inherit);
}
.sqs-bi-count[data-urgent="true"] {
  color: var(--dsw-alias-state-error-secondary, #e5484d);
}
.sqs-bi-ring {
  flex: none;
  transform: rotate(-90deg);
}
.sqs-bi-ring circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.sqs-bi-ring .sqs-bi-ring-track {
  opacity: 0.25;
}
.sqs-bi-btn {
  flex: none;
  appearance: none;
  border: 0;
  border-radius: 6px;
  padding: 3px 10px;
  font: inherit;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  color: inherit;
}
.sqs-bi-btn[data-tone="ghost"]:hover {
  background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.16));
}
.sqs-bi-btn[data-tone="danger"] {
  background: var(--dsw-alias-state-error-secondary, #e5484d);
  color: #fff;
}
.sqs-bi-btn[data-tone="danger"]:hover {
  filter: brightness(1.06);
}
.sqs-bi-bar[data-state="error"] .sqs-bi-label,
.sqs-bi-bar[data-state="polish-error"] .sqs-bi-label {
  color: var(--dsw-alias-state-error-secondary, #e5484d);
}
@keyframes sqs-bi-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes sqs-bi-spin {
  to { transform: rotate(360deg); }
}
`;
		//#endregion
		//#region src/client/index.ts
		/**
		* Required Client services: the slot registry, the Typert remote hub, and
		* the DSH locale runtime. `remote.betterInput` is mounted by this plugin's
		* own apply() via `ctx.remote.$mount`, so it MUST NOT appear here — the
		* outer inject gates plugin activation and would deadlock waiting for
		* itself. It is declared only on the inner ctx.inject() below, which runs
		* after the mount. Settings reach the browser through `SettingsScopeBinder`
		* (provided by `@deepseek-ai/dsh-client-ui-settings`) and are read inside
		* the settings section slot itself, not via a top-level `settings` service
		* here.
		*/
		const inject = [
			"slots",
			"remote",
			"locale",
			"inputTriggers",
			"conversation"
		];
		async function apply(ctx) {
			const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
			const disposeLocaleDicts = ctx.locale.register(BETTER_INPUT_NS, {
				zh,
				en
			});
			await ctx.inject([
				"slots",
				"remote",
				"remote.betterInput",
				"inputTriggers",
				"conversation"
			], async (remoteCtx) => {
				const remote = remoteCtx.remote.betterInput;
				const controller = new SettingsController(remote);
				const templatesController = new TemplatesController(remote);
				const voiceSessions = /* @__PURE__ */ new Map();
				const voiceSessionFor = (sessionId) => {
					let session = voiceSessions.get(sessionId);
					if (session === void 0) {
						session = new VoiceInputSession();
						voiceSessions.set(sessionId, session);
					}
					return session;
				};
				const disposeTemplatesSource = remoteCtx.inputTriggers.registerSource(createTemplatesSource(templatesController));
				remoteCtx.effect(() => () => {
					for (const session of voiceSessions.values()) session.dispose();
					voiceSessions.clear();
					disposeTemplatesSource();
					controller.dispose();
					templatesController.dispose();
				}, "sqs-dsh-better-input sessions lifecycle");
				remoteCtx.effect(() => {
					const styleTag = document.createElement("style");
					styleTag.dataset.plugin = "sqs-dsh-better-input";
					styleTag.textContent = PLUGIN_CSS;
					document.head.appendChild(styleTag);
					return () => {
						styleTag.remove();
					};
				}, "sqs-dsh-better-input styles");
				controller.refreshSettings();
				controller.refreshRoutes();
				templatesController.ensureLoaded();
				const useSettings = () => {
					const snapshot = useSettingsSnapshot(controller);
					if (snapshot.status !== "ready") return {
						status: "loading",
						settings: snapshot.view.settings
					};
					return {
						status: "ready",
						settings: snapshot.view.settings
					};
				};
				remoteCtx.slots.inject("conversation.input.dock", () => remoteCtx.slots.register({
					name: "conversation.input.dock",
					id: "better-input-recognition-bar",
					order: 15,
					locale: BETTER_INPUT_NS,
					inject: (sessionId) => ({ voiceSession: voiceSessionFor(sessionId) })
				}, VoiceRecognitionBar));
				remoteCtx.slots.inject("conversation.input.right", () => remoteCtx.slots.register({
					name: "conversation.input.right",
					id: "better-input-optimize",
					order: 9998,
					locale: BETTER_INPUT_NS,
					inject: () => ({
						remote,
						useSettings
					})
				}, OptimizeButton));
				remoteCtx.slots.inject("conversation.input.right", () => remoteCtx.slots.register({
					name: "conversation.input.right",
					id: "better-input-voice",
					order: 9999,
					locale: BETTER_INPUT_NS,
					inject: (sessionId) => ({
						remote,
						voiceSession: voiceSessionFor(sessionId),
						useSettings
					})
				}, MicrophoneButton));
				remoteCtx.slots.inject("settings.section", () => remoteCtx.slots.register({
					name: "settings.section",
					id: "sqs-dsh-better-input",
					order: 16,
					label: () => ctx.locale.bind(BETTER_INPUT_NS)("settingsTitle"),
					locale: BETTER_INPUT_NS,
					inject: () => ({ settingsController: controller })
				}, BetterInputSettingsSection));
				remoteCtx.slots.inject("settings.section", () => remoteCtx.slots.register({
					name: "settings.section",
					id: "sqs-dsh-better-input-templates",
					order: 17,
					label: () => ctx.locale.bind(BETTER_INPUT_NS)("templatesTitle"),
					locale: BETTER_INPUT_NS,
					inject: () => ({ templatesController })
				}, TemplatesSection));
				return () => {};
			});
			return async () => {
				disposeLocaleDicts();
				await disposeRemote();
			};
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map