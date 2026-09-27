<p align="center">
  <img src="./assets/banner.png" width="100%" alt="sqs-dsh-better-input banner" />
</p>

<h1 align="center">🎤 sqs-dsh-better-input</h1>

<p align="center"><b>给 DeepSeek Harness 更好的「输入」体验。</b></p>

<p align="center">
  <a href="https://www.npmjs.com/package/sqs-dsh-better-input"><img src="https://img.shields.io/npm/v/sqs-dsh-better-input.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/sqs-dsh-better-input"><img src="https://img.shields.io/npm/dm/sqs-dsh-better-input.svg" alt="npm downloads" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license MIT" /></a>
</p>

<p align="center">
  输入体验增强插件 · 基于 dsh-better-input 的二次开发
</p>

> 💡 **它解决什么？** 与智能体对话，输入不只靠键盘打字。本插件把**语音识别、AI 润色、提示词优化、提示词模板**四件事做顺：说出来的话自动变成干净、可直接发送的文字；写好的提示词一键优化；常用提示词随用随插。

***

## ⚠️ 关于这个版本（二次开发说明）

本仓库是 [`dsh-better-input`](https://github.com/DIAG5/dsh-better-input)（MIT）的**二次开发版本**，由 **sanqianshuang** 维护，专门适配 **DSH `0.1.7-rc.2`**。与原版的主要差别：

| 变更 | 说明 |
| --- | --- |
| 🗑️ **移除「文件输入 / 文件转 Markdown / OCR」整块** | DSH `0.1.7` 已原生支持文件拖拽上传、上传进度、文件卡片与重试（`conversation.input.attachments` / `DropOverlay` / `FileCard`），插件再挂一套 📎 文件面板与 `@` 引用芯片属于重复实现，故整体删除。 |
| 🔧 **修复 Typert 兼容性（关键）** | `0.1.7` 收紧了 Typert 边界：`mode: 'strict'` 的 codec 必须带 **`create()` 工厂**；旧版把 schema 直接放在 `schema` 属性上，会被 `requireStrictCodec` 拒绝（报 `strict codec has no create() factory`），导致整个 entry 无法激活、插件根本不加载。现已全部改为工厂形式。 |
| 🔧 **修复设置存储被移除的 API** | `0.1.7` 删除了 `settings.register(namespace, schema)`，改为按 profile entry 的 `SettingsForms`（带 revision CAS）。本插件的设置改为**自持 JSON 文件**，不再依赖该 API，因而不会被后续版本反复打破。 |
| 🔧 **对齐依赖版本** | `@deepseek-ai/cordis` → `~4.0.4`、`@deepseek-ai/schemastery` → `~3.18.4`，与 `0.1.7-rc.2` 的 peer 要求一致。 |
| 🏷️ **身份与命名** | 包名 `sqs-dsh-better-input`（npm 同名）、作者 `sanqianshuang`；设置与模板数据目录为 `~/.dsh/sqs-dsh-better-input/`（与原版互不干扰，可并存安装）。 |

> 原版的 LICENSE 与版权声明已在 [LICENSE](./LICENSE) 中保留，符合 MIT 要求。

## ✨ 功能

<table>
<tr><th align="center" width="120">模块</th><th align="left">说明</th></tr>
<tr>
<td align="center">🎙️<br/><b>语音输入</b></td>
<td>点击麦克风，边说边转写，文字<strong>实时流式</strong>进入输入框。浏览器原生识别（Web Speech API），<strong>无需 API Key</strong>、不走服务器。识别因静音自行中断时会自动重启。</td>
</tr>
<tr>
<td align="center">🤖<br/><b>AI 润色</b></td>
<td>识别后自动清理：去口头禅、修同音错字（根木鹿→根目录、脱肯→Token）、补标点、把口语列举转成编号列表、并处理自我纠正（「不对，我说的是…」只保留最终语义）。<strong>复用 dsh 已配置的模型，无需额外 Key</strong>。</td>
</tr>
<tr>
<td align="center">✨<br/><b>提示词优化</b></td>
<td>输入框右侧一个 ✨ 图标，AI 帮你把写好的提示词优化得更精准；点击后弹出<strong>原文 / 优化结果对比</strong>，确认满意再采用。可引用最近 N 轮对话作为语境。</td>
</tr>
<tr>
<td align="center">📝<br/><b>提示词模板</b></td>
<td>常用提示词存成模板，输入框键入 <code>/</code> 搜索并一键插入正文；设置页内新建 / 编辑 / 删除，<strong>本地存储</strong>不经服务器。</td>
</tr>
<tr>
<td align="center">🐘<br/><b>防覆盖保护</b></td>
<td>润色 / 优化进行中你手动改了草稿，结果<strong>不会覆盖</strong>你的编辑；失败保留原文。</td>
</tr>
<tr>
<td align="center">⏱️<br/><b>录音自动停止</b></td>
<td>可自定义单次录音上限（1–600 秒，默认 120），到点自动停止，不占麦克风。</td>
</tr>
<tr>
<td align="center">⚙️<br/><b>可视化设置页</b></td>
<td>识别语言、录音时长、润色开关 / 模型 / 思考强度 / 自定义提示词，优化模型 / 思考强度 / 提示词 / 上下文轮数，全部可在设置里配置；内置提示词可一键展开查看。首次打开会自动选中一个已配置模型。</td>
</tr>
<tr>
<td align="center">🔄<br/><b>更新检查</b></td>
<td>设置页底部「关于与更新」一键检测 npm 最新版，发现新版会给出<strong>一键复制更新命令</strong>。</td>
</tr>
</table>

## 🚀 安装

前置：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`0.1.7-rc.2`）+ Node.js `^22.19.0 || >=24.0.0` + Chrome/Edge 浏览器（语音识别需要 Chromium 内核）。

### 方式 A：从 npm 安装（推荐）

```sh
# 有全局 dsh CLI
dsh plugin --profile web add sqs-dsh-better-input

# 没有全局 dsh（用 npx 拉取）
npx -y @deepseek-ai/dsh plugin --profile web add sqs-dsh-better-input
```

升级到最新版：

```sh
dsh plugin --profile web update sqs-dsh-better-input
```

卸载：

```sh
dsh plugin --profile web remove sqs-dsh-better-input
```

### 方式 B：从本地目录安装（开发 / 二次开发）

```sh
dsh plugin --profile web add /path/to/sqs-dsh-better-input
npx -y @deepseek-ai/dsh plugin --profile web add /path/to/sqs-dsh-better-input
```

### 方式 C：从源码构建

```sh
git clone https://github.com/sanqianshuang/sqs-dsh-better-input.git
cd sqs-dsh-better-input
npm install --legacy-peer-deps   # 见下方说明
npm run build
dsh plugin --profile web add "$PWD"
```

> `--legacy-peer-deps`：`0.1.7` 的这批类型包（dev 依赖）之间存在 npm 难以自解的 peer 链（如 `dsh-api-remotes` → `dsh-scope`）。它们只用于编译期类型、不会被打进产物（客户端 bundle 已把 `@deepseek-ai/*` 全部外置），因此放宽 peer 校验是安全的。

### 备选：不装依赖，写进 preset 的 `cordis.yml`

```yaml
- insert:
    - id: sqs-dsh-better-input
      name: sqs-dsh-better-input
```

安装后刷新 Web UI，输入框右侧会出现**麦克风图标** 🎤。

## 📖 使用

### 1. 语音输入

1. 打开任意对话，点击输入框右侧的**麦克风按钮**
2. 开始说话，识别文字**实时流入**输入框
3. 再点按钮（或识别条上的**停止**）结束
4. 检查、修改、发送

> 识别完全在浏览器本地完成（Web Speech API）。Firefox / Safari 不支持时按钮自动禁用。

### 2. AI 润色

设置 → **BetterInput** → 打开 **AI 润色** → 选择一个 dsh 里已配置的模型。

内置提示词会：去口头禅、修 ASR 同音错字、补标点、把口语列举转成编号列表（如「第一…第二…」→ `1.` `2.`）。留空用内置提示词，点「查看内置提示词」可展开原文；或粘贴自定义提示词（总会追加输出契约保护，保证只返回正文、不答非所问）。

### 3. 提示词优化

1. 在输入框里写好你的提示词
2. 点击输入框右侧的 **✨ 优化** 图标
3. 稍等，弹出**原文 / 优化结果对比**画面
4. 点 **采用** 用优化结果替换草稿，或点 **取消** 保留原文

> 默认关闭思考，追求快速、低成本的直出结果。从设置页可手动提高思考强度。

### 4. 提示词模板

1. 到 设置 → **BetterInput** → 「**提示词模板**」分节，点「**新建模板**」
2. 填写名称、描述（可选）、正文与标签（可选，逗号分隔，用于搜索），保存
3. 回到输入框键入 `/`，模板候选即弹出；继续输入按名称 / 描述 / 标签实时过滤
4. 选中候选，模板正文直接插入输入框，可继续修改后发送

> 模板保存在宿主本地 `~/.dsh/sqs-dsh-better-input/templates.json`，不经服务器、不上传；最多 200 个模板，正文上限 8000 字，列表按最近更新排序。写入走「临时文件 + 原子重命名」，文件意外损坏时自动隔离为 `*.corrupt-<时间戳>` 并重建。

### 5. 设置

| 设置项 | 说明 |
| --- | --- |
| 界面语言 | 插件界面文案支持中文 / 英文，跟随 DSH 界面语言切换，即时生效 |
| 识别语言 | 留空自动跟随浏览器语言（如 `zh-CN`、`en-US`） |
| 单次录音上限 | 1–600 秒，默认 120，到点自动停止 |
| AI 润色 | 开 / 关；开启后每次语音识别结束自动润色进草稿 |
| 润色模型 / 思考强度 / 自定义提示词 | 各自独立配置 |
| 优化模型 / 思考强度 / 自定义提示词 | 各自独立配置 |
| 上下文引用轮数 | 优化时引用最近 N 轮对话（0 为关闭，默认 3） |
| 提示词模板 | 设置页内新建 / 编辑 / 删除，数据保存在宿主本地 JSON |
| 关于与更新 | 显示当前版本 / 许可证 / 仓库，一键「检查更新」 |

> 以上设置保存在 `~/.dsh/sqs-dsh-better-input/settings.json`。

## 🧩 兼容性

- DeepSeek Harness `0.1.7-rc.2`（peer 范围 `>=0.1.7-rc.2 <0.2.0-0`）
- Node.js `^22.19.0 || >=24.0.0`
- Chromium 内核浏览器（Chrome / Edge）

## 🛠️ 开发

```sh
npm install --legacy-peer-deps
npm run check    # 类型检查
npm run build    # 构建 lib/（Host ESM + 浏览器 bundle）
```

改 Client 端：`npm run dev:watch` 后刷新 UI；改 Host 端：重启 `dsh web`。

## 🏗️ 架构

- `src/index.ts` — Host 插件入口，挂载润色服务
- `src/identity.ts` — 包名 / 作者 / 仓库等身份信息的唯一来源
- `src/polish/service.ts` — `BetterInputPolishService`（Typert remote）：设置读写、dsh 模型路由发现、LLM 润色与提示词优化、提示词模板存取
- `src/polish/prompts.ts` — 内置润色 / 优化提示词与输出契约守卫
- `src/settings/store.ts` — 插件自持设置的 JSON 存储（原子写入、损坏自愈）
- `src/templates/` — 提示词模板的数据模型与宿主端 JSON 存储
- `src/about.ts` — 插件身份读取与 npm 版本检查
- `src/client/` — 浏览器端：麦克风 / 优化按钮（`conversation.input.right`）、识别条（`conversation.input.dock`）、设置页与模板管理（`settings.section`）、`/` 模板候选源
- `src/typert.ts` / `src/remote.ts` — Client↔Host 类型化通信契约

## 📄 License

[MIT](./LICENSE) — 保留原 `dsh-better-input` 项目的版权声明。

## ⭐ 支持

- 提交 Issue / PR
- 分享给同样用 DSH 的朋友

感谢原版作者与社区 ❤️
