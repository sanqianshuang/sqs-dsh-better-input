# Internals

Long-form detail deliberately kept **out of `AGENTS.md`**, because that file is auto-loaded
into every agent session and every line is a permanent per-session token cost.

Read `AGENTS.md` first — it carries the rules. This file carries the reasoning, the forensics
and the operational recipes behind them. `git log -p AGENTS.md` has the full earlier text.

---

## Architecture

```
src/                     Host (Node) half
  identity.ts            single source of truth for names/URLs — never hardcode
  config.ts              settings shape, defaults, validation, speech limits
  settings/store.ts      self-owned JSON doc at ~/.dsh/sqs-dsh-better-input/settings.json
  templates/store.ts     template JSON doc in the same directory
  polish/service.ts      the BetterInputPolish service (llm-backed)
  polish/prompts.ts      default system prompts
  speech/service.ts      the BetterInputSpeech service (dsh recognizers)
  speech/wave.ts         canonical WAV intake validation (rule 6)
  remote-contract.ts     zod schemas (Host-only; client must use `import type`)
  typert.ts              TYPERT manifest — invocations + model (two services)
  index.ts               plugin entry (named `name` / `apply`)

src/client/              Browser half (bundled to lib/client.js)
  index.ts               slot registrations + lifecycle
  MicrophoneButton.tsx   mic in conversation.input.right (order 9999)
  OptimizeButton.tsx     ✨ in conversation.input.right (order 9998)
  composer-model.ts      the composer's selected model (ctx.modelDirectories, optional)
  native-voice-seat.ts   takes conversation.input.activity so dsh's own mic stops rendering
  VoiceRecognitionBar.tsx  status strip in conversation.input.dock (order 15)
  voice-session.ts       per-session state + the meter store (useSyncExternalStore)
  styles.ts              the plugin stylesheet (dock width convention — see rule 8)
  audio-capture.ts       getUserMedia → 16 kHz mono PCM16 WAV, slicing, base64
  native-speech.ts       segment streaming + final pass + SilenceWatch auto-stop
  settings.tsx           settings.section (order 16)
  templates-section.tsx  settings.section (order 17)
  strings.ts             zh/en dictionary, registered as one locale namespace
```

### Design notes

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
- **Polish and prompt optimization follow the composer's model.** `composer-model.ts` reads
  dsh's own per-session model directory (`ctx.modelDirectories.directoryFor(sessionId).store`)
  lazily through `ctx.get()`, never through `inject`: the model-selection client plugin is
  optional, and every assist must keep working without it (they then fall back to the route
  configured in settings). Its shape is declared **structurally** rather than imported, so a
  handful of field names adds no peer and no dev dependency. `resolveInputModelRoute()`
  (`src/config.ts`) is the single decision point, and `npm run check:routes` guards both the
  settings round-trip and that decision.
  The settings page is **session-less** (the framework hands it an empty `sessionId`), so it
  uses `ComposerModelSource.activeFace()` instead of a per-session face: that tracks dsh's
  main-view binding (`ctx.uiSession.current`, again `ctx.get()`, never `inject`) and
  re-points the inner face on a Session switch. While a row follows the composer it renders
  the composer's model **read-only** plus a "following" badge — an earlier revision bound the
  row to the stored fallback route and merely disabled it, so the control never showed the
  model actually in use and looked like "following is broken". The **effort** row, by
  contrast, stays visible and editable while following — hiding it was how the cost bug
  became unfixable from the UI.
- **A capture failure must not be blamed on the origin.** `getUserMedia` rejects with
  `NotFoundError` on a machine with no microphone, which is fixed by plugging a device in —
  not by changing the page's origin. `toCaptureError()` (`src/client/audio-capture.ts`)
  therefore maps it (and `OverconstrainedError`) to a distinct `no-device` kind with its own
  string. It also reads `name` **structurally**, not via `instanceof DOMException`: a
  cross-realm `DOMException` or a plain `Error` fails `instanceof` here and would silently
  downgrade a denied permission to the generic sentence. `npm run check:routes` asserts the
  full mapping and that the kinds stay disjoint.
- **A failed `start()` must not strand the recognition bar.** `NativeSpeechSession.start()`
  reports its failure through `onError` and then returns with the session inactive, so the
  caller's `if (!session.active) return` used to leave the shared state on `starting` —
  which the bar renders as "Listening…" for a recording that never began. The caller now
  falls back to `idle` when the state is still `starting`.
- The client `externals` list in `tsdown.client.ts` still names
  `@deepseek-ai/dsh-client-runtime/client`, a package dsh 0.1.2 deleted. It is inert (the
  bundle requires nothing from it) and kept only to document the historical contract.

---

## Forensics behind the hard rules

### Rule 1 — the prerelease upper bound

`>=0.1.7-rc.2 <0.2.0-0` looks like it means "the 0.1.7 line", but `0.2.0-0` is the *lowest*
prerelease of `0.2.0`, so `<0.2.0-0` excludes **every** prerelease of 0.2.0 — including
`0.2.0-rc.2`. `0.1.0` shipped exactly that, and the plugin was 100% dead on `0.2.0-rc.2`
while `npm run build`, `npm run check`, `check:bundle` and `check:typert` all passed. The
only trace was one line on the launcher's stderr:

```
dsh: skipping profile bundle "sqs-dsh-better-input": Error: Plugin
sqs-dsh-better-input@0.1.0 is incompatible with dsh 0.2.0-rc.2: peerDependencies
{"@deepseek-ai/dsh-api-remotes":">=0.1.7-rc.2 <0.2.0-0", …}.
```

Related traps the guard also enforces:

- A peer can be required **without appearing in any `import`**. `@deepseek-ai/dsh-client-ui-slots`
  re-exports `SnapshotSelectorHook` from `@deepseek-ai/dsh-client-store` while declaring that
  dependency nowhere, so dropping our `dsh-client-store` entry makes `skipLibCheck` degrade the
  type to `any` and the `useInput((state) => …)` callbacks fail with `TS7006`. Packages reachable
  from a peer's `.d.ts` count as used.
- An **unused** peer is not free either — it is one more range that can demote the bundle on a
  future runtime. Keep the peer list exactly as wide as the type graph requires.
- Conversely, a **type-only** import must **not** force a peer.
  `@deepseek-ai/dsh-experimental-speech-to-text` is imported only as `import type` (for
  `Context.speechToText` and the provider types); the emitted `lib/` contains no reference to it
  at all. Declaring it a peer would be a lie about the runtime, and would add exactly the kind of
  range that demotes this bundle if a future dsh renames or drops the experimental package —
  losing the settings page, prompt optimization and the template library along with it.

  | how `src/` reaches the package | what it needs |
  | --- | --- |
  | value import (`import { x } from`, dynamic `import()`, side-effect `import`) | a **peer** entry with a range admitting the runtime |
  | `import type … from` / `export type … from` | a dev dependency **pinned to the exact runtime version** |

### Rule 2 — the Typert manifest incident

A failure is not scoped to this plugin: any contributor failing throws `AggregateError`,
**the built-in Typert loader itself fails to activate**, zero definitions get registered,
and every Typert-gated read/write in dsh breaks — the settings UI shows "模型列表为空" and
the permission page reads 不可用, which looks exactly like "dsh lost its config" even though
nothing on disk was lost. This happened in `0.1.0`–`0.1.2`, when the whole `model` block was
deleted alongside the file-input/OCR feature. Full forensics:
[INCIDENT-20260925-typert-model.md](../INCIDENT-20260925-typert-model.md).

The parity assertion catches the other silent failure of the same "four places, one missing"
shape — manifest, RPC contract and browser UI all present, Host method never written — which
passes every schema check, activates cleanly, and only fails when the user actually calls the
RPC:

```
typert gateway: betterInput/templatesList: active Service "BetterInputPolish" has no callable method "templatesList"
```

(The template library shipped exactly that way in 0.2.0-rc.2.) The assertion reports `SKIP`
when `src/` is absent, i.e. when the guard runs inside an installed tarball.

`check:typert` also compares the two faces endpoint-for-endpoint — method, wire names **in
order**, and the cancellation parameter — because neither `tsc` (both are plain objects) nor
the loader (it validates one face at a time) can see a parameter added to only one of them.
The browser builds its args object from its own descriptor, so a missing wire field is
rejected by `assertExactArguments` and an extra one shifts every positional argument: the
service then reads a string where the `AbortSignal` belongs.

### Rule 3 — zod in the client bundle

The client does **no** wire validation. `@deepseek-ai/dsh-api-gateway` (Host) is the only
place that calls `codec.create().parse(value)`; the client's `$mount` path only checks
`codec.mode === 'strict'` and never invokes the factory.

So `src/remote.ts` builds **schema-free lazy codecs** (`create()` exists to satisfy the
`TypertCodec` shape, but references no zod). A stray **value** import of
`remote-contract.js` from the client graph silently pulls ~180 kB of zod back in and
takes `lib/client.js` from ~100 kB to ~280 kB. Two non-fixes, so you don't try them:

- **Do not** add `zod` to the client `externals`. It is neither a platform seed word nor a
  boot-graph row, so the bundle dies with
  `client-modules: require("zod") missed the module table`.
- **Do not** widen `alwaysBundle` to `true`. It is a narrow whitelist (`specifier.startsWith('.')`)
  on purpose. A bare specifier reaching the client graph is a bug to fix at the import site.

### Rule 6 — WAV intake

dsh accepts exactly one format (`@deepseek-ai/dsh-experimental-speech-to-text` → `./wave`):
`RIFF`/`WAVE`/`fmt `/fmt size 16/PCM/1 channel/**16000 Hz**/byteRate 32000/blockAlign 2/bits
16/`data`, RIFF size = length − 8, data size = length − 44, even PCM length, and a duration
at or under the speech Remote's `maxDurationSeconds` default, **120** (this plugin mirrors
it as `SPEECH_MAX_RECORDING_SECONDS`; 120 s of 16 kHz mono PCM16 is 3.84 MB, just under the
Remote's 4 MiB `maxAudioBytes`).

`src/speech/wave.ts` deliberately duplicates dsh's validator instead of importing
`@deepseek-ai/dsh-experimental-speech-to-text/wave`: our dependency on that package is
type-only (rule 1), so a runtime import would break an `npm pack` install, which has no dev
dependencies.

`check:speech` cross-checks the encoder against dsh's own `validateWave` (authoritative when a
dsh install resolves), agrees on duration for random recordings, requires both sides to reject
seven classes of malformed header, and checks the 120 s boundary on both the byte and the
duration ceiling. It also asserts the settings migration that keeps old installs usable
(`zh-CN → zh`, a stored 600 s limit → 120, a missing/invalid silence window → 10).

### Rule 8 — dock width math

The card is **not** `100%`: it is `--dsh-chat-content-width + 32px` (with
`--dsh-chat-content-width` clamped to `clamp(680px, 64% of the column, 920px)`), so
`width: 100%` overflows on a wide window while `calc(100% - 32px)` overflows on a narrow one.
The `embedded` layout changes both variables, which is why they must be read, never hardcoded.

The quickest check is a throwaway HTML page that reproduces the container with the real
variables copied from `@deepseek-ai/dsh-client-ui-conversation/lib/client.js`, plus the plugin
stylesheet lifted out of the built `lib/client.js` — see `evidence/bar-layout.png` for what
the fixed version looks like next to the old full-bleed bar.

### The native-mic shadow — three silent registry traps

1. `conversation.input.activity` is `kind: 'single'`, and `entriesOfSlot()` returns the
   **first entry in ascending priority order**, so taking the seat means registering
   *below* the occupant (`priority: -1` vs the native default 0). Registering at the same
   priority throws instead.
2. The slot **does not exist when this plugin activates**: `dsh-client-ui-conversation`
   declares it inside `slots.inject('main', …)`, three declaration layers deep. A bare
   `slots.register` therefore throws `slot "…" is not declared`; it must go through
   `slots.inject(key, cb)`, which runs the callback when the declaration appears.
3. The entry's `inject` must return an **object**. The outlet feeds every inject face
   through `bindInjectSources()`, which reads `face['hooks']` first: returning `undefined`
   throws `TypeError: Cannot read properties of undefined (reading 'hooks')`, and the
   entry-boundary error handler **abdicates** the entry, so the shadow silently stops
   working while the code looks correct. The component must also render a real element
   (an empty `Fragment`), not `null`.

Diagnosing 3 is the hard part: the crash does **not** appear when you re-read the console
afterwards. Hook `console.error` via `Page.addScriptToEvaluateOnNewDocument` and reload.
`npm run check:routes` guards the priority, the slot name and the mount site.

---

## Operational recipes

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

Then run `npm run verify` and boot the plugin once in a throwaway profile.

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
`ls` shows `src/`, `scripts/` and even `AGENTS.md`, because none of the `files` whitelist
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
npm run verify                                         # build + bundle + speech + typert + routes + peers
# and grep the startup log for:
#   dsh: warning: N entry did not activate
#   dsh: skipping profile bundle
```

Also mind the two ways a `--dump-config` run can lie about this repository: it writes
`<profile>/cordis.yml`, so it needs a writable `$DSH_HOME`; and a *skipped* bundle is
reported on stderr while **stdout still composes successfully** with `exit=0`.
