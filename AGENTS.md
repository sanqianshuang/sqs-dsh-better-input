# AGENTS.md

Guidance for AI agents working in this repository.

## What this project is

`sqs-dsh-better-input` is a **DeepSeek Harness (dsh) plugin** providing a better
input experience: voice input, AI polishing, prompt optimization, and a local prompt
template library.

It is a **secondary development (fork)** of the MIT-licensed
[`dsh-better-input`](https://github.com/DIAG5/dsh-better-input), retargeted at
**dsh `0.2.0-rc.2`** (previously `0.1.7-rc.2`; the 0.1.7 → 0.2.0 move required no
plugin logic change — see rule 1). Two things define this fork:

1. Features dsh now implements natively were **removed**, not duplicated.
2. APIs that dsh **removed** were migrated away from.

Read this file before making changes. The sections below are the ones that have
actually caused production breakage.

---

## Hard rules

### 1. Never let a peer range exclude the running dsh runtime

This is the most damaging failure in this repository's history, and it is
invisible to every other check. `dsh-app-boot` evaluates each
`@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer with

```js
semver.satisfies(runtimeVersion, range, { includePrerelease: true })
```

and on a mismatch **demotes the whole bundle** — the plugin is simply not
composed, with one line on the launcher's stderr as the only trace:

```
dsh: skipping profile bundle "sqs-dsh-better-input": Error: Plugin
sqs-dsh-better-input@0.1.0 is incompatible with dsh 0.2.0-rc.2: peerDependencies
{"@deepseek-ai/dsh-api-remotes":">=0.1.7-rc.2 <0.2.0-0", …}.
```

The trap is the **upper bound on a prerelease line**: `>=0.1.7-rc.2 <0.2.0-0`
looks like it means "the 0.1.7 line", but `0.2.0-0` is the *lowest* prerelease of
`0.2.0`, so `<0.2.0-0` excludes **every** prerelease of 0.2.0 — including
`0.2.0-rc.2`. `0.1.0` shipped exactly that, and the plugin was 100% dead on
`0.2.0-rc.2` while `npm run build`, `npm run check`, `check:bundle` and
`check:typert` all passed.

Use the full-line form `>=0.2.0-rc.2 <0.3.0-0` (equivalently `^0.2.0-rc.2`), keep
every `@deepseek-ai/dsh-*` dev dependency pinned to the same exact runtime
version, and **run the guard**:

```sh
npm run check:peers
```

It calls dsh's own `evaluatePluginCompatibility` as the authoritative check when
a dsh install is resolvable, and mirrors it otherwise.

Two related facts this guard also enforces, both learned the hard way:

- A peer can be required **without appearing in any `import`**. `@deepseek-ai/dsh-client-ui-slots`
  re-exports `SnapshotSelectorHook` from `@deepseek-ai/dsh-client-store` while
  declaring that dependency nowhere, so dropping our `dsh-client-store` entry
  makes `skipLibCheck` degrade the type to `any` and the `useInput((state) => …)`
  callbacks fail with `TS7006`. Packages reachable from a peer's `.d.ts` count as
  used.
- An **unused** peer is not free either — it is one more range that can demote the
  bundle on a future runtime. Keep the peer list exactly as wide as the type graph
  requires.
- Conversely, a **type-only** import must **not** force a peer.
  `@deepseek-ai/dsh-experimental-speech-to-text` is imported only as
  `import type` (for `Context.speechToText` and the provider types); the emitted
  `lib/` contains no reference to it at all. Declaring it a peer would be a lie
  about the runtime, and would add exactly the kind of range that demotes this
  bundle if a future dsh renames or drops the experimental package — losing the
  settings page, prompt optimization and the template library along with it.
  The guard therefore distinguishes the two cases:

  | how `src/` reaches the package | what it needs |
  | --- | --- |
  | value import (`import { x } from`, dynamic `import()`, side-effect `import`) | a **peer** entry with a range admitting the runtime |
  | `import type … from` / `export type … from` | a dev dependency **pinned to the exact runtime version** |

  Runtime lookups of an optional dsh service go through `ctx.get('name')`
  (returns `undefined`), **never** through `static inject` — injecting an
  optional service would gate this plugin's activation on it.

### 2. Never ship a Typert manifest without a `model` block

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
| `src/typert.ts` | `TYPERT.invocations` **and** `TYPERT.model.services[N].members` |
| `src/polish/service.ts` / `src/speech/service.ts` | the actual implementation (`BetterInputPolish` / `BetterInputSpeech`) |

The Host manifest and the client face must mirror each other **method-for-method**;
a mismatch is rejected at the boundary.

### 3. Keep zod out of the browser bundle

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

### 4. Strict codecs need a `create()` factory

`0.1.7` rejects `{ mode: 'strict', typeSymbol, schema }` with
`strict codec has no create() factory`, which fails the whole entry (`Failed to load plugins`).
Always build codecs through the `codec()` helper in `src/typert.ts`.

### 5. `src/` is the only source of truth

`lib/` is generated. Hand-editing it is pointless — `prepack` runs the build and overwrites it.

### 6. Audio crossing our Remote must be canonical 16 kHz mono PCM16 WAV

Since this release the browser records and the Host transcribes through dsh's speech service
(`ctx.speechToText`), but the audio reaches it through **this plugin's own** Remote. It
therefore never passes dsh's intake validation, and the native worker's only reaction to a
malformed header is a failure per recording.

dsh accepts exactly one format (`@deepseek-ai/dsh-experimental-speech-to-text` → `./wave`):
`RIFF`/`WAVE`/`fmt `/fmt size 16/PCM/1 channel/**16000 Hz**/byteRate 32000/blockAlign 2/bits
16/`data`, RIFF size = length − 8, data size = length − 44, even PCM length, and a duration
at or under the speech Remote's `maxDurationSeconds` default, **120** (this plugin mirrors
it as `SPEECH_MAX_RECORDING_SECONDS`; 120 s of 16 kHz mono PCM16 is 3.84 MB, just under the
Remote's 4 MiB `maxAudioBytes`). `src/speech/wave.ts` mirrors that check field for field and
`src/client/audio-capture.ts` is the only place that may build such a WAV.

`src/speech/wave.ts` deliberately duplicates dsh's validator instead of importing
`@deepseek-ai/dsh-experimental-speech-to-text/wave`: our dependency on that package is
type-only (rule 1), so a runtime import would break an `npm pack` install, which has no dev
dependencies.

**Neither `tsc` nor the build catches a format drift.** Run the guard:

```sh
npm run check:speech
```

It cross-checks the encoder against dsh's own `validateWave` (authoritative when a dsh
install resolves), agrees on duration for random recordings, requires both sides to reject
seven classes of malformed header, and checks the 120 s boundary on both the byte and the
duration ceiling. It also asserts the settings migration that keeps old installs usable
(`zh-CN → zh`, a stored 600 s limit → 120, a missing/invalid silence window → 10) and drives
`SilenceWatch` through its user-visible contract: no countdown before the first sound, the
full window armed by it, exactly one window of quiet before it fires, reset on new sound,
never firing when disabled.

### 7. The local recognizer registers asynchronously

The SenseVoice provider inspects its model cache during activation, so
`speechToText.snapshot().providers` is **empty for a moment after Host start** — measured at
roughly 3 s on this machine (see the probe recipe below). Treat "service present, roster
empty" as *warming up*, not as *unavailable*: `SpeechStatusView` carries both `service` and
`available` for exactly this reason, and the settings page polls (bounded) while the roster
is empty. Anything that reads the roster once at boot and caches the answer will show a
false "unavailable".

### 8. A `conversation.input.dock` child must constrain its own width

`conversation.input.dock` renders straight into `.composerStack` — a plain flex column that
spans the **whole conversation column**, not the composer card. A child that does not size
itself is stretched edge to edge and looks broken: it draws wider than the input box it sits
above. That is what the recognition bar did before this release.

dsh's own QueueDock (the same slot, id `queue`) solves it with the two custom properties
dsh publishes on `.body`:

```css
box-sizing: border-box;
width: calc(100% - 2 * var(--dsh-composer-side-clearance, 16px));
max-width: var(--dsh-composer-card-max-width, 952px);
margin: 0 auto;
flex: none;
```

`src/client/styles.ts` carries exactly that for `.sqs-bi-bar`; keep the pattern on any new
dock entry. Note the card is **not** `100%`: it is
`--dsh-chat-content-width + 32px` (with `--dsh-chat-content-width` clamped to
`clamp(680px, 64% of the column, 920px)`), so `width: 100%` overflows on a wide window while
`calc(100% - 32px)` overflows on a narrow one. The `embedded` layout changes both variables,
which is why they must be read, never hardcoded.

**Neither `tsc` nor the build can see this** — it is pure layout. Check it in a browser by
measuring the bar against the composer card: their `getBoundingClientRect().left/right/width`
must be identical at both a wide (≥1200 px) and a narrow (~800 px) column. The quickest way
is a throwaway HTML page that reproduces the container with the real variables copied from
`@deepseek-ai/dsh-client-ui-conversation/lib/client.js`, plus the plugin stylesheet lifted
out of the built `lib/client.js` — see `evidence/bar-layout.png` for what the fixed version
looks like next to the old full-bleed bar.

---

## Development

```sh
npm install --legacy-peer-deps   # see note below
npm run build                    # tsdown + d.ts emit
npm run check                    # tsc --noEmit
npm run verify                   # build + all four post-build guards  <-- run this
npm run dev:watch                # rebuild on change
```

`--legacy-peer-deps` is needed because the `0.2.0-rc.2` type packages (dev-only) have peer
chains npm cannot resolve on its own (e.g. `dsh-api-remotes` → `dsh-scope`). They are
compile-time types only and are fully externalized from the bundle, so relaxing peer
resolution is safe.

### Retargeting to a new dsh version

The whole surface is in `package.json`: the `@deepseek-ai/dsh-*` **peer ranges**, their
**dev pins**, and the client type packages. Before bumping them, byte-compare the runtime
packages this plugin actually depends on against the new dsh install — the 0.1.7 → 0.2.0
move turned out to need no source change because
`dsh-typert-loader` / `dsh-typert-protocol` / `dsh-llm` / `dsh-client-modules` /
`dsh-client-ui-slots` / `dsh-client-locale` / `dsh-client-ui-input-trigger` were identical:

```sh
A=<this repo>/node_modules/@deepseek-ai ; B=/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai
diff -rq "$A/<pkg>/lib" "$B/<pkg>/lib"
```

Then run `npm run verify` (rule 1) and boot the plugin once in a throwaway profile to
confirm it is neither skipped nor failing activation — see below.

### Probing a profile without touching the live service

`$DSH_HOME` is honoured, so a scratch profile proves composition and activation without
restarting anything (a healthy plugin prints nothing; a broken one prints
`dsh: warning: 1 entry did not activate`, and an incompatible one prints
`dsh: skipping profile bundle …`):

```sh
export DSH_HOME=/tmp/probe                       # any writable dir
mkdir -p "$DSH_HOME/profiles/probe/node_modules/sqs-dsh-better-input"
npm_config_cache="$PWD/.npm-cache" npm pack --pack-destination "$DSH_HOME"
tar -xzf "$DSH_HOME"/sqs-dsh-better-input-*.tgz -C "$DSH_HOME/profiles/probe/node_modules/sqs-dsh-better-input" --strip-components=1
printf '{"name":"dsh-profile-probe","private":true,"dependencies":{},"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","sqs-dsh-better-input"]}}}' > "$DSH_HOME/profiles/probe/package.json"
printf '[]' > "$DSH_HOME/profiles/probe/cordis.yml"

# composed must appear on STDOUT and nothing may be reported on STDERR:
dsh --profile probe --dump-config | grep -q "id: sqs-dsh-better-input"   # composed
# activated cleanly: exit=124 (it stays up) and EMPTY stderr
timeout 30 dsh --profile probe --help
```

`--dump-config` alone is **not** enough: it never mounts plugins, so it cannot see a
failing Typert manifest. Only the boot half exercises activation. Note also where each
answer lives: the composed tree goes to **stdout**, while a demoted bundle is reported on
**stderr** with the process still exiting `0` — and the profile's own `cordis.yml` is
rewritten to the empty root `[]`, so it never contains the composed rows.

To prove the plugin also activates **next to** the speech bundle, add
`@deepseek-ai/dsh-experimental-voice-input-bundle` to that `bundles` list: all five entries
(`speech-to-text`, `speech-to-text-sensevoice`, `api-speech-to-text`, `ui-voice-input`,
`sqs-dsh-better-input`) must compose and stderr must stay empty.

### Probing the real recognizer end to end

Recognizers register asynchronously (rule 7), so a probe that reads the roster at `apply()`
time sees nothing. The recipe that actually works, and that validates the exact call
sequence this plugin makes (`resolve({ audio, language })` → `transcribe(spec, signal)`):

1. Write a throwaway **bundle** plugin in the probe profile
   (`<probe>/node_modules/probe-speech/`, with `dsh.bundle.patch` inserting itself and
   `export const inject = ['speechToText']`).
2. Point the provider at the existing model cache instead of downloading:
   `- id: speech-to-text-sensevoice` → `config: { dataRoot: /root/.dsh/speech-to-text/sensevoice }`.
3. In `apply()`, `await new Promise(r => setTimeout(r, 3000))`, then build one canonical WAV
   in memory (silence or a tone is enough — no speech corpus needed), call
   `resolve` + `transcribe`, and `console.log` the result.
4. `timeout 150 dsh --profile probe --help`; plugin logs appear on **stdout**.

On this machine that produced:

```
PROBE-SPEECH providers=sensevoice-local:standby selection=sensevoice-local/"auto"
PROBE-SPEECH OK text="" audioSeconds=2 inferenceSeconds=0.0058 wallMs=954
```

`audioSeconds` echoing our WAV's duration (and an empty `text` for a tone) is the proof that
the real worker decoded our bytes. Budget ~1 s for the first wake-up, then ~0.005 s per
silent frame; a real utterance costs the VAD plus one SenseVoice pass.

### Installing into a local dsh

```sh
dsh plugin --profile web add "$PWD"
# or, without a global dsh:
npx -y @deepseek-ai/dsh plugin --profile web add "$PWD"
```

**On dsh `0.2.0-rc.2` a directory install records a `link:` dependency**, so
`<profile>/node_modules/sqs-dsh-better-input` is a **symlink** back to this checkout —
`ls` shows `src/`, `scripts/` and even this file, because none of the `files` whitelist
applies to a link. Two consequences:

- a rebuilt `lib/` is picked up by the next `dsh web` restart with no re-install, but
- **the checkout must not be moved or deleted** while the profile is active. Older dsh
  (`0.1.7`) packed and copied instead; if you need a self-contained copy,
  `npm pack` the tarball and install that.

Being non-registry, the profile dependency is also skipped by `dsh-ops update` — which
matters, because that script would otherwise `add sqs-dsh-better-input@<latest>`, and the
published `latest` is still the broken `0.1.0`.

### Verifying a change actually loaded

`dsh --profile web --dump-config` reporting `exit=0 err_bytes=0` **does not** catch
activation-time failures — this was confirmed on a broken build. It also cannot see the
compatibility preflight unless you read its **stderr**, where a demoted bundle appears as
`dsh: skipping profile bundle …`. Check instead:

```sh
npm run verify                                         # build + bundle + speech + typert + peers
# and grep the startup log for:
#   dsh: warning: N entry did not activate
#   dsh: skipping profile bundle
```

Also mind the two ways a `--dump-config` run can lie about this repository: it writes
`<profile>/cordis.yml`, so it needs a writable `$DSH_HOME`; and a *skipped* bundle is
reported on stderr while **stdout still composes successfully** with `exit=0`.

---

## Architecture

Two halves, one package:

```
src/                     Host (Node) half
  identity.ts            single source of truth for names/URLs — never hardcode
  config.ts              settings shape, defaults, validation, speech limits
  settings/store.ts      self-owned JSON doc at ~/.dsh/sqs-dsh-better-input/settings.json
  templates/store.ts     template JSON doc in the same directory
  polish/service.ts      the BetterInputPolish service (llm-backed)
  polish/prompts.ts      default system prompts
  speech/service.ts      the BetterInputSpeech service (dsh recognizers)
  speech/wave.ts         canonical WAV intake validation (see rule 6)
  remote-contract.ts     zod schemas (Host-only; client must use `import type`)
  typert.ts              TYPERT manifest — invocations + model (two services)
  index.ts               plugin entry (named `name` / `apply`)

src/client/              Browser half (bundled to lib/client.js)
  index.ts               slot registrations + lifecycle
  MicrophoneButton.tsx   mic in conversation.input.right (order 9999)
  OptimizeButton.tsx     ✨ in conversation.input.right (order 9998)
  VoiceRecognitionBar.tsx  status strip in conversation.input.dock (order 15)
  voice-session.ts       per-session state + the meter store (useSyncExternalStore)
  styles.ts              the plugin stylesheet (dock width convention — see rule 8)
  audio-capture.ts       getUserMedia → 16 kHz mono PCM16 WAV, slicing, base64
  native-speech.ts       segment streaming + final pass + SilenceWatch auto-stop
  settings.tsx           settings.section (order 16)
  templates-section.tsx  settings.section (order 17)
  strings.ts             zh/en dictionary, registered as one locale namespace
```

### Notes

- **No default export** from the entry. The Loader discards function plugins that have one.
- Client `inject` deliberately **omits** `remote.betterInput` — this plugin mounts it via
  `ctx.remote.$mount`, so declaring it on the outer inject would deadlock waiting for itself.
  It is declared only on the inner `ctx.inject()`.
- **Speech is a two-pass design on purpose.** dsh's speech service transcribes whole
  recordings only, so `native-speech.ts` streams *preview* segments while recording and then
  transcribes the whole recording once for the authoritative transcript. Never polish the
  preview: only the final pass feeds `polishDraft()`. The draft race check compares against
  the text this session wrote last (`lastWrittenDraftRef`), because preview ≠ final.
- **The status bar is fed by a second store, not by the session state.** `VoiceMeter`
  (`voice-session.ts`) carries the 5 Hz telemetry — elapsed seconds, input level, silence
  countdown — and only `VoiceRecognitionBar` subscribes; putting it in
  `VoiceInputSessionSnapshot` would re-render the microphone button and every other session
  subscriber five times a second. `getSnapshot` returns a cached object, as
  `useSyncExternalStore` requires.
- **The silence auto-stop lives in `SilenceWatch`** (`native-speech.ts`), deliberately pure
  and Web-Audio-free so `check:speech` can drive it. Its contract: the countdown never runs
  before the first sound, any new sound resets it, `autoStopSeconds: 0` disables it (the hard
  `maxRecordingSeconds` ceiling still applies), and cutting a preview segment must **not**
  reset it — that is why the cutter keeps its own `silenceSeconds` counter.
- The speech service looks up `ctx.get('speechToText')` lazily and must **not** list it in
  `static inject` — the plugin's settings page, prompt optimization and template library
  must keep working in a composition without the speech bundle (rule 1).
- Settings use a **self-owned JSON document**, not the settings API: `0.1.7` removed
  `settings.register(namespace, schema)` and `0.2.0-rc.2` still does not have it, so
  `SettingsForms` (which addresses profile entry ids, not plugin runtime toggles) remains
  the only alternative. Do not reintroduce a dependency on that API.
- Out-of-range or legacy settings values are **repaired on read** in
  `settings/store.ts#normalizeSettings`, not merely defaulted: `merge()` validates the whole
  document, so one stale value (the recording limit used to allow 600 s) would otherwise make
  every later save fail.
- New externally visible names go in `src/identity.ts`, not as literals.
- Data directory is `~/.dsh/sqs-dsh-better-input/` so it can coexist with the
  upstream plugin installed side by side.
- The client `externals` list in `tsdown.client.ts` still names
  `@deepseek-ai/dsh-client-runtime/client`, a package dsh 0.1.2 deleted. It is inert (the
  bundle requires nothing from it) and kept only to document the historical contract.

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
**stay deleted**. They are the exact deletions that triggered the incident in rule 2.

### Native voice input — the capture layer now **uses** it

As of this release, this plugin's microphone records audio and hands it to dsh's own speech
service; the browser Web Speech API path is **deleted** (`src/client/web-speech.ts`). Do not
reintroduce it: on Chrome/Edge it is a **cloud** recognizer (audio leaves the machine), which
is the opposite of why this change was made, and it cannot be polished as reliably as a text
we own.

dsh `0.2.0` ships that capability as an **optional, off-by-default** bundle
`@deepseek-ai/dsh-experimental-voice-input-bundle` (local SenseVoice + API speech-to-text).
What stays true:

- its own microphone registers in `conversation.input.activity`, this plugin's in
  `conversation.input.right` — the two **slots** still do not collide, and both may be
  enabled at once. **Their function now overlaps**: dsh's own mic also transcribes with the
  same local provider, and it does so with a nicer setup/prepare flow.
- What dsh's own mic does **not** do, and what justifies this plugin's microphone:
  it inserts the transcript and stops there. This plugin adds **segment-level streaming while
  you speak**, **AI polishing of the finished transcript**, prompt optimization and the
  template library.
- `voice-session.ts` and `MicrophoneButton.tsx` are therefore still this plugin's own; only
  the recognition engine behind them changed.

Two consequences to keep in mind when touching any of this:

1. The plugin now **depends on that bundle at runtime for voice** (not at load time — see
   rule 1 on `ctx.get`). Without it, everything except the microphone keeps working, and the
   settings page reports "本地识别器：不可用".
2. dsh's speech **service** and dsh's speech **UI plugin** are separate loader entries
   (`speech-to-text` / `api-speech-to-text` vs `ui-voice-input`). This plugin needs the
   former; a profile may disable the latter and still have a working microphone here.

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
npm run verify        # must pass: build, bundle, speech-audio, typert and peer guards
```

Then boot the plugin once in a throwaway profile (`$DSH_HOME` probe above) and confirm it is
neither skipped nor failing activation. `verify` guards the silent failure classes that are
decidable from the tree alone (rules 1, 2 and 6); only a real boot proves the plugin actually
mounted, and only the end-to-end speech probe proves the recognizer answers.
