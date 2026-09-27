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
		* not an assumption — it is how dsh 0.1.7 is wired:
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
				}
			]
		};
		//#endregion
		//#region src/client/strings.ts
		const zh = {
			voiceStart: "语音输入",
			voiceStop: "停止语音输入",
			voiceBusy: "正在处理…",
			voiceUnavailable: "此浏览器不支持语音识别",
			listening: "正在聆听…",
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
			languageHint: "留空时跟随浏览器语言。",
			languagePlaceholder: "例如 zh-CN 或 en-US",
			recordingLimitLabel: "单次录音上限（秒）",
			recordingLimitHint: "1–600 秒。",
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
			voiceUnavailable: "Speech recognition is not supported in this browser",
			listening: "Listening…",
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
			languageHint: "Empty follows the browser language.",
			languagePlaceholder: "e.g. zh-CN or en-US",
			recordingLimitLabel: "Recording limit (seconds)",
			recordingLimitHint: "1–600 seconds.",
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
		/**
		* Recognition language derived from the browser locale. An empty stored
		* language follows the UI.
		*/
		function recognitionLanguageFromBrowser() {
			if (typeof navigator === "undefined") return "en-US";
			return (navigator.language ?? "").toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
		}
		function effectiveRecognitionLanguage(stored) {
			const value = stored.trim();
			return value === "" ? recognitionLanguageFromBrowser() : value;
		}
		function isValidRecordingLimit(value) {
			return Number.isSafeInteger(value) && value >= 1 && value <= 600;
		}
		/** Resolve the effective recording cap from stored settings. */
		function effectiveRecordingSeconds(settings) {
			return isValidRecordingLimit(settings.maxRecordingSeconds) ? settings.maxRecordingSeconds : 120;
		}
		//#endregion
		//#region src/client/web-speech.ts
		var WebSpeechSession = class {
			recognition;
			options;
			active = false;
			stopping = false;
			finalText = "";
			lastHeard = "";
			ended = false;
			silent = false;
			constructor(options) {
				const Recognition = getSpeechRecognitionConstructor();
				if (Recognition === void 0) throw new Error("Speech recognition is unavailable in this browser");
				this.options = options;
				this.recognition = new Recognition();
				this.recognition.lang = options.language;
				this.recognition.continuous = true;
				this.recognition.interimResults = true;
				this.recognition.maxAlternatives = 1;
				this.recognition.onstart = () => options.onStart?.();
				this.recognition.onresult = (event) => this.handleResult(event);
				this.recognition.onerror = (event) => this.handleError(event);
				this.recognition.onend = () => this.handleEnd();
			}
			start() {
				if (this.active || this.ended || this.silent) return;
				this.active = true;
				this.stopping = false;
				try {
					this.recognition.start();
				} catch (error) {
					this.fail(error instanceof Error ? error : new Error(String(error)));
				}
			}
			stop() {
				if (!this.active || this.ended || this.silent) return;
				this.stopping = true;
				this.active = false;
				try {
					this.recognition.stop();
				} catch {
					this.endOnce();
				}
			}
			abort() {
				if (this.ended || this.silent) return;
				this.silent = true;
				this.stopping = true;
				this.active = false;
				this.recognition.onstart = null;
				this.recognition.onresult = null;
				this.recognition.onerror = null;
				this.recognition.onend = null;
				try {
					this.recognition.abort();
				} catch {}
				this.ended = true;
			}
			handleResult(event) {
				if (this.silent || this.ended) return;
				let finalChunk = "";
				let interimChunk = "";
				for (let index = event.resultIndex; index < event.results.length; index += 1) {
					const result = event.results[index];
					const transcript = result?.[0]?.transcript ?? "";
					if (result?.isFinal === true) finalChunk = appendSpeech(finalChunk, transcript);
					else interimChunk = appendSpeech(interimChunk, transcript);
				}
				if (finalChunk !== "") {
					this.finalText = appendSpeech(this.finalText, finalChunk);
					this.lastHeard = this.finalText;
					this.options.onFinal(this.finalText);
				}
				const heard = appendSpeech(this.finalText, interimChunk);
				if (heard !== "") this.lastHeard = heard;
				this.options.onInterim(heard);
			}
			handleError(event) {
				if (this.stopping || this.silent || this.ended) return;
				const code = event.error ?? "unknown";
				const detail = event.message === void 0 ? "" : `: ${event.message}`;
				this.fail(/* @__PURE__ */ new Error(`Speech recognition failed (${code})${detail}`));
			}
			handleEnd() {
				if (this.silent || this.ended) return;
				if (this.active && !this.stopping) try {
					this.recognition.start();
					return;
				} catch (error) {
					this.fail(error instanceof Error ? error : new Error(String(error)));
					return;
				}
				this.endOnce();
			}
			fail(error) {
				if (this.stopping || this.silent || this.ended) return;
				this.active = false;
				this.stopping = true;
				this.options.onError(error);
				try {
					this.recognition.abort();
				} catch {}
				this.endOnce();
			}
			endOnce() {
				if (this.ended || this.silent) return;
				this.ended = true;
				this.options.onEnd(this.finalText !== "" ? this.finalText : this.lastHeard);
			}
		};
		function appendSpeech(current, next) {
			if (next === "") return current;
			if (current === "") return next;
			if (/\s$/.test(current) || /^\s/.test(next)) return current + next;
			return `${current} ${next}`;
		}
		function getSpeechRecognitionConstructor() {
			if (typeof window === "undefined") return void 0;
			const speechWindow = window;
			return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
		}
		//#endregion
		//#region src/client/voice-session.ts
		const NOTICE_STATES = /* @__PURE__ */ new Set(["error", "polish-error"]);
		const VOICE_ERROR_DISMISS_MS = 2600;
		/**
		* Shared voice-input state for one session, written from scratch for
		* sqs-dsh-better-input. The microphone button and the recognition bar both
		* subscribe; the bar can request stop/cancel through the same instance.
		*/
		var VoiceInputSession = class {
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
		//#endregion
		//#region src/client/MicrophoneButton.tsx
		/**
		* The microphone button in the composer tool row. Click to start listening,
		* click again to stop. Transcripts stream into the draft in real time; when
		* polishing is enabled, the committed transcript is polished through the Host
		* LLM route and replaces the draft (unless the user edited it meanwhile).
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
			const startListening = () => {
				if (active || busy) return;
				const baseDraft = input.draft;
				baseDraftRef.current = baseDraft;
				let sessionDraft = baseDraft;
				let failed = false;
				setState("starting");
				let session;
				try {
					session = new WebSpeechSession({
						language: effectiveRecognitionLanguage(settingsRef.current?.language ?? ""),
						onInterim: (text) => {
							sessionDraft = updateDraft(baseDraft, text);
							inputActions.setDraft(sessionDraft);
						},
						onFinal: (text) => {
							sessionDraft = updateDraft(baseDraft, text);
							inputActions.setDraft(sessionDraft);
						},
						onError: (error) => {
							failed = true;
							setState("error", error.message);
						},
						onEnd: (text) => {
							speechRef.current = null;
							clearRecordingTimer(recordingTimerRef);
							if (!mountedRef.current) return;
							const transcript = text.trim();
							if (failed) return;
							if (transcript === "") {
								setState("idle");
								return;
							}
							const draftAtStop = updateDraft(baseDraft, transcript);
							inputActions.setDraft(draftAtStop);
							latestDraftRef.current = draftAtStop;
							const settings = settingsRef.current;
							if (settings !== null && settings.polishingEnabled && settings.polishProvider.trim() !== "" && settings.polishModel.trim() !== "") polishDraft({
								transcript,
								baseDraft,
								draftAtStop,
								provider: settings.polishProvider,
								model: settings.polishModel,
								remote,
								setState,
								latestDraftRef,
								actionsRef: { current: inputActions },
								polishAbortRef
							});
							else setState("idle");
						}
					});
				} catch (error) {
					if (mountedRef.current) setState("error", error instanceof Error ? error.message : "Speech recognition is unavailable in this browser");
					return;
				}
				speechRef.current = session;
				session.start();
				if (failed) return;
				setState("recording");
				armRecordingTimer(recordingTimerRef, effectiveRecordingSeconds(settingsRef.current ?? { maxRecordingSeconds: 120 }), () => {
					speechRef.current?.stop();
				});
			};
			const stopListening = () => {
				clearRecordingTimer(recordingTimerRef);
				if (!active) return;
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
		* Only replace the draft when the user has not edited it since the transcript
		* landed. Both the transcript-at-stop and the base draft count as unchanged
		* (the user may have reverted the interim edits).
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
		/**
		* The recognition status bar above the composer. Shows live state and a stop
		* button while recording; the bar renders nothing when idle.
		*/
		function VoiceRecognitionBar({ voiceSession, t }) {
			const snapshot = useVoiceInputSession(voiceSession);
			const active = snapshot.state === "starting" || snapshot.state === "recording";
			const label = active ? t("listening") : snapshot.state === "transcribing" ? t("transcribing") : snapshot.state === "polishing" ? t("polishing") : snapshot.state === "polish-error" ? t("polishFailedKeepOriginal") : snapshot.state === "error" ? t("voiceFailed") : "";
			if (label === "") return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-better-input-bar": "true",
				role: "status",
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "4px 10px",
					borderRadius: 8,
					fontSize: 12,
					lineHeight: "18px",
					background: "var(--dsw-alias-bg-layer-3, rgba(0,0,0,0.04))",
					color: "var(--dsw-alias-label-primary, inherit)"
				},
				children: [
					active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PulsingDot, {}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }),
					(snapshot.state === "error" || snapshot.state === "polish-error") && snapshot.detail !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: { opacity: .7 },
						children: snapshot.detail
					}) : null,
					active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => voiceSession.requestStop(),
						style: {
							marginLeft: "auto",
							padding: "2px 8px",
							border: "none",
							borderRadius: 6,
							fontSize: 12,
							background: "var(--dsw-alias-state-error-secondary, #e5484d)",
							color: "#fff",
							cursor: "pointer"
						},
						children: t("voiceStop")
					}) : null
				]
			});
		}
		function PulsingDot() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				style: {
					width: 8,
					height: 8,
					borderRadius: "50%",
					background: "var(--dsw-alias-state-error-secondary, #e5484d)",
					animation: "sqs-dsh-better-input-pulse 1.2s ease-in-out infinite"
				}
			});
		}
		//#endregion
		//#region src/client/settings-controller.ts
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
		//#endregion
		//#region src/client/settings.tsx
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
			}, [settingsController]);
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
			const languageField = field("language", s.language);
			const secondsField = field("maxRecordingSeconds", String(s.maxRecordingSeconds));
			const polishPromptField = field("polishPrompt", s.polishPrompt);
			const optimizePromptField = field("optimizePrompt", s.optimizePrompt);
			const contextTurnsField = field("contextTurns", String(s.contextTurns));
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
						label: t("languageLabel"),
						hint: t("languageHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "text",
							value: languageField.text,
							placeholder: t("languagePlaceholder"),
							onChange: (event) => setField("language", event.target.value),
							onBlur: () => void save({ language: languageField.text.trim() }),
							style: inputStyle$1
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Field, {
						label: t("recordingLimitLabel"),
						hint: t("recordingLimitHint"),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "number",
							min: 1,
							max: 600,
							value: secondsField.text,
							onChange: (event) => setField("maxRecordingSeconds", event.target.value),
							onBlur: () => {
								const parsed = Number(secondsField.text);
								if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 600) return;
								save({ maxRecordingSeconds: parsed });
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
		//#region src/client/index.ts
		const PULSE_KEYFRAMES = `@keyframes sqs-dsh-better-input-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}`;
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
					styleTag.textContent = PULSE_KEYFRAMES;
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