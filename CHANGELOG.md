# 更新日志

本仓库为 [`dsh-better-input`](https://github.com/DIAG5/dsh-better-input) 的二次开发版本，
由 **sanqianshuang** 维护，包名为 **`sqs-dsh-better-input`**。

> 历史沿革：本包在仓库内部曾用名 `sanqianshuang-better-input`（内部版本号 0.1.0–0.1.2），
> **从未发布到 npm**。首次公开发布统一改名为 `sqs-dsh-better-input`，版本号自 `0.1.0` 起算，
> 因此不再保留那些未发布的中间版本号。

## [0.2.0-rc.2] - 2026-09-30

**版本号与所适配的 DSH 主线同号**：本版专门适配 DSH **`0.2.0-rc.2`**，插件版本号即取该号，
一眼即可判断该装哪一版（`0.1.0` 适配的是 DSH `0.1.7-rc.2`）。

本版两个主题：

1. **语音识别改用 DSH 自带的本地识别器**（`ctx.speechToText` → SenseVoice），
   不再使用浏览器的 Web Speech API。音频不再离开本机，也不再依赖浏览器厂商的云端识别。
2. **修复 `0.1.0` 在 DSH `0.2.0-rc.2` 上被整体静默丢弃**（peer 范围上界写错，
   详见下文「修复」第一条），并新增构建守卫防复发。

> 本条目合并了此前仓库内部的两个版本号 `0.2.0` 与 `0.3.0`：二者**都从未发布到 npm**
> （npm 上只有 `0.1.0`），因此它们属于同一次发布。框架适配那一步的原始记录保留在
> 文末的「同版包含」小节。

### 变更

- **采集层替换：Web Speech API → DSH 原生语音服务**。
  浏览器只负责录音（16 kHz 单声道 PCM16 WAV），转写交给 dsh 的语音服务，
  由 `@deepseek-ai/dsh-experimental-voice-input-bundle` 提供的本地 SenseVoice 在
  **本机 CPU** 上完成。删除了 `src/client/web-speech.ts`，
  新增 `src/client/audio-capture.ts`（采集 / 重采样 / WAV 编码 / 切片）与
  `src/client/native-speech.ts`（分段调度 + 终稿）。
  收益：**离线可用、音频不出机器、无需浏览器厂商凭据**。
  代价：识别语种收窄为 SenseVoice 支持的 `自动 / 中文 / 英语 / 粤语 / 日语 / 韩语`。

- **保留流式上屏：分段伪流式 + 整段终稿（两遍）**。
  dsh 的语音服务**只有整段转写**（其 README 明确写 "Streaming recognition … have no
  service methods"），因此"边说边出字"由本插件自己做：录制时按**静音优先、默认 3 秒**
  切段并逐段转写，文字持续流入输入框；停止后再用**整段录音**转写一次作为**最终稿**
  替换预览，然后才进入 AI 润色。这样分段只影响预览观感，不会污染最终文本。
  设置页可关闭流式预览（退化为"停止后转写一次"）并调整分段长度（1–10 秒）。

- **润色链路不变，但竞态判据更严格**。润色仍只由"停止后的最终稿"触发，
  仍走原来的 Host `polish` RPC 与 `polishingEnabled` 设置。
  由于预览文本与最终稿可能不同，"是否被用户改过"的判据从
  `baseDraft`/`draftAtStop` 改为**本会话最后写入草稿的完整文本**，
  你录制期间手动编辑过草稿时，最终稿与润色结果都不会覆盖你的编辑。

- **语言设置改为下拉**（`自动 / 中文 / English / 粤语 / 日本語 / 한국어`）。
  旧值若是 BCP-47（`zh-CN`、`en-US`）会在读取时自动映射到对应提示；
  映射不到的值退化为"自动检测"，不会让录音直接失败
  （dsh 的 `resolve()` 对未声明的语言会抛错）。

- **单次录音上限从 1–600 秒收紧到 1–120 秒**，与 dsh 语音服务的默认上限一致
  （`maxDurationSeconds: 120` / `maxAudioBytes: 4 MiB`）。旧配置里大于 120 秒的值
  会在读取时自动修正为 120，避免"任何一次保存都失败"。

### 新增

- **Host 侧 3 个 RPC**（新服务 `BetterInputSpeech`，与既有服务共用 `betterInput` 命名空间）：
  `speechStatus`（识别器列表与就绪状态）、`speechPrepare`（Download and prepare）、
  `transcribeSpeech`（一次整段转写，带取消）。
- **`src/speech/wave.ts`**：插件自己的音频入口校验。
  音频经本插件自己的 Remote 到达 Host，**不会**经过 dsh 语音 Remote 的
  `validateWave`，所以这里逐字段镜像了 dsh 的规范 WAV 校验，并在此处拒绝超限录音。
- **`scripts/check-speech-audio.ts` + `npm run check:speech`（已并入 `verify`）**：
  用 **dsh 自己的 `validateWave` 作权威判据**做差分测试 —— 编码器输出必须被 dsh 接受、
  200 个随机录音的长度判读必须与 dsh 完全一致、7 类畸形头部必须双方都拒绝、
  base64 往返必须逐字节相同、120 秒边界两侧都必须一致；同时校验旧设置的迁移
  （`zh-CN → zh`、600 秒 → 120 秒）。已用"把编码器采样率写错"作负向对照验证它确实会失败。

- **识别条重做为「计时 + 音量 + 倒计时」，并新增可配置的静音自动停止**。
  识别条现在显示 **已监听时长**（`mm:ss`，等宽数字）、**实时音量波形**（取自采集侧的
  RMS，一眼看出麦克风是否收到声音）以及**静音倒计时**：说过话之后一旦静音，条上出现
  `10 秒后自动停止` 的环形倒计时，归零即自动停止 → 转写 → 润色，不用再点一次按钮；
  倒计时期间重新开口会自动重新计时，也可以随时点「停止语音输入」提前结束。
  新设置项 **「静音自动停止」**（`autoStopSeconds`）：`0` = 关闭，3–120 秒，**默认 10**。
  倒计时**只在说过话之后**才开始，所以误点麦克风不会几秒后被悄悄取消（那种情况仍由
  「单次录音上限」兜底）。转写 / 润色阶段还补上了「取消」按钮
  （`VoiceInputSession.requestCancel()` 一直存在，此前没有入口）。

- **`scripts/check-speech-audio.ts` 增加静音倒计时的契约断言**（随 `npm run verify` 一起跑）：
  倒计时在第一次出声前不得启动、出声后必须给出完整窗口、静音正好满一个窗口时触发
  （按帧数精确计数）、再次出声必须重置、窗口为 `0` 时必须永不触发；同时校验
  `autoStopSeconds` 的越界修复与 `validateSettings` 的拒绝行为。倒计时逻辑为此被抽成
  纯类 `SilenceWatch`（`src/client/native-speech.ts`），不依赖 Web Audio，可直接在 Node 里驱动。

### 修复

- **识别条比输入框宽出一大截（观感问题，几何可复现）**。
  `conversation.input.dock` 的子节点直接放进 `.composerStack`（横跨整个对话列的 flex 列），
  **不自己做宽度约束就会被拉满整列**。本插件此前的识别条正是如此：在 1400 px 宽的对话列里，
  输入框卡片宽 928 px（居中，左右各留 236 px），识别条却宽 1400 px —— 视觉上"比对话框还长"，
  且因为旧背景是 `rgba(0,0,0,0.04)`，在暗色主题下几乎只剩一条看不见的横条。
  现在按 DSH 自己在该槽位的约定（`QueueDock`）贴齐输入框：
  `width: calc(100% - 2 * var(--dsh-composer-side-clearance))`、
  `max-width: var(--dsh-composer-card-max-width)`、`margin: 0 auto`
  （新增 `src/client/styles.ts`），并换上与 DSH 面板一致的圆角、描边与
  `label-primary` / `secondary` 配色。实测（浏览器 `getBoundingClientRect`）：宽列 1400 px 下
  识别条与输入框卡片完全重合（236 → 1164，宽 928），窄列 800 px 下同样重合（344 → 1056，宽 712）；
  改之前的条是 0 → 1400。

- **`check-dsh-peers.mjs` 不再把"类型专用导入"误判为缺 peer**。
  该守卫原先要求 `src/` 导入的每个 `@deepseek-ai/*` 都声明 peer；
  但 `import type` 会被编译器完全擦除（构建产物里只剩注释），
  为一个纯类型依赖声明 peer 只会平白增加一个能**让整个 bundle 被降级**的范围。
  现在：**值导入**必须有 peer；**类型专用导入**必须有钉死版本的 dev 依赖即可
  （新增一条断言与一条 pin 断言）。已用两组负向对照验证新规则同样会失败。

### 说明

- **与 DSH 自带语音输入 UI 的关系**：`@deepseek-ai/dsh-experimental-voice-input-bundle`
  里的 `dsh-experimental-client-ui-voice-input` 提供 DSH 自己的麦克风
  （`conversation.input.activity` 槽位）。本插件的麦克风在 `conversation.input.right`，
  两者互不冲突，可以同时启用。**但功能上现在重叠**：本插件同样使用本地 SenseVoice，
  区别在于本插件在识别后接 **AI 润色**、提示词优化与模板库，且保留了分段流式上屏。
  如果你只想要"能转写"，DSH 自带的那一个就够了。
- **数据目录与设置键兼容**：`~/.dsh/sqs-dsh-better-input/settings.json` 不迁移、
  不丢弃；新增键 `streamingPreview`（默认开）、`segmentSeconds`（默认 3）、
  `autoStopSeconds`（默认 10，`0` = 关闭）在读取旧文件时补齐，越界值读取即修复。
- **前置条件**：需要 dsh profile 里启用语音 bundle（插件管理页的「语音输入」），
  并完成模型准备（约 239 MB，int8）。未启用时插件其余功能完全正常，
  设置页会显示"本地识别器：不可用"，麦克风报错时给出明确提示。

### 同版包含：`0.1.7-rc.2` → `0.2.0-rc.2` 的框架适配

以下记录的是本次发布中**先行完成的那一步**（当时记为内部版本 `0.2.0`）。它没有单独发布，
两步合起来就是现在这个 `0.2.0-rc.2`。

**适配 DSH `0.2.0-rc.2`**（此前 `0.1.0` 只适配 `0.1.7-rc.2`）。

#### 修复

- **插件在 DSH `0.2.0-rc.2` 上被整体跳过，完全没加载（严重）**：
  `0.1.0` 声明的 peer 范围是 `>=0.1.7-rc.2 <0.2.0-0`，而 **`0.2.0-rc.2` 不满足
  `<0.2.0-0`** —— `0.2.0-0` 是 `0.2.0` 的最小 prerelease，`rc.2 > 0`。
  于是 `dsh-app-boot` 的兼容性预检（`evaluatePluginCompatibility`）判定不兼容，
  把**整个 bundle 降级丢弃**，只在启动器 stderr 留一行：

  ```
  dsh: skipping profile bundle "sqs-dsh-better-input": Error: Plugin
  sqs-dsh-better-input@0.1.0 is incompatible with dsh 0.2.0-rc.2: peerDependencies
  {"@deepseek-ai/dsh-api-remotes":">=0.1.7-rc.2 <0.2.0-0", …}
  ```

  用户视角就是「插件神秘消失」：Host 服务不在、输入框没有麦克风、设置页没有条目，
  而 `npm run build` / `tsc` / `check:bundle` / `check:typert` **全部照常通过**。

  修复：全部 `@deepseek-ai/dsh-*` peer 收紧到 `>=0.2.0-rc.2 <0.3.0-0`，
  dev 依赖同步钉到 `0.2.0-rc.2`。

- **新增 `scripts/check-dsh-peers.mjs` + `npm run check:peers`，防该回归复发**：
  以 **dsh 自身的 `evaluatePluginCompatibility`** 为权威判据（从 PATH 上的 `dsh`
  反推安装目录后 import 真正的实现），并内置一份不依赖 dsh 安装的 semver 镜像。
  四条断言：peer 范围必须容纳目标运行时（prerelease 按 dsh 的 `includePrerelease: true`
  参与）；`src/` 导入的每个 `@deepseek-ai/*` 必须有 peer；每个 `@deepseek-ai/*` peer
  必须被 `src/` 或某个 peer 的 `.d.ts` 引用；每个 dsh peer 必须同时是钉死版本的 dev 依赖。
  已用四组负向对照（还原旧范围、加无关 peer、删必需 peer、dev 版本漂移）验证它确实会失败。

- **补回 `@deepseek-ai/dsh-client-store` 等"不直接 import 也需要"的 peer 的说明**：
  精简 peer 清单时发现 `@deepseek-ai/dsh-client-ui-slots` 的 `.d.ts` 从
  `@deepseek-ai/dsh-client-store` 取 `SnapshotSelectorHook`，却**没有声明这个依赖**；
  一旦该包不在 `node_modules`，`skipLibCheck` 会让它静默退化成 `any`，
  `useInput((state) => …)` 这类回调随即报 `TS7006`。
  因此这类"类型提供者"peer 必须保留，新守卫的第三条断言把这条规则固化下来。

#### 变更

- **适配基线 `0.1.7-rc.2` → `0.2.0-rc.2`**。已逐字节比对确认本插件依赖的运行时契约
  未变：`dsh-typert-loader`、`dsh-typert-protocol`、`dsh-llm`、`dsh-client-modules`、
  `dsh-client-ui-slots`、`dsh-client-locale`、`dsh-client-ui-input-trigger` 在两个版本间
  **完全相同**；`dsh-api-gateway` / `dsh-api-remotes` 只有新增（`hasLiveClient`、
  product-analytics remote），无破坏性改动。故本次**无需改动任何插件逻辑**，
  是纯粹的框架适配。

- `src/` 与脚本里描述"当前接线方式"的注释改为以 `0.2.0-rc.2` 为准，
  并注明所引用的实现为何在新版本仍然成立。

#### 说明

- **与 DSH 0.2.0 原生语音输入的关系**：`0.2.0` 新增了可选 bundle
  `@deepseek-ai/dsh-experimental-voice-input-bundle`（本地 SenseVoice / API 语音转写，
  **默认关闭**，首次使用需下载运行时）。它注册在 `conversation.input.activity` 槽位，
  与本插件麦克风所在的 `conversation.input.right` **不冲突**，两者可同时开启。
  该步骤当时本插件仍用零配置的浏览器 Web Speech API 识别；**随后即被同版的本地识别器替换**
  （见上文「采集层替换」），此处保留的是那一步的原貌。

- 该步骤未改变用户可见行为、设置项与数据目录（`~/.dsh/sqs-dsh-better-input/`），
  升级不需要迁移数据；同版的语音改造随后新增了 3 个设置键（见上文）。


## [0.1.0] - 2026-09-27

**首次公开发布**（npm: `sqs-dsh-better-input`，适配 DSH `0.1.7-rc.2`）。

### 变更

- **身份与命名统一为 `sqs-dsh-better-input`**：此前仓库内部名为
  `sanqianshuang-better-input`，与 GitHub 仓库 `sqs-dsh-better-input` 不一致，
  且 `package.json` 的 `repository` / `homepage` / `bugs` 指向了并不存在的
  `sanqianshuang/sanqianshuang-better-input`。本次全部对齐到真实仓库。
  同步改名的层级（缺一即坏）：

  | 层级 | 位置 | 不改的后果 |
  | --- | --- | --- |
  | npm 包名 | `package.json` `name` | 发布到错误的名字 |
  | bundle patch | `cordis.patch.yml` 的 `id` / `name` | dsh 按此挂载，找不到包 |
  | Typert package key | `src/identity.ts` `PACKAGE_NAME` | 11 条 RPC symbol 全部错位 |
  | 插件 entry 名 | `src/index.ts` `export const name` | 与 patch id 不一致 |
  | **浏览器 bundle module id** | `tsdown.config.ts` → `clientBundle(id)` | **`window.__ModuleLoader__.load({id})` 仍以旧名注册，dsh 客户端模块表按新名查不到** |

  最后一项最容易漏：它只在运行时生效，`tsc` 与构建都不报错，
  连 `check-client-bundle` 也只把 id 当**信息**打印（`PASS … [旧名]`），并不判失败。
  排查办法：看 `npm run verify` 输出里方括号中的实际 id，而不是只看 PASS。

  装饰性名称（CSS keyframes、`dataset.plugin`、slot id、日志前缀、注释）一并改齐。

- **数据目录跟随改名**：`~/.dsh/sanqianshuang-better-input/` →
  `~/.dsh/sqs-dsh-better-input/`（`settings.json` 与 `templates.json`）。
  因本包从未发布过，不存在需要迁移的既有用户，故未提供迁移逻辑。

### 修复

- **`PLUGIN_REPOSITORY_SLUG` 拼出了一个不存在的包名**：
  `src/about.ts` 原为 `` `@sanqianshuang/${PACKAGE_NAME}` ``，会得到带 scope 的
  `@sanqianshuang/sqs-dsh-better-input`——但本包是**无 scope** 的，
  该 scope 下并不存在这个包。此常量只在仓库 URL 解析失败时兜底，所以一直未暴露。
  现改为由 `src/identity.ts` 的 `NPM_SCOPE` + `PACKAGE_NAME` 组成
  **`owner/repo` 形式的仓库 slug**（`sanqianshuang/sqs-dsh-better-input`），
  并修正 `repositorySlugFromUrl()` 正常路径下多加的 `@` 前缀。

- **`TYPERT.model` 缺失，导致整个 dsh Typert 网关层失效（严重）**：
  早期版本删除「文件输入 / OCR」功能时，把 Host 面 Typert 清单里的整个 `model`
  块一起删掉了（当时只想删 `convertFile` 与其 `ConvertFileResult` 类型，但 `model`
  是手写元数据，被连带清空，且 `tsc` 与构建都不报错）。

  后果不是「本插件少个功能」，而是**全局的**：dsh `0.1.7` 的
  `validateTypertManifest` 要求 `model` 为对象、`services`/`events`/`objects` 为数组
  （`dsh-typert-loader/lib/index.js:89-92`，`requireObject` 在 `:119-122`）。
  该校验在 `typert-loader` 自身的**激活期**执行，任一 contributor 失败即抛
  `AggregateError`，于是**内置的 Typert 加载器自己激活失败**
  （启动日志：`dsh: warning: 1 entry did not activate`），
  注册表一个定义都没注册 → 所有走 Typert 网关的读写都报
  `gateway/definition-unavailable: … its strict definition was withdrawn and SRC fallback is forbidden`。
  实测表现为：

  - 设置 → 模型：`加载提供商目录失败: typert gateway: llm/listProviders: …`（模型列表空）
  - 设置 → 权限：`不可用`（`permissionPresets/catalog` 取不到）

  用户视角就是「dsh 的配置丢了」——**实际磁盘上的 profile patch 层、依赖清单、凭据全都完好**，
  只是 UI 读不出来。

  修复：在 `src/typert.ts` 补回 `model` 块（内容取自上游 `dsh-better-input/lib/typert.js:320-463`，
  扣掉已删除的 `convertFile`/`ConvertFileResult`，保留本插件的 11 个方法），
  并新增构建后守卫 `scripts/verify-typert-manifest.mjs`（见 `package.json` 的 `check:typert`）。

  完整取证、机制与验证判据见 `INCIDENT-20260925-typert-model.md`。

- **`scripts/apply-to-wsl.sh` 的默认源目录硬编码了旧仓库名，仓库改名后必然失败**：
  默认值原为 `/mnt/d/project/DeepseekHarness/sanqianshuang-better-input`。仓库目录改名为
  `sqs-dsh-better-input` 后该路径不存在，脚本的 `[ -d "$SRC" ] || die …` 会直接失败。
  改为按脚本自身位置自定位（`dirname "${BASH_SOURCE[0]}"/..`），以后再改名也不会失效。

- **客户端 bundle 被无谓地塞入整份 zod（体积问题根因）**：
  `src/client/index.ts` 以**值**方式导入 `TYPERT_REMOTE`（`ctx.remote.$mount` 需要它），
  而 `remote.ts` 又值导入了 `remote-contract.ts` 的全部 zod schema。
  这条值可达链把 zod 整体打进浏览器包——**`lib/client.js` 因此从 ~100 kB 涨到 280 kB，
  gzip 从 22 kB 涨到 59 kB**。

  排查过程中确认了一个关键事实：**客户端从不做 Typert 边界校验**。
  - `@deepseek-ai/dsh-api-gateway/lib/index.js`（Host）是**唯一**执行
    `codec.create().parse(value)` 的地方；
  - `…/lib/client.js` 中 `.create()` 调用数为 **0**，其 `$mount` 路径只经
    `requireStrictCodecs` 检查 `codec.mode === 'strict'`，既不看 `typeSymbol`
    也不触发工厂，`prepareInvocation()` 把原始参数直接交给 RPC。

  因此 `remote.ts` 的客户端面改为**不携带 schema 的惰性 codec**：`create()` 依然存在
  （满足 `TypertCodec` 结构要求，`tsc` 通过、`$mount` 校验通过），但不再引用 zod。
  Host 面（`typert.ts`）**保持真实 zod schema 不变**，校验能力零损失。
  `remote-contract.ts` 本身保留，其 schema 只被 Host 消费，客户端对它的四处引用
  全是 `import type`。

  补充：不采用「把 zod 加进客户端 externals」的做法——`zod` 既不是
  `dsh-client-modules` 的平台 seed 词，也不是 boot graph 行，外置会让整个
  bundle 以 `client-modules: require("zod") missed the module table` 加载失败。

- **移除随包发布的孤立图片**：`assets/banner_big.png`（1.45 MB）在仓库中无任何引用
  （README 只引用 `assets/banner.png`）。移出后 npm 包体积
  **1.7 MB → 315 kB**，解包 **2.1 MB → 696 kB**。

- **Typert codec 兼容性**：DSH `0.1.7` 收紧了 Typert 边界校验，
  `mode: 'strict'` 的 codec 必须提供 **`create()` 工厂**（返回带 `parse()` 的运行时 schema）。
  原版把所有 codec 写成 `{ mode:'strict', typeSymbol, schema }`，会被
  `validateCodec` 以 `strict codec has no create() factory` 拒绝，
  导致整个 entry 无法激活、插件完全不可用（表现为 web boot 报
  `Failed to load plugins`，服务端打 did not activate 警告）。
  现已全部改为 `create: () => schema` 的惰性工厂形式。
  验证方式：以 0.1.7 自身的 `DescriptorStore.validate` 对构建产物逐条校验，
  11 条 invocation 全部通过；并以旧写法做负向对照，确认能复现上述报错。

- **设置存储 API 被移除**：`0.1.7` 删除了 `settings.register(namespace, schema)`
  （`SettingsScope` 类型与 `register` 方法均不存在了），改为按 profile entry id 寻址的
  `SettingsForms`（`describe` / `update` / `mutate` + revision CAS）。
  该模型面向 composition 中声明的插件 Config，不适合承载插件自身的运行时开关，
  且跨版本形状仍在变动。本插件的设置因此改为**自持 JSON 文档**
  （`~/.dsh/sqs-dsh-better-input/settings.json`，原子写入 + 损坏自愈），
  与模板库同一模式，从而不再依赖 settings API。

- **依赖版本对齐**：`@deepseek-ai/cordis` → `~4.0.4`、
  `@deepseek-ai/schemastery` → `~3.18.4`（与 `0.1.7-rc.2` 各包的 peer 要求一致）；
  全部 `@deepseek-ai/dsh-*` 类型包 dev 依赖升至 `0.1.7-rc.2`，peer 范围收紧为
  `>=0.1.7-rc.2 <0.2.0-0`。

### 新增

- **`scripts/check-client-bundle.mjs` + `npm run verify`**：构建后守卫，防止该回归复发。
  三条断言：客户端包内不得含 zod 代码；每个 `require()` 必须是平台 seed 词或
  `dsh.client.inject` 声明的行；bundle 工厂须能在模拟 shell 解析器下执行并导出
  `apply` / `inject`。已用两种负向对照（注入 `require("zod")`、内联 zod 代码）
  验证该守卫确实会失败，而非恒真。

- **`scripts/verify-typert-manifest.mjs`**：以 dsh 自身的 `validateTypertManifest`
  为权威判据校验构建产物，`tsc` 抓不到的 manifest 缺块问题由此可守。

### 移除

- **「文件输入 / 文件转 Markdown / OCR」整块功能**：DSH `0.1.7` 已原生实现文件输入
  —— `conversation.input.attachments` 槽位、`DropOverlay` 拖拽层、`FileCard`
  （上传进度 / 失败重试 / 移除）以及 composer 侧的 `onAddFiles` / `uploads` 装配。
  插件原有的 📎 文件面板、`@` 引用芯片管道、文件转 Markdown 转换器
  （PDF / DOCX / XLSX / PPTX / HTML / EPUB / CSV / JSON / XML / ZIP）
  与 OCR 视觉识别（扫描 PDF / PPT）属重复实现，故整体删除。

  随之移除的内容包括：
  - 客户端：`FileConvertDock`、`ConverterToggleButton`、`conversion-store` /
    `conversion-source` / `conversion-controller` / `conversion-types`
  - 宿主端：`converter/` 全部转换器与 OCR 取像层、`convertFile` RPC
    及其 Typert 描述、`OCR_SYSTEM_PROMPT` / `ocrUserText`
  - 设置项：`ocrProvider` / `ocrModel` 及设置页对应下拉
  - 依赖：`@napi-rs/canvas`、`fast-xml-parser`、`jszip`、`mammoth`、
    `papaparse`、`pdfjs-dist`、`turndown`、`xlsx`
    （浏览器 bundle 由约 600 kB 降至约 280 kB）

### 注意

- **`file:` 安装是「打包拷贝」，不是软链**：profile 的
  `node_modules/sqs-dsh-better-input` 只含 `package.json` 的 `files` 白名单，
  没有 `src/`。因此改了源码**必须重新 `dsh plugin --profile web add <dir>`** 才生效；
  又因 `prepack` 会跑 `npm run build`，`src/` 才是唯一真源，手改 `lib/` 会被覆盖。
- `dsh --profile web --dump-config` 的 `err_bytes=0` **抓不到**激活期故障
  （实测：出问题的实例上它依然返回 `exit=0 err_bytes=0`）。
  判据请改用 `npm run verify`（含 `check:typert`）+ 启动日志里的 `did not activate`。

### 保留

语音输入、AI 润色、提示词优化（含上下文引用）、提示词模板库、
防覆盖保护、录音自动停止、可视化设置页、更新检查、深浅色主题适配、中英双语。
