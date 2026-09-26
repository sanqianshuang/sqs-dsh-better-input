# 事故报告：安装本插件后「WSL 内 dsh 配置丢失」

- 发现时间：2026-09-25
- 环境：WSL(Ubuntu) / `dsh 0.1.7-rc.2`（`/usr/local/lib/node_modules/@deepseek-ai/dsh`）/ profile `web`（`/root/.dsh`）
- 插件：`sanqianshuang-better-input@0.1.2`，以 `file:` 目录依赖装入 profile
- 影响面：**整个 dsh 的 Typert 网关层失效**——不是本插件一个功能缺失，
  连「设置 → 模型」「设置 → 权限」都读不出内容

## 结论

**用户的配置没有丢盘。** 磁盘上 profile patch 层、依赖清单、凭据全部完好。

真正的链路是：

> 本插件的 `TYPERT` 清单缺了整个 `model` 块 → dsh 的 Typert 校验器拒绝该 manifest
> → **内置插件 `@deepseek-ai/dsh-typert-loader` 自己激活失败**（`1 entry did not activate`）
> → Typert 注册表**一个定义都没有注册** → 所有走 Typert 网关的读写全部报
> `gateway/definition-unavailable` → 设置页/模型页/权限页显示「加载失败」「不可用」
> → 用户看到的就是「模型没了、权限没了、配置没了」。

一句话：**不是配置被删了，是 UI 读不出配置了。**

---

## 1. 根因：`TYPERT.model` 缺失

### 1.1 实机日志（服务端）

`/var/log/dsh-web.log:31-33`：

```
dsh: warning: 1 entry did not activate
typert-loader (@deepseek-ai/dsh-typert-loader): AggregateError: typert-loader: 1 typert contributor(s) failed to register:
  - typert-loader: sanqianshuang-better-input TYPERT.model must be an object
```

`/var/log/dsh-web.log:42-45`（抛出点，栈是决定性的）：

```
Error: typert-loader: sanqianshuang-better-input TYPERT.model must be an object
    at requireObject (…/@deepseek-ai/dsh-typert-loader/lib/index.js:120:81)
    at validateTypertManifest (…/@deepseek-ai/dsh-typert-loader/lib/index.js:89:16)
    at …/@deepseek-ai/dsh-typert-loader/lib/index.js:273:95
```

⚠️ 注意诊断前缀的语义：`typert-loader (@deepseek-ai/dsh-typert-loader)` 里
`typert-loader` 是该**内置插件自身的 name**（见其源码 `const name = "typert-loader"`），
括号里是包名。**挂掉的 entry 是内置的 Typert 加载器本身**，本插件只是触发它的「contributor」。
这就是为什么爆炸半径是全局的（见 §2）。

对照：同文件 `:13-22` 是**上一次启动装上游原版**时的错
（`dsh-better-input … result codec has no create() factory`）。
本插件确实修好了 codec 那一层，但**下一个校验点又挂了**——两次是连续的两个坑，不是同一个。

### 1.2 dsh 的校验契约

`…/dsh-typert-loader/lib/index.js`：

```js
// :89-92  validateTypertManifest —— 紧接着 schemas 之后就读 model
const model    = requireObject(pkgName, manifest.model, "TYPERT.model");
const services = requireArray(pkgName, model.services, "TYPERT.model.services");
const events   = requireArray(pkgName, model.events,   "TYPERT.model.events");
const objects  = requireArray(pkgName, model.objects,  "TYPERT.model.objects");

// :47-55
const MEMBER_KINDS = new Set(["property","method","getter","setter","call","construct","index"]);

// :119-122
function requireObject(pkgName, value, subject) {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error(`typert-loader: ${pkgName} ${subject} must be an object`);
	return value;
}
```

`manifest.model` 是 `undefined` → `typeof undefined !== "object"` → 抛错。
**`model` 是必填项，不是可选元数据**；`services` / `events` / `objects` 也必须是数组（空数组合法）。

调用链：`typert-loader.apply()`（`:273` 调 `loadManifest`）→ 失败收集进 `failures`
→ `:344` 汇总抛 `AggregateError` → `dsh-app-boot` 记为

```js
// …/dsh-app-boot/lib/index.js:3958
return `${binName}: warning: ${String(failures.length)} ${noun} did not activate\n…`
```

### 1.3 本插件的缺陷与「是回归」的证据

`src/typert.ts`（构建产物 `lib/typert.js` 同构）导出的 `TYPERT` 只有四个成员：
`package` / `face` / `schemas` / `invocations`（11 条）——**没有 `model`**。

上游 `dsh-better-input/lib/typert.js:320-463` 是完整的：

```js
	model: {
		services: [{
			description: "Host-side dsh route discovery and transcript polishing.",
			summary: "Voice transcript polishing service.",
			tags: [],
			jsDoc: "/** Host-side dsh route discovery and transcript polishing. */",
			key: "BetterInputPolish",
			exportName: "BetterInputPolishService",
			members: [ { kind: "method", name: "getSettings", signature: "…", summary: "…", jsDoc: "…" }, … ],
			types:   [ { name: "BetterInputSettingsView", declaration: "…" }, … ]
		}],
		events: [],
		objects: []
	}
```

即：本次二次开发**删除「文件输入 / OCR」整块功能时，把 `model` 块一起删掉了**。
`CHANGELOG.md` 的「移除」清单只记了 `convertFile`、`converter/`、OCR 设置项与依赖，
**没有任何一处提到 `TYPERT.model`**——这正是漏改原因：改动集中在源码功能面，
而 `model` 是手写的清单元数据，删方法时容易被连带清空，且**构建与类型检查都不会报错**。

### 1.4 独立验证（dsh 自己的校验器，权威）

新增守卫 `scripts/verify-typert-manifest.mjs`（见 §4），直接调用 dsh 安装目录里的
**真** `validateTypertManifest`，并对老副本做负向对照：

```
=== 修复后的 workspace manifest ===
verify-typert-manifest: authoritative validator /usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-typert-loader/lib/index.js
PASS  mirror
PASS  authoritative
OK  schemas=0 invocations=11 services=1 events=0 objects=0
GUARD_EXIT=0

=== 旧的实际安装副本（修复前）===
FAIL  mirror: typert-loader: sanqianshuang-better-input TYPERT.model must be an object
FAIL  authoritative: typert-loader: sanqianshuang-better-input TYPERT.model must be an object
GUARD_EXIT=1
```

负向对照**逐字复现了线上日志那一行**，且守卫确实以退出码 1 失败
（干净环境下 `GUARD_EXIT=1`；另有 `node -e 'process.exit(7)'` → `NODE_EXIT=7` 的探针，
确认退出码能穿透 wsl 传递，守卫不是恒真）。

### 1.5 源码 → 产物往返验证

`src/typert.ts` 的修复经**真实构建**验证，不是只在产物上手工糊：

```
./node_modules/.bin/tsc --noEmit -p tsconfig.json     # 类型检查通过
npm run build                                         # tsdown + tsc，lib/ 重新生成
✔ [sanqianshuang-better-input] [ESM] lib/typert.js   15.47 kB │ gzip: 3.40 kB
```

重建后的 `lib/typert.js` 再跑守卫：

```
PASS  mirror
PASS  authoritative
OK  schemas=0 invocations=11 services=1 events=0 objects=0
GUARD_EXIT=0
```

即：**真源 `src/` 修对了，产物也修对了**。

---

## 2. 为什么表现为「配置丢失」（已实机观测）

### 2.1 实测链路

Typert 加载器挂掉 ⇒ **Typert 注册表为空** ⇒ 所有依赖 Typert 定义的服务端网关调用失败，
客户端渲染成错误态。实机抓到两条（同一个根因的两个面）：

**设置 → 模型**（截图 `evidence/wsl-dsh-models-fail.png`）：

```
加载提供商目录失败: typert gateway: llm/listProviders: its strict definition was withdrawn and SRC fallback is forbidden
[重试]
```

**设置 → 权限**：

```
gateway/definition-unavailable: typert gateway: permissionPresets/catalog: its strict definition was withdrawn and SRC fallback is forbidden
不可用
```

`its strict definition was withdrawn and SRC fallback is forbidden` 是网关在严格模式下
**拒绝退回源码定义**——注册表空了就没有定义可用，于是「提供商目录」「权限目录」全空。
用户看到模型下拉空、权限档位没了，自然会判断「配置丢了」。

对比证据：**UI 外壳本身是好的**（截图 `evidence/wsl-dsh-settings-loading.png`：
侧栏、新会话、设置、工作区都在，只有 Typert 取数的面板报错）。
所以这不是「白屏 / Failed to load plugins」，而是**外壳能渲染、数据层读不出来**。

### 2.2 已核实「没丢」的清单（逐文件实测）

| 配置 | 位置 | 实测 |
|---|---|---|
| profile 用户 patch 层（含全部覆盖） | `/root/.dsh/profiles/web/cordis.patch.yml` | 257 行完整：`ui-settings-general`、`ui-theme`(dark/17)、`llm-pi-ai`(3 条路由)、`agent-default-model`(opencode-go-v41-2)、`permission`、`better-sidebar`、9 条 mnemon 禁用、`opencode-go-session-header`、`ego-browser`、`agency-agents` |
| profile 依赖与装配顺序 | `/root/.dsh/profiles/web/package.json` | 16 依赖 + 20 条 `dsh.profile.bundles` 完整 |
| 凭据 | `/root/.dsh/.credentials.yaml` | 11 行完整，`refs` 三条（`DEEPSEEK_API_KEY` / `OPENCODE_GO_API_KEY` / `OPENCODE_GO_API_KEY_2`）均在 |
| 插件市场停用表 | `…/web/.dsh-market/state.json` | `{"disabled":["dsh-mnemon"],…}` 未被改写 |
| 会话 | `/root/.dsh/sessions/` | 5 个工作区目录仍在 |
| 本插件设置 / 模板 | `~/.dsh/sanqianshuang-better-input/` | **目录不存在**——不是被清空，是该 entry 从未写过（设置页走同一个坏掉的 Typert 网关，所以也显示不出来） |

**所以不需要回滚任何文件**；摘掉/修好这个 entry，UI 立刻恢复。

### 2.3 一个重要修正：`--dump-config` 抓不到这类故障

在**当前这个已损坏的实例**上实测：

```
dsh --profile web --dump-config > /root/d.yml 2> /root/d.err
DUMP_EXIT=0   DUMP_ERR_BYTES=0   DUMP_LINES=1552
```

`err_bytes` 是 **0**——而同一实例的启动日志里明明白白有一条 `entry did not activate`。

原因：`--dump-config` 只组装配置树，不激活插件（其自身注释也说明它是
「broken cordis.patch.yml 的恢复诊断」）。Typert 校验发生在
`typert-loader.apply()` 的**激活期**，而 `apply()` 里的 `qualifies()` 要求
`entry.fiber !== undefined`——转储路径没有挂载 fiber，于是所有条目都被跳过，**一条都不会校验**。

`migration-kit/WSL-dsh-迁移指南-AI.md` §4.6 把 `err_bytes=0` 当作「第 4 节唯一权威闸门」，
**这个闸门对本次这类激活期故障是盲的**。判据必须换（见 §3.4）。

---

## 3. 修复方案

### 3.1 代码修复（唯一必需改动）

在 `src/typert.ts` 的 `TYPERT` 里补回 `model` 块，内容取上游
`dsh-better-input/lib/typert.js:320-463`，**扣掉已删除的 `convertFile` 成员与
`ConvertFileResult` 类型**，保留本插件的 11 个方法。逐项对应校验器要求：
`model` 对象 + `services`/`events`/`objects` 三个数组；每个 service 需要
`key`、`exportName`、`tags: []`（`requireDocumentation` 强制 tags 为数组）、
`members[].{name,signature,kind}`、`types[].{name,declaration}`。

**本仓库已落地该修复**（`src/` 为真源，`lib/` 已由 `npm run build` 重新生成，见 §1.5）：

- `src/typert.ts` —— 在 `invocations` 之后新增 `model` 块（注释里写明了为什么必填、以及它是被误删的）
- `lib/typert.js` —— 构建产物，已随重建同步（**不要手改**）

> **客户端面不用改。** `src/remote.ts` 的 `TYPERT_REMOTE` 只提供 `schemas` + `invocations`，
> 走 `dsh-api-remotes` 的 `$mount`（只校 `codec.mode === 'strict'`，不跑
> `validateTypertManifest`）。本次报错来自 host 面 `pkg.exports["./typert"]`，与客户端面无关。

### 3.2 ⚠️ 关键安装陷阱：`file:` 依赖是「打包拷贝」，不是软链

实测 `\\wsl.localhost\Ubuntu\root\.dsh\profiles\web\node_modules\sanqianshuang-better-input`
是一个**真目录**，内容恰好等于 `package.json` 的 `files` 白名单：

```
LICENSE  README.md  assets/banner.png  cordis.patch.yml  lib/…  package.json
```

**没有 `src/`、没有 `tsconfig.json`、没有 `scripts/`、没有 `node_modules/`。**
`pnpm-lock.yaml` 同样证实是目录式打包安装：

```
:59-61   sanqianshuang-better-input:
           specifier: file:/mnt/d/project/DeepseekHarness/sanqianshuang-better-input
           version:   file:../../../../mnt/d/project/DeepseekHarness/sanqianshuang-better-input(…)
:1014-1015  resolution: {directory: …/sanqianshuang-better-input, type: directory}
```

**推论（修复必须遵守）：**
1. 直接改 Windows 源码目录 `D:\project\DeepseekHarness\sanqianshuang-better-input\lib\typert.js`
   **不会**影响已装副本，必须重新 add/install 让 pnpm 重新打包；
2. 该包 `scripts.prepack = npm run build`，所以**源码 `src/typert.ts` 才是唯一真源**——
   只改 `lib/` 会在下次 `prepack` 时被覆盖。

### 3.3 执行顺序（在 WSL 内）

```bash
cd /mnt/d/project/DeepseekHarness/sanqianshuang-better-input
node scripts/verify-typert-manifest.mjs    # 先自检：0 退出码才继续
npm run build                              # tsdown + tsc，重生成 lib/
npm run check                              # tsc --noEmit

dsh plugin --profile web add /mnt/d/project/DeepseekHarness/sanqianshuang-better-input
/usr/local/bin/dsh-web-ensure.sh           # 重启并体检
```

### 3.4 验证判据（**必须全部满足**）

```bash
# V0 清单自检（新增闸门，替代靠不住的 --dump-config）
node /mnt/d/project/DeepseekHarness/sanqianshuang-better-input/scripts/verify-typert-manifest.mjs
#   期望：PASS mirror / PASS authoritative / 退出码 0

# V1 启动日志里不再有未激活项（这才是权威判据）
grep -n 'did not activate' /var/log/dsh-web.log | tail -5
#   期望：本次启动段没有新增；且不再出现 'TYPERT.model must be an object'

# V2 Typert 网关恢复（UI 层，最关键）
#   设置 → 模型：能列出提供商（不再出现 llm/listProviders ... definition was withdrawn）
#   设置 → 权限：不再显示「不可用 / permissionPresets/catalog」
#   设置 → BetterInput 设置：能渲染表单

# V3 页面可取（沿用迁移指南 A5 口径）
U=$(cat /root/.dsh-current-url)
curl -s -c /root/cj -b /root/cj -L -o /root/p.html -w 'http=%{http_code} bytes=%{size_download}\n' "$U"
#   期望：http=200 bytes≈39000
```

> 不要再用 `dsh --profile web --dump-config` 的 `err_bytes=0` 作为「组装干净」的判据（§2.3）。

### 3.5 止损 / 回滚（先让 UI 回来）

配置没丢，所以止损就是**摘掉这个 entry**：

```bash
dsh plugin --profile web remove sanqianshuang-better-input
/usr/local/bin/dsh-web-ensure.sh
```

若 UI 仍不可用，走该环境既有的救援路径（迁移指南 §5）：

```bash
/usr/local/bin/dsh-web-rescue.sh     # 安全模式：绕过所有第三方插件
```

参照用历史备份（上一次 `dsh-better-input` 事故现场，含上游那两份文件，
可用作 `model` 块的对照）：`/root/.dsh-emergency/20260925-164026/{cordis.patch.yml,package.json}`

---

## 4. 防复发

### 4.1 已落地：manifest 结构守卫

新增 `scripts/verify-typert-manifest.mjs`，直接导入 dsh 安装目录里的
**真** `validateTypertManifest` 做权威校验（可用 `DSH_TYPERT_LOADER` 覆盖路径），
并内置一份**镜像**实现，使它在没有 dsh 的机器/CI 上也能跑。
它还会用 `process.exit(1)` 明确失败——已用负向对照验证过退出码。

**已接入 `npm run verify`**（与既有 `scripts/check-client-bundle.mjs` 并列）：

```jsonc
"scripts": {
  "check:bundle": "node scripts/check-client-bundle.mjs",
  "check:typert": "node scripts/verify-typert-manifest.mjs",
  "verify": "npm run build && npm run check:bundle && npm run check:typert"
}
```

实测（WSL，`npm run verify`）：

```
PASS  client bundle contains no zod code
PASS  every require() names a shell-resolvable specifier  [react, react-dom, react/jsx-runtime]
PASS  bundle registers itself via window.__ModuleLoader__.load  [sanqianshuang-better-input]
PASS  factory executes and exports { apply, inject }
PASS  inject declares required client services  [slots, remote, locale, inputTriggers, conversation]
client bundle OK

verify-typert-manifest: authoritative validator …/dsh-typert-loader/lib/index.js
PASS  mirror
PASS  authoritative
OK  schemas=0 invocations=11 services=1 events=0 objects=0
```

这样「删功能时连带删了 `model`」会在 `npm run verify` 当场失败，
而不是等到装进 dsh 之后把整个 Typert 层打掉。

### 4.2 建议：编译期也拦住

`model` 目前是手写字面量，结构错了只有运行时才知道。建议在 `src/typert.ts` 用
`@deepseek-ai/dsh-typert-protocol` 的清单类型做 `satisfies`，让 `npm run check` 就能抓住缺字段。

### 4.3 建议上报 dsh 上游：单个第三方 manifest 不该打掉整层

本插件一个字段缺失，代价是**整个 Typert 注册表为空**（连带「设置 → 模型」都读不出来），
因为加载器把「所有 contributor 都成功」当成自己激活的前提，任一失败即 `AggregateError` 抛出。
更健壮的形态应是：逐 contributor 隔离失败（坏的记 warning 并跳过），
让其余插件的 Typert 定义照常可用。这条对生态里所有第三方插件都成立。

---

## 5. 未决 / 待办

- [x] 根因定位（日志 + 校验器源码 + 与上游对照）
- [x] 修复在**权威校验器**下通过，且负向对照复现线上报错
- [x] 「配置丢失」的真实机制已实机观测（设置→模型 / 设置→权限 两条错误态 + 截图）
- [x] **已把修复应用到 WSL 实机**（2026-09-26 00:29，见 §6）
- [x] 修复后实机可视化验收：设置对话框 / 模型页 / 本插件设置页 / 主界面（截图见 `evidence/`）

---

## 6. 修复落地（2026-09-26 00:29，WSL 实机）

### 6.1 关键认知：profile 里的插件是**快照副本**，不是符号链接

`/root/.dsh/profiles/web/package.json` 里依赖写作
`"sanqianshuang-better-input": "file:/mnt/d/project/DeepseekHarness/sanqianshuang-better-input"`，
但 pnpm 把它**复制**成实目录：

```
/root/.dsh/profiles/web/node_modules/sanqianshuang-better-input/     # 真目录，非 symlink
```

后果：在工作区（`/mnt/d/...`）里 `npm run build` 出新 `lib/` 之后，
**WSL 里跑的仍然是旧快照**。本次实机对比为此提供了铁证：

| 文件 | 旧快照（故障） | 新产物（修复） |
|---|---|---|
| `lib/typert.js` | 9091 B（无 `model` 块） | 15466 B（含 `model.services/events/objects`） |

只有把产物同步进去再重启，修复才生效。同步动作已脚本化为
`scripts/apply-to-wsl.sh`（幂等：自动备份 → 同步 → `cmp` 字节校验 → 重启 → 只对**新**日志段做 typert 门控）。

### 6.2 实测结果

```
[apply-to-wsl] 源产物自检通过（含 TYPERT.model 块）
[apply-to-wsl] 已备份 -> .../sanqianshuang-better-input.bak-20260926-002936
[apply-to-wsl] 同步校验通过（lib/typert.js 字节一致，size=15466)
[dsh-ops] 停止 host：1274100 / 停止 socat 桥：198512
[dsh-ops] host 就绪（pid 1314790）/ socat 桥就绪（pid 1314844）
[apply-to-wsl] --- 重启后新增日志（typert 相关）---
(无 typert 报错)
```

- `dsh-ops.sh health` → `HEALTH=ok`（host 监听正常 / socat 桥监听正常 / HTTP 303）
- `/var/log/dsh-web.log`：旧 boot 第 46 行仍是那条 `TYPERT.model must be an object`，
  其后的新 boot **只剩两行**（`save-token v2 loaded` + 新地址 `token=_AUC7HLN_…`），
  `must be an object` / `did not activate` 命中数 **0**
- 视觉验收（headless Chrome + `read_image` 逐张复核，存 `evidence/`）：
  - `wsl-after-fix-settings.png` —— 设置对话框正常打开，14 个分区全部列出
  - `wsl-after-fix-models.png` —— 模型页正常：DeepSeek / opencode-go /
    OpenCode Go·DeepSeek V4.1 Flash ×2 / `+ Add model provider`（此前是「加载失败」）
  - `wsl-after-fix-betterinput.png` —— 本插件设置页表单完整，`Polish model` /
    `Polishing thinking effort` 下拉由 Typert 网关填充 ⇒ 证明 `model` 块已注册
  - `wsl-after-fix-main.png` —— 主界面（侧边栏 / 输入框 / 模型选择器 / 工具条）正常

### 6.3 复现脚本与两个踩过的坑

- `scripts/wsl-page-verify.mjs` / `scripts/wsl-settings-verify.mjs`：
  puppeteer-core（用 profile 里已有的 `puppeteer-core` + `/opt/google/chrome/chrome`）驱动实机 UI 截图。

⚠️ **坑 1（导致调用一直挂住）**：不要用
`google-chrome --headless=new --virtual-time-budget=25000 --screenshot=…` 抓 dsh Web 页面。
dsh Web 是 SSE/WS 长连应用，网络**永不 idle**，virtual time budget 永不到期
→ chrome 进程**永不退出** → 调用方一直等（实测 `timeout 90` 杀掉外层 bash 后 chrome 仍在跑）。
必须用「显式 goto + sleep + screenshot + `browser.close()`」的有界流程。
`tmp-page-verify.sh` 已改写成对上述 puppeteer 脚本的带 `timeout` 的薄封装。

⚠️ **坑 2**：在 Git Bash 里用
`MSYS_NO_PATHCONV=1 wsl -d Ubuntu -u root -- bash -lc '<多行脚本>'`
会把多行脚本**压成一行**（换行丢失），于是 `P=/x` 这类独立赋值行不再独立，
`$P` 展开为空（表现为 `ls -ld $P` 列出当前目录、`readlink: missing operand`）。
多行脚本请 `bash -c 'a; b; c'` 用分号，或直接 `wsl -- bash /path/to/script.sh`。
- [ ] 修复后重跑迁移指南 §8 的 A1–A9 全量验收（其中 A1 需按 §2.3 修正判据）
- [ ] `dsh-config-manager` 曾在 `2026-09-25T05:43:19.322Z` 做过一次
      `settings/ui/providers/plugins` 的整体导入（`migration-history/2026-09-25T054319.322-5cc545e20afa.import.json`：
      `kind: import`、`result: success`、44 项、带 `snapshotId: 6d1b9f2b-…`）。
      它是**另一条能整体改写配置的路径**，本次未发现造成损坏
      （`transactions/active` 与 `recovery-history` 均为空，无半途事务），
      但下次再出「配置丢失」应把它一并取证。
