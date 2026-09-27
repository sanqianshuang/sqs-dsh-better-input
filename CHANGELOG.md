# 更新日志

本仓库为 [`dsh-better-input`](https://github.com/DIAG5/dsh-better-input) 的二次开发版本，
由 **sanqianshuang** 维护，包名为 **`sqs-dsh-better-input`**。

> 历史沿革：本包在仓库内部曾用名 `sanqianshuang-better-input`（内部版本号 0.1.0–0.1.2），
> **从未发布到 npm**。首次公开发布统一改名为 `sqs-dsh-better-input`，版本号自 `0.1.0` 起算，
> 因此不再保留那些未发布的中间版本号。

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
