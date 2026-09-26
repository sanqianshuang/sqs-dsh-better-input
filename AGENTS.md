# AGENTS.md

Guidance for AI agents working in this repository.

## What this project is

`sanqianshuang-better-input` is a **DeepSeek Harness (dsh) plugin** providing a better
input experience: voice input, AI polishing, prompt optimization, and a local prompt
template library.

It is a **secondary development (fork)** of the MIT-licensed
[`dsh-better-input`](https://github.com/DIAG5/dsh-better-input), retargeted at
**dsh `0.1.7-rc.2`**. Two things define this fork:

1. Features dsh `0.1.7` now implements natively were **removed**, not duplicated.
2. APIs that `0.1.7` **removed** were migrated away from.

Read this file before making changes. The two sections below are the ones that have
actually caused production breakage.

---

## Hard rules

### 1. Never ship a Typert manifest without a `model` block

`0.1.7`'s `validateTypertManifest` (`@deepseek-ai/dsh-typert-loader/lib/index.js`)
requires `TYPERT.model` to be an **object** with `services` / `events` / `objects` as
**arrays**. This validation runs during the loader's **activation**.

A failure is not scoped to this plugin: any contributor failing throws `AggregateError`,
**the built-in Typert loader itself fails to activate**, zero definitions get registered,
and every Typert-gated read/write in dsh breaks — the settings UI shows "模型列表为空" and
the permission page reads 不可用, which looks exactly like "dsh lost its config" even though
nothing on disk was lost.

This already happened in `0.1.0`–`0.1.2` (the whole `model` block was deleted alongside the
file-input/OCR feature). Full forensics: [INCIDENT-20260925-typert-model.md](./INCIDENT-20260925-typert-model.md).

**Neither `tsc` nor the build catches this.** Always run the guard:

```sh
npm run check:typert
```

When you add or remove an RPC method, update **all four** in lockstep:

| Where | What |
| --- | --- |
| `src/remote-contract.ts` | the zod schemas |
| `src/remote.ts` | `TYPERT_REMOTE` (client face) |
| `src/typert.ts` | `TYPERT.invocations` **and** `TYPERT.model.services[0].members` |
| `src/polish/service.ts` | the actual implementation |

The Host manifest and the client face must mirror each other **method-for-method**;
a mismatch is rejected at the boundary.

### 2. Keep zod out of the browser bundle

The client does **no** wire validation. `@deepseek-ai/dsh-api-gateway` (Host) is the only
place that calls `codec.create().parse(value)`; the client's `$mount` path only checks
`codec.mode === 'strict'` and never invokes the factory.

So `src/remote.ts` builds **schema-free lazy codecs** (`create()` exists to satisfy the
`TypertCodec` shape, but references no zod). A stray **value** import of
`remote-contract.js` from the client graph silently pulls ~180 kB of zod back in and
takes `lib/client.js` from ~100 kB to ~280 kB.

Consequences of getting this wrong, so you don't try the obvious "fix":

- **Do not** add `zod` to the client `externals`. It is neither a platform seed word nor a
  boot-graph row, so the bundle dies with
  `client-modules: require("zod") missed the module table`.
- **Do not** widen `alwaysBundle` to `true`. It is a narrow whitelist (`specifier.startsWith('.')`)
  on purpose. A bare specifier reaching the client graph is a bug to fix at the import site.

`src/remote-contract.ts` is consumed by the Host only; client references to it must be
`import type`. Guarded by `npm run check:bundle`.

### 3. Strict codecs need a `create()` factory

`0.1.7` rejects `{ mode: 'strict', typeSymbol, schema }` with
`strict codec has no create() factory`, which fails the whole entry (`Failed to load plugins`).
Always build codecs through the `codec()` helper in `src/typert.ts`.

### 4. `src/` is the only source of truth

`lib/` is generated. Hand-editing it is pointless — `prepack` runs the build and overwrites it.

---

## Development

```sh
npm install --legacy-peer-deps   # see note below
npm run build                    # tsdown + d.ts emit
npm run check                    # tsc --noEmit
npm run verify                   # build + both post-build guards  <-- run this
npm run dev:watch                # rebuild on change
```

`--legacy-peer-deps` is needed because the `0.1.7-rc.2` type packages (dev-only) have peer
chains npm cannot resolve on its own (e.g. `dsh-api-remotes` → `dsh-scope`). They are
compile-time types only and are fully externalized from the bundle, so relaxing peer
resolution is safe.

### Installing into a local dsh

```sh
dsh plugin --profile web add "$PWD"
# or, without a global dsh:
npx -y @deepseek-ai/dsh plugin --profile web add "$PWD"
```

**`file:` installs are a pack-and-copy, not a symlink.** The profile's
`node_modules/sanqianshuang-better-input` contains only the `package.json` `files`
whitelist — there is **no `src/`**. So after changing source you must re-run
`dsh plugin --profile web add <dir>` for it to take effect.

### Verifying a change actually loaded

`dsh --profile web --dump-config` reporting `exit=0 err_bytes=0` **does not** catch
activation-time failures — this was confirmed on a broken build. Check instead:

```sh
npm run check:typert                                   # manifest is well-formed
# and grep the startup log for:
#   dsh: warning: N entry did not activate
```

---

## Architecture

Two halves, one package:

```
src/                     Host (Node) half
  identity.ts            single source of truth for names/URLs — never hardcode
  config.ts              settings shape, defaults, validation
  settings/store.ts      self-owned JSON doc at ~/.dsh/sanqianshuang-better-input/settings.json
  templates/store.ts     template JSON doc in the same directory
  polish/service.ts      the BetterInputPolish service (llm-backed)
  polish/prompts.ts      default system prompts
  remote-contract.ts     zod schemas (Host-only; client must use `import type`)
  typert.ts              TYPERT manifest — invocations + model
  index.ts               plugin entry (named `name` / `apply`)

src/client/              Browser half (bundled to lib/client.js)
  index.ts               slot registrations + lifecycle
  MicrophoneButton.tsx   mic in conversation.input.right (order 9999)
  OptimizeButton.tsx     ✨ in conversation.input.right (order 9988)
  VoiceRecognitionBar.tsx  status strip in conversation.input.dock (order 15)
  voice-session.ts       per-session state (useSyncExternalStore)
  web-speech.ts          Web Speech API wrapper, auto-restarts on silence
  settings.tsx           settings.section (order 16)
  templates-section.tsx  settings.section (order 17)
  strings.ts             zh/en dictionary, registered as one locale namespace
```

### Notes

- **No default export** from the entry. The Loader discards function plugins that have one.
- Client `inject` deliberately **omits** `remote.betterInput` — this plugin mounts it via
  `ctx.remote.$mount`, so declaring it on the outer inject would deadlock waiting for itself.
  It is declared only on the inner `ctx.inject()`.
- Settings use a **self-owned JSON document**, not the settings API: `0.1.7` removed
  `settings.register(namespace, schema)`, and `SettingsForms` addresses profile entry ids
  rather than plugin runtime toggles.
- New externally visible names go in `src/identity.ts`, not as literals.
- Data directory is `~/.dsh/sanqianshuang-better-input/` so it can coexist with the
  upstream plugin installed side by side.

---

## Removed features — do not "restore" them

The file-input / file-to-Markdown / OCR block was **deliberately deleted**: dsh `0.1.7`
implements file input natively (`conversation.input.attachments` slot, `DropOverlay`,
`FileCard` with upload progress / retry / remove, composer-side `onAddFiles` / `uploads`).
Re-adding the plugin's 📎 panel or `@`-reference chip pipeline would duplicate it.

Removed: `src/converter/**`, `src/config-schema.ts`, `client/FileConvertDock.tsx`,
`client/ConverterToggleButton.tsx`, `client/conversion-{controller,source,store,types}.ts`,
the `convertFile` RPC + `ConvertFileResult` type, and the `ocrProvider` / `ocrModel` settings.

When touching the Typert manifest, the `convertFile` / `ConvertFileResult` entries must
**stay deleted**. They are the exact deletions that triggered the incident in rule 1.

---

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`, ESM, `NodeNext`-style `.js` import
  specifiers in source (`./config.js` even though the file is `config.ts`).
- Line endings are **LF everywhere** (`.gitattributes`). This tree previously mixed CRLF/LF,
  which silently made a scripted patch match nothing while reporting success. Keep LF.
- `lib/` is marked `-text` in `.gitattributes` so generated output stays out of diff review.
- Commit messages and code comments: write in the style already present; the CHANGELOG and
  incident docs are in Chinese, code comments in English.
- Update `CHANGELOG.md` for user-visible changes, following the existing
  `修复` / `新增` / `变更` / `移除` structure.

## Before you call a change done

```sh
npm run verify        # must pass: build, bundle guard, typert guard
```

Then confirm the manifest still satisfies the loader, keeping in mind that `verify` is what
catches both classes of silent failure documented above.
