/**
 * Bilingual UI strings for sqs-dsh-better-input (zh/en). Registered as one
 * namespace into the DSH locale runtime; every slot component declares that
 * namespace and reads copy through the framework-injected `t` seat, so the
 * UI follows the DSH settings language switch automatically.
 */
export type BetterInputStrings = {
  voiceStart: string
  voiceStop: string
  voiceBusy: string
  voicePermissionDenied: string
  voiceNoDevice: string
  voiceCaptureUnavailable: string
  listening: string
  voiceCancel: string
  autoStopIn: string
  autoStopTitle: string
  autoStopLabel: string
  autoStopHint: string
  transcribing: string
  polishing: string
  voiceFailed: string
  polishNotConfigured: string
  polishFailedKeepOriginal: string
  settingsTitle: string
  settingsDescription: string
  loading: string
  saveFailed: string
  languageLabel: string
  languageHint: string
  languageAuto: string
  languageCantonese: string
  speechStatusLabel: string
  speechStatusReady: string
  speechStatusUnavailable: string
  speechStatusPreparing: string
  speechPrepareButton: string
  speechPrepareBusy: string
  recordingLimitLabel: string
  recordingLimitHint: string
  streamingPreviewLabel: string
  streamingPreviewHint: string
  segmentSecondsLabel: string
  segmentSecondsHint: string
  polishLabel: string
  polishHint: string
  on: string
  off: string
  polishFollowLabel: string
  polishFollowHint: string
  polishModelLabel: string
  polishModelHint: string
  polishModelNone: string
  /** Shown in place of the model row while the feature follows the composer. */
  followModelBadge: string
  /** Shown when follow is on but the Host resolved the configured route anyway. */
  followModelFallbackBadge: string
  /** Shown while the Host-resolved route is still unknown. */
  followModelResolving: string
  /** Shown when the composer's selection cannot be read (optional service absent). */
  followModelUnknown: string
  polishEffortLabel: string
  polishEffortHint: string
  polishPromptLabel: string
  polishPromptHint: string
  polishPromptPlaceholder: string
  showDefaultPrompt: string
  hideDefaultPrompt: string
  defaultPromptLabel: string
  effortDefaultLabel: string
  effortLoadingLabel: string
  routesStatus: string
  routesUnavailable: string
  optimizeButton: string
  optimizeBusy: string
  optimizeFailed: string
  optimizeEmpty: string
  optimizePanelTitle: string
  optimizeOriginalLabel: string
  optimizeOptimizedLabel: string
  optimizeAdopt: string
  optimizeCancel: string
  optimizeNotConfigured: string
  optimizeSectionLabel: string
  optimizeFollowLabel: string
  optimizeFollowHint: string
  optimizeModelLabel: string
  optimizeModelHint: string
  optimizeEffortLabel: string
  optimizeEffortHint: string
  optimizePromptLabel: string
  optimizePromptHint: string
  optimizePromptPlaceholder: string
  contextTurnsLabel: string
  contextTurnsHint: string
  aboutTitle: string
  aboutVersionLabel: string
  aboutRepositoryLabel: string
  aboutChangelogLabel: string
  aboutLicenseLabel: string
  checkUpdateButton: string
  checkingUpdate: string
  updateUpToDate: string
  updateAvailable: string
  updateUnpublished: string
  updateCheckFailed: string
  updateCommandLabel: string
  updateCommandNpxLabel: string
  updateCommandPick: string
  voiceSectionLabel: string
  polishSectionLabel: string
  templatesTitle: string
  templatesDescription: string
  templatesNew: string
  templatesEdit: string
  templatesSave: string
  templatesCancel: string
  templatesDelete: string
  templatesDeleteConfirm: string
  templatesEmpty: string
  templatesLoadFailed: string
  templatesRetry: string
  templatesActionFailed: string
  templatesNameLabel: string
  templatesNamePlaceholder: string
  templatesDescriptionLabel: string
  templatesDescriptionPlaceholder: string
  templatesContentLabel: string
  templatesContentPlaceholder: string
  templatesTagsLabel: string
  templatesTagsHint: string
}

export const zh: BetterInputStrings = {
  voiceStart: '语音输入',
  voiceStop: '停止语音输入',
  voiceBusy: '正在处理…',
  voicePermissionDenied: '麦克风权限被拒绝',
  voiceNoDevice: '未检测到可用的麦克风设备，请先接入麦克风后重试',
  voiceCaptureUnavailable: '无法访问麦克风（需要 HTTPS 或 localhost）',
  listening: '正在聆听…',
  voiceCancel: '取消',
  autoStopIn: '{seconds} 秒后自动停止',
  autoStopTitle: '说完后静音 {seconds} 秒会自动停止并开始转写',
  autoStopLabel: '静音自动停止（秒）',
  autoStopHint: '说话后静音这么久就自动停止并开始转写；0 为关闭。默认 10 秒；关闭后只受“单次录音上限”约束。',
  transcribing: '正在转写…',
  polishing: '正在润色…',
  voiceFailed: '语音输入失败',
  polishNotConfigured: '未配置润色模型，请在设置页选择',
  polishFailedKeepOriginal: '润色失败，已保留原文',
  settingsTitle: 'BetterInput 设置',
  settingsDescription: '配置语音识别与 AI 润色。润色复用你在 dsh 设置里已配置的模型，无需额外 API key。',
  loading: '加载中…',
  saveFailed: '保存失败，请重试',
  languageLabel: '识别语言',
  languageHint: '由 dsh 本地识别器（SenseVoice）提供，选「自动检测」时由模型判断语种。',
  languageAuto: '自动检测',
  languageCantonese: '粤语',
  speechStatusLabel: '本地识别器',
  speechStatusReady: '已就绪',
  speechStatusUnavailable: '不可用',
  speechStatusPreparing: '准备中',
  speechPrepareButton: '下载并准备模型',
  speechPrepareBusy: '准备中…',
  recordingLimitLabel: '单次录音上限（秒）',
  recordingLimitHint: '1–120 秒。上限来自 dsh 本地识别服务（16 kHz 单声道）。',
  streamingPreviewLabel: '边录边出字（分段预览）',
  streamingPreviewHint: '边说边把分段转写流式写入输入框；停止后再用整段录音重转一次作为最终稿，然后润色。关闭则只在停止后转写一次。',
  segmentSecondsLabel: '分段长度（秒）',
  segmentSecondsHint: '1–10 秒，默认 3。优先在静音处切分；越短上屏越快、越容易切断词。',
  polishLabel: 'AI 润色',
  polishHint: '识别完成后用大模型清理转写文本（去口头禅、修正同音错字、加标点）。',
  on: '开',
  off: '关',
  polishFollowLabel: '跟随输入框所选模型',
  polishFollowHint: '开启后，润色使用输入框当前选中的模型，切换模型即时生效；思考强度由下面的「润色思考强度」独立控制，不跟随输入框。下方润色模型仅在关闭此项、或无法读取输入框模型时生效。',
  polishModelLabel: '润色模型',
  polishModelHint: '「跟随输入框所选模型」关闭时使用的模型路由。',
  polishModelNone: '（未选择）',
  followModelBadge: '自动跟随',
  followModelFallbackBadge: '未跟随，用下方配置',
  followModelResolving: '读取中…',
  followModelUnknown: '未读取到输入框模型（跟随不可用时回退到下方配置）',
  polishEffortLabel: '润色思考强度',
  polishEffortHint: '控制润色的推理深度，与输入框的思考强度无关（提高它会增加费用）。「默认」即关闭思考，适合大多数场景。',
  polishPromptLabel: '自定义润色提示词',
  polishPromptHint: '留空使用内置提示词。自定义提示词总是追加输出契约保护。',
  polishPromptPlaceholder: '可选：粘贴自定义提示词…',
  showDefaultPrompt: '查看内置提示词',
  hideDefaultPrompt: '收起内置提示词',
  defaultPromptLabel: '内置提示词',
  effortDefaultLabel: '默认（关闭思考）',
  effortLoadingLabel: '加载思考强度选项…',
  routesStatus: '可用模型路由',
  routesUnavailable: '不可用',
  optimizeButton: '优化提示词',
  optimizeBusy: '优化中…',
  optimizeFailed: '优化失败，请重试',
  optimizeEmpty: '输入框为空，无需优化',
  optimizePanelTitle: '提示词优化结果',
  optimizeOriginalLabel: '原文',
  optimizeOptimizedLabel: '优化后',
  optimizeAdopt: '采纳',
  optimizeCancel: '取消',
  optimizeNotConfigured: '未配置优化模型，请在设置页开启',
  optimizeSectionLabel: '提示词优化',
  optimizeFollowLabel: '跟随输入框所选模型',
  optimizeFollowHint: '开启后，提示词优化使用输入框当前选中的模型，切换模型即时生效；思考强度由下面的「优化思考强度」独立控制，不跟随输入框。下方优化模型仅在关闭此项、或无法读取输入框模型时生效。',
  optimizeModelLabel: '优化模型',
  optimizeModelHint: '「跟随输入框所选模型」关闭时使用的模型路由。',
  optimizeEffortLabel: '优化思考强度',
  optimizeEffortHint: '控制提示词优化的推理深度，与输入框的思考强度无关（提高它会增加费用）。「默认」即关闭思考，适合大多数场景。',
  optimizePromptLabel: '自定义优化提示词',
  optimizePromptHint: '留空使用内置提示词。自定义提示词总是追加输出契约保护。',
  optimizePromptPlaceholder: '可选：粘贴自定义提示词…',
  contextTurnsLabel: '上下文引用轮数',
  contextTurnsHint: '优化时引用最近 N 轮对话作为上下文，0 为禁用。默认 3 轮。',
  aboutTitle: '关于与更新',
  aboutVersionLabel: '当前版本',
  aboutRepositoryLabel: '项目地址',
  aboutChangelogLabel: '更新日志',
  aboutLicenseLabel: '许可证',
  checkUpdateButton: '检查更新',
  checkingUpdate: '检查中…',
  updateUpToDate: '当前已是最新版本。',
  updateAvailable: '发现新版本',
  updateUnpublished: '该版本未在 npm 上公开发布。',
  updateCheckFailed: '检查更新失败',
  updateCommandLabel: '已全局安装 dsh CLI，执行',
  updateCommandNpxLabel: '未全局安装，改用 npx 执行',
  updateCommandPick: '按你的安装方式二选一即可',
  voiceSectionLabel: '语音识别',
  polishSectionLabel: '提示词润色',
  templatesTitle: '提示词模板',
  templatesDescription: '把常用提示词存成模板，在输入框键入 / 即可搜索并插入。',
  templatesNew: '新建模板',
  templatesEdit: '编辑',
  templatesSave: '保存',
  templatesCancel: '取消',
  templatesDelete: '删除',
  templatesDeleteConfirm: '再次点击确认删除',
  templatesEmpty: '还没有模板，点击「新建模板」创建第一个。',
  templatesLoadFailed: '模板加载失败',
  templatesRetry: '重试',
  templatesActionFailed: '操作失败，请重试',
  templatesNameLabel: '名称',
  templatesNamePlaceholder: '例如：代码评审助手',
  templatesDescriptionLabel: '描述',
  templatesDescriptionPlaceholder: '可选：这个模板用来做什么',
  templatesContentLabel: '内容',
  templatesContentPlaceholder: '插入输入框的提示词正文…',
  templatesTagsLabel: '标签',
  templatesTagsHint: '逗号分隔，最多 8 个，用于菜单搜索。'
}

export const en: BetterInputStrings = {
  voiceStart: 'Voice input',
  voiceStop: 'Stop voice input',
  voiceBusy: 'Processing…',
  voicePermissionDenied: 'Microphone permission was denied',
  voiceNoDevice: 'No microphone was found — connect one and try again',
  voiceCaptureUnavailable: 'Cannot access the microphone (HTTPS or localhost required)',
  listening: 'Listening…',
  voiceCancel: 'Cancel',
  autoStopIn: 'Auto-stop in {seconds}s',
  autoStopTitle: 'Stops and transcribes after {seconds} seconds without speech',
  autoStopLabel: 'Auto-stop after silence (seconds)',
  autoStopHint: 'Stop and transcribe once this many seconds pass without speech; 0 disables it. 10 by default; with it off only the recording limit applies.',
  transcribing: 'Transcribing…',
  polishing: 'Polishing…',
  voiceFailed: 'Voice input failed',
  polishNotConfigured: 'No polish model configured, please choose one in Settings',
  polishFailedKeepOriginal: 'Polishing failed, original kept',
  settingsTitle: 'BetterInput Settings',
  settingsDescription: 'Configure voice recognition and AI polishing. Polishing reuses the models already configured in dsh — no extra API key needed.',
  loading: 'Loading…',
  saveFailed: 'Failed to save, please retry',
  languageLabel: 'Recognition language',
  languageHint: 'Provided by the dsh local recognizer (SenseVoice). Automatic lets the model decide.',
  languageAuto: 'Automatic',
  languageCantonese: 'Cantonese',
  speechStatusLabel: 'Local recognizer',
  speechStatusReady: 'Ready',
  speechStatusUnavailable: 'Unavailable',
  speechStatusPreparing: 'Preparing',
  speechPrepareButton: 'Download and prepare',
  speechPrepareBusy: 'Preparing…',
  recordingLimitLabel: 'Recording limit (seconds)',
  recordingLimitHint: '1–120 seconds. The ceiling comes from the dsh local recognition service (16 kHz mono).',
  streamingPreviewLabel: 'Stream text while recording (segmented preview)',
  streamingPreviewHint: 'Transcribes in segments and streams them into the draft as you speak; after you stop, the whole recording is transcribed once more as the final transcript, then polished. Off transcribes only once, after stopping.',
  segmentSecondsLabel: 'Segment length (seconds)',
  segmentSecondsHint: '1–10 seconds, 3 by default. Segments are cut at pauses when possible; shorter shows text sooner but splits words more often.',
  polishLabel: 'AI polishing',
  polishHint: 'Clean the transcript with an LLM after recognition (fillers, homophone fixes, punctuation).',
  on: 'On',
  off: 'Off',
  polishFollowLabel: 'Follow the composer model',
  polishFollowHint: 'When on, polishing runs on the model currently selected in the input box — switching models takes effect immediately. The thinking effort is set independently by "Polishing thinking effort" below and does not follow the input box. The polish model below applies only while this is off, or when the composer selection cannot be read.',
  polishModelLabel: 'Polish model',
  polishModelHint: 'Model route used when "follow the composer model" is off.',
  polishModelNone: '(none)',
  followModelBadge: 'Following the input box',
  followModelFallbackBadge: 'Not following — using the route below',
  followModelResolving: 'Resolving…',
  followModelUnknown: 'Composer model unavailable — falling back to the route below',
  polishEffortLabel: 'Polishing thinking effort',
  polishEffortHint: 'Controls how deeply polishing thinks, independent of the input box effort (raising it costs more). Default means thinking off, which suits most cases.',
  polishPromptLabel: 'Custom polish prompt',
  polishPromptHint: 'Empty uses the built-in prompt. A custom prompt always keeps the output-contract guard.',
  polishPromptPlaceholder: 'Optional: paste a custom prompt…',
  showDefaultPrompt: 'Show the built-in prompt',
  hideDefaultPrompt: 'Hide the built-in prompt',
  defaultPromptLabel: 'Built-in prompt',
  effortDefaultLabel: 'Default (thinking off)',
  effortLoadingLabel: 'Loading reasoning effort options…',
  routesStatus: 'Available model routes',
  routesUnavailable: 'unavailable',
  optimizeButton: 'Optimize prompt',
  optimizeBusy: 'Optimizing…',
  optimizeFailed: 'Optimization failed, please retry',
  optimizeEmpty: 'Input is empty, nothing to optimize',
  optimizePanelTitle: 'Prompt optimization result',
  optimizeOriginalLabel: 'Original',
  optimizeOptimizedLabel: 'Optimized',
  optimizeAdopt: 'Adopt',
  optimizeCancel: 'Cancel',
  optimizeNotConfigured: 'No optimize model configured, enable it in Settings',
  optimizeSectionLabel: 'Prompt optimization',
  optimizeFollowLabel: 'Follow the composer model',
  optimizeFollowHint: 'When on, prompt optimization runs on the model currently selected in the input box — switching models takes effect immediately. The thinking effort is set independently by "Optimize thinking effort" below and does not follow the input box. The optimize model below applies only while this is off, or when the composer selection cannot be read.',
  optimizeModelLabel: 'Optimize model',
  optimizeModelHint: 'Model route used when "follow the composer model" is off.',
  optimizeEffortLabel: 'Optimize thinking effort',
  optimizeEffortHint: 'Controls how deeply prompt optimization thinks, independent of the input box effort (raising it costs more). Default means thinking off, which suits most cases.',
  optimizePromptLabel: 'Custom optimize prompt',
  optimizePromptHint: 'Empty uses the built-in prompt. A custom prompt always keeps the output-contract guard.',
  optimizePromptPlaceholder: 'Optional: paste a custom prompt…',
  contextTurnsLabel: 'Context turns',
  contextTurnsHint: 'Include recent N turns as context for optimization. 0 = disabled. Default 3.',
  aboutTitle: 'About & Updates',
  aboutVersionLabel: 'Installed version',
  aboutRepositoryLabel: 'Repository',
  aboutChangelogLabel: 'Changelog',
  aboutLicenseLabel: 'License',
  checkUpdateButton: 'Check for updates',
  checkingUpdate: 'Checking…',
  updateUpToDate: 'You are up to date.',
  updateAvailable: 'A new version is available',
  updateUnpublished: 'This version is not published on npm.',
  updateCheckFailed: 'Update check failed',
  updateCommandLabel: 'With a global dsh CLI, run',
  updateCommandNpxLabel: 'Without a global dsh CLI, run via npx',
  updateCommandPick: 'Use either one depending on how you installed DSH',
  voiceSectionLabel: 'Voice Recognition',
  polishSectionLabel: 'Prompt Polishing',
  templatesTitle: 'Prompt Templates',
  templatesDescription: 'Save frequently used prompts as templates, then type / in the input box to search and insert.',
  templatesNew: 'New template',
  templatesEdit: 'Edit',
  templatesSave: 'Save',
  templatesCancel: 'Cancel',
  templatesDelete: 'Delete',
  templatesDeleteConfirm: 'Click again to confirm',
  templatesEmpty: 'No templates yet. Create your first one with "New template".',
  templatesLoadFailed: 'Failed to load templates',
  templatesRetry: 'Retry',
  templatesActionFailed: 'Action failed, please retry',
  templatesNameLabel: 'Name',
  templatesNamePlaceholder: 'e.g. Code review assistant',
  templatesDescriptionLabel: 'Description',
  templatesDescriptionPlaceholder: 'Optional: what this template is for',
  templatesContentLabel: 'Content',
  templatesContentPlaceholder: 'Prompt body inserted into the input box…',
  templatesTagsLabel: 'Tags',
  templatesTagsHint: 'Comma separated, up to 8, used for menu search.'
}

/** Namespace owning every BetterInput surface string. Registered into the DSH
 * locale runtime; slots declaring this namespace receive the typed `t`. */
export const BETTER_INPUT_NS = 'better-input'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  /** BetterInput dictionary keys (one shared key set, zh/en bilingual). */
  interface LocaleNamespaceMap {
    'better-input': keyof BetterInputStrings
  }
}
