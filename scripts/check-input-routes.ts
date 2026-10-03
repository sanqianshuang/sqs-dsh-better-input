#!/usr/bin/env unrun
/**
 * Guard for the settings document and the polish/optimize route resolution.
 *
 * Two silent failure classes, neither of which `tsc` nor the build can see:
 *
 *   1. A setting that exists on `BetterInputSettings`, in `DEFAULT_SETTINGS` and
 *      in the Typert wire schema, but is missing from `normalizeSettings`.
 *      `merge()` spreads the patch straight into the document, so the value
 *      *is* persisted — and then silently dropped the next time the file is
 *      read, because `normalizeSettings` rebuilds the object field by field.
 *      The user's toggle appears to save and then reverts on reload.
 *   2. The route an assist actually calls. `resolveInputModelRoute` is what makes
 *      polish/optimize follow the composer's selected model; if it regresses,
 *      the settings route is used again and the reported bug comes straight
 *      back — with no error anywhere.
 *
 * Usage:
 *   unrun scripts/check-input-routes.ts
 */

import {
  DEFAULT_SETTINGS,
  resolveAutoRoute,
  resolveInputModelRoute,
  type BetterInputSettings
} from '../src/config.js'
import { normalizeSettings } from '../src/settings/store.js'
import { sweepStaleTemporaries, temporaryPathFor, writeFileAtomic } from '../src/atomic-write.js'
import { assistStreamOptions } from '../src/polish/assist-options.js'
import { resolveAssistRoute } from '../src/client/assist-route.js'
import { createAudioContext, toCaptureError } from '../src/client/audio-capture.js'
import { dshHomeDir } from '../src/home.js'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const failures: string[] = []
const pass = (message: string, detail = '') => console.log(`PASS  ${message}${detail ? `  [${detail}]` : ''}`)
const fail = (message: string, detail = '') => {
  failures.push(message)
  console.log(`FAIL  ${message}${detail ? `  [${detail}]` : ''}`)
}
const check = (message: string, condition: boolean, detail = '') => {
  if (condition) pass(message, detail)
  else fail(message, detail)
}

/** Set equality on two key lists, sorted, for reporting the difference. */
const sameKeys = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((key, index) => key === right[index])
const keyDifference = (left: readonly string[], right: readonly string[]): string => {
  const missing = left.filter((key) => !right.includes(key))
  const extra = right.filter((key) => !left.includes(key))
  return [missing.length === 0 ? '' : `missing ${missing.join(', ')}`, extra.length === 0 ? '' : `extra ${extra.join(', ')}`]
    .filter((part) => part !== '')
    .join('; ')
}

/**
 * The two wire schemas, loaded **dynamically**.
 *
 * A static import is not an option: `unrun` bundles this script into a temp
 * directory, where the bare `zod` import inside `remote-contract.ts` cannot be
 * resolved. A dynamic `import()` of the real path is handed to Node, which
 * resolves `zod` from this package.
 *
 * `src/remote-contract.ts` is preferred (it is type-erasable, so Node's own
 * TypeScript support loads it in place and the *source* is what gets checked);
 * `lib/typert.js` is the fallback for an older Node, and reads the same zod
 * schemas back out of the manifest's codecs.
 */
type ZodLike = { shape: Record<string, unknown>; parse(value: unknown): unknown }

async function loadWireSchemas(): Promise<{ document: ZodLike; patch: ZodLike; origin: string } | undefined> {
  try {
    const module = await import(new URL('../src/remote-contract.ts', import.meta.url).href) as {
      betterInputSettingsSchema?: unknown
      betterInputSettingsPatchSchema?: unknown
    }
    if (module.betterInputSettingsSchema !== undefined && module.betterInputSettingsPatchSchema !== undefined) {
      return {
        document: module.betterInputSettingsSchema as ZodLike,
        patch: module.betterInputSettingsPatchSchema as ZodLike,
        origin: 'src/remote-contract.ts'
      }
    }
  } catch {
    // Older Node, or the file moved: fall through to the built manifest.
  }
  try {
    const manifest = (await import(new URL('../lib/typert.js', import.meta.url).href)).TYPERT as {
      invocations: Array<{
        method: string
        parameters?: Array<{ wire: string; codec: { create(): ZodLike } }>
        result: { create(): ZodLike }
      }>
    }
    const view = manifest.invocations.find((invocation) => invocation.method === 'getSettings')?.result.create()
    const patch = manifest.invocations
      .find((invocation) => invocation.method === 'updateSettings')
      ?.parameters?.find((parameter) => parameter.wire === 'patch')?.codec.create()
    const document = (view?.shape as { settings?: unknown } | undefined)?.settings
    if (document === undefined || patch === undefined) return undefined
    return { document: document as ZodLike, patch, origin: 'lib/typert.js (run the build to check the source instead)' }
  } catch {
    return undefined
  }
}

// --- 1. normalizeSettings is a complete round-trip --------------------------
const normalized = normalizeSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as unknown)
const declared = Object.keys(DEFAULT_SETTINGS).sort()
const produced = Object.keys(normalized).sort()
const missing = declared.filter((key) => !produced.includes(key))
const invented = produced.filter((key) => !declared.includes(key))
check(
  'normalizeSettings rebuilds every declared setting',
  missing.length === 0,
  missing.length === 0 ? `${produced.length} keys` : `missing ${missing.join(', ')}`
)
check('normalizeSettings invents no undeclared setting', invented.length === 0, invented.join(', '))

// The empty document is what an install predating a setting actually has.
const fromEmpty = normalizeSettings({})
const reverted = declared.filter(
  (key) => fromEmpty[key as keyof BetterInputSettings] !== DEFAULT_SETTINGS[key as keyof BetterInputSettings]
)
check(
  'an empty document normalizes onto the defaults',
  reverted.length === 0,
  reverted.length === 0 ? 'all keys' : `diverged: ${reverted.join(', ')}`
)
check(
  'an existing install follows the composer model',
  fromEmpty.polishFollowInputModel === true && fromEmpty.optimizeFollowInputModel === true
)
check(
  'an explicit opt-out survives normalization',
  normalizeSettings({ polishFollowInputModel: false, optimizeFollowInputModel: false }).polishFollowInputModel === false &&
    normalizeSettings({ polishFollowInputModel: false, optimizeFollowInputModel: false }).optimizeFollowInputModel === false
)

// --- 1b. the same settings cross the wire intact ----------------------------
// Same failure class as above, one layer further out, and strictly worse: the
// gateway validates **incoming arguments** with these schemas and hands the
// *parsed* value to the service (`decode()` → `codec.create().parse(value)` —
// `dsh-api-gateway/lib/index.js`). A zod object strips what it does not declare,
// so a setting missing from the *patch* schema is dropped before `merge()` ever
// sees it: `updateSettings` answers `ok`, the settings page clears its draft as
// if it saved, and the value reverts on the next read.
//
// That is not hypothetical — `autoStopSeconds` was declared in
// `BetterInputSettings`, defaulted in `DEFAULT_SETTINGS`, repaired in
// `normalizeSettings` and *absent from both wire schemas*, so the
// "auto-stop after silence" field could never be saved (fixed in
// `0.2.0-rc.2-sqs.4`). Comparing the three lists is what catches the next one,
// and the parse below is the behaviour the lists are there to protect.
const wire = await loadWireSchemas()
if (wire === undefined) {
  fail('the wire schemas are readable', 'neither src/remote-contract.ts nor lib/typert.js could be loaded')
} else {
  const settingsWireKeys = Object.keys(wire.document.shape).sort()
  const patchWireKeys = Object.keys(wire.patch.shape).sort()
  check(
    'every declared setting crosses the wire',
    sameKeys(declared, settingsWireKeys),
    keyDifference(declared, settingsWireKeys) || `${settingsWireKeys.length} keys from ${wire.origin}`
  )
  check(
    'every declared setting is patchable through the wire',
    sameKeys(declared, patchWireKeys),
    keyDifference(declared, patchWireKeys) || `${patchWireKeys.length} keys`
  )

  // The boundary itself, driven with the value that used to be lost.
  const patchedAtBoundary = wire.patch.parse({ autoStopSeconds: 7, polishProvider: 'p' }) as Record<string, unknown>
  check(
    'a patch survives the gateway boundary parse intact',
    patchedAtBoundary.autoStopSeconds === 7 && patchedAtBoundary.polishProvider === 'p',
    JSON.stringify(patchedAtBoundary)
  )
  const documentAtBoundary = wire.document.parse({ ...DEFAULT_SETTINGS }) as Record<string, unknown>
  check(
    'a complete document survives the gateway boundary parse intact',
    sameKeys(Object.keys(documentAtBoundary).sort(), declared),
    keyDifference(declared, Object.keys(documentAtBoundary).sort()) || `${declared.length} keys`
  )
  check(
    'the boundary keeps the auto-stop window, 0 included',
    (wire.document.parse({ ...DEFAULT_SETTINGS, autoStopSeconds: 0 }) as Record<string, unknown>).autoStopSeconds === 0 &&
      (wire.patch.parse({ autoStopSeconds: 0 }) as Record<string, unknown>).autoStopSeconds === 0
  )
}

// --- 1c. the document's write is atomic and leaves no staging file -----------
// Both JSON documents are published with `writeFile + rename`. The staging name
// is deterministic on purpose: one that carries a timestamp turns every failed
// write into a *new* file, so a full disk or a crash between the two steps leaves
// one stray `.tmp` per attempt forever. The cleanup on the failing path is the
// other half — without it a locked destination leaves the staging file behind.
const staging = mkdtempSync(join(tmpdir(), 'sqs-better-input-guard-'))
const documentPath = join(staging, 'settings.json')
await writeFileAtomic(documentPath, '{"autoStopSeconds":7}\n')
const stagingPath = temporaryPathFor(documentPath)
check(
  'a successful write publishes the document and leaves no staging file',
  readFileSync(documentPath, 'utf8').includes('7') && !existsSync(stagingPath),
  `staging=${stagingPath.slice(staging.length + 1)}`
)
// Deterministic, so a leftover is overwritten rather than joined by a second one.
check(
  'the staging name is deterministic rather than per-attempt',
  temporaryPathFor(documentPath) === stagingPath && temporaryPathFor(documentPath) === temporaryPathFor(documentPath)
)
writeFileSync(stagingPath, 'stale')
await writeFileAtomic(documentPath, '{"autoStopSeconds":0}\n')
check(
  'a stale staging file is reused instead of accumulating',
  readFileSync(documentPath, 'utf8').includes('0') && !existsSync(stagingPath)
)
// Failing publish: the destination is a directory, so `rename` cannot complete.
const blocked = join(staging, 'blocked')
mkdirSync(blocked, { recursive: true })
let failedAsExpected = false
try {
  await writeFileAtomic(blocked, '{}')
} catch {
  failedAsExpected = true
}
check(
  'a failed write reports the error and leaves no staging file',
  failedAsExpected && !existsSync(temporaryPathFor(blocked)),
  existsSync(temporaryPathFor(blocked)) ? 'staging file left behind' : 'clean'
)
// Crash residue: a `SIGKILL` (or a power loss) between the two steps is the one
// failure the cleanup above cannot observe, so the staging file survives it. The
// first load of the process reaps it — narrowly: only this document's staging
// files, only another process's pid, and only when it is older than the threshold.
const deadPid = 999999
const orphanPath = `${documentPath}.${deadPid}.tmp`
const freshPath = `${documentPath}.${deadPid + 1}.tmp`
const ownPath = temporaryPathFor(documentPath)
const lookalikes = [
  `${documentPath}.tmp`,
  `${documentPath}.bak.tmp`,
  join(staging, 'other.json.999998.tmp')
]
const longAgo = new Date(Date.now() - 60 * 60 * 1000)
for (const path of [orphanPath, ownPath, ...lookalikes]) {
  writeFileSync(path, 'orphan')
  utimesSync(path, longAgo, longAgo)
}
writeFileSync(freshPath, 'in flight')
const swept = await sweepStaleTemporaries(documentPath)
check(
  'a staging file stranded by a killed process is reaped on load',
  swept === 1 && !existsSync(orphanPath),
  `swept=${swept}`
)
check(
  'the sweep is narrow: our own, an in-flight write and lookalikes all survive',
  existsSync(ownPath) && existsSync(freshPath) && lookalikes.every((path) => existsSync(path))
)
rmSync(staging, { recursive: true, force: true })

// --- 2. the route polish/optimize actually calls ----------------------------
const configured = { provider: 'settings-provider', model: 'settings-model', reasoningEffort: 'low' }
const composer = { provider: 'composer-provider', model: 'composer-model' }

check(
  'following the composer uses the composer model',
  JSON.stringify(resolveInputModelRoute(true, composer, configured)) ===
    JSON.stringify({ provider: 'composer-provider', model: 'composer-model', reasoningEffort: 'low' })
)
// The cost regression, pinned: an assist must never inherit the conversation's
// thinking tier. `composer` deliberately carries no effort field at all now, so
// the only way this can fail is by the resolver growing one back.
check(
  'the thinking tier is the feature’s own setting, never the composer’s',
  resolveInputModelRoute(true, composer, { ...configured, reasoningEffort: 'high' })?.reasoningEffort === 'high' &&
    resolveInputModelRoute(true, composer, { ...configured, reasoningEffort: '' })?.reasoningEffort === ''
)
check(
  'the tier survives while the model falls back to the configured route',
  resolveInputModelRoute(true, null, configured)?.reasoningEffort === 'low' &&
    resolveInputModelRoute(false, composer, configured)?.reasoningEffort === 'low'
)
check(
  'an unreadable composer falls back to the configured route',
  JSON.stringify(resolveInputModelRoute(true, null, configured)) ===
    JSON.stringify({ provider: 'settings-provider', model: 'settings-model', reasoningEffort: 'low' })
)
check(
  'the opt-out always uses the configured route',
  resolveInputModelRoute(false, composer, configured).provider === 'settings-provider'
)
check(
  'an incomplete composer route falls back rather than calling nothing',
  resolveInputModelRoute(true, { provider: 'p', model: '' }, configured).model === 'settings-model'
)
check(
  'a whitespace-only composer route falls back too',
  resolveInputModelRoute(true, { provider: ' ', model: ' ' }, configured).model === 'settings-model'
)
// Neither side naming a route yields an empty pair — the callers turn that into
// "no model configured". It is an object rather than `null` so the tier can
// still be reported; the emptiness test lives with the callers.
check(
  'neither side naming a route yields an empty pair',
  JSON.stringify(resolveInputModelRoute(true, null, { provider: '', model: '', reasoningEffort: '' })) ===
    JSON.stringify({ provider: '', model: '', reasoningEffort: '' })
)
check(
  'the resolver always returns a route object, never null',
  resolveInputModelRoute(false, null, { provider: ' ', model: ' ', reasoningEffort: '' }) !== null
)

// --- 2b. the Session travels with the assist request ------------------------
// A relay route can require per-session transport metadata (OpenCode rejects a
// request with HTTP 400 `MissingSessionID` unless `x-opencode-session` is
// attached; the header is attached natively by pi-ai's `opencode-go` provider
// from `options.sessionId`, so the caller's only job is to supply the id).
// `tsc` cannot see this: the request is well-typed either way, the provider is
// the only thing that objects, and the failure arrives as a terminal finish
// chunk — so a regression here silently turns every non-official route into
// "prompt optimization is broken".
const assistFields = { messages: [], system: 'sys', sessionId: 'session-abc', signal: new AbortController().signal }
const withSession = assistStreamOptions({ provider: 'p', model: 'm' }, assistFields)
check('an assist request is stamped with the composer Session', withSession.sessionId === 'session-abc')
check(
  'the Session is trimmed and a blank one is omitted rather than sent as ""',
  assistStreamOptions({ provider: 'p', model: 'm' }, { ...assistFields, sessionId: '  session-abc  ' }).sessionId === 'session-abc' &&
    !('sessionId' in assistStreamOptions({ provider: 'p', model: 'm' }, { ...assistFields, sessionId: '   ' }))
)
check(
  'the prepared call config is forwarded unchanged beside the Session',
  assistStreamOptions({ provider: 'p', model: 'm', maxTokens: 64 }, assistFields).provider === 'p' &&
    assistStreamOptions({ provider: 'p', model: 'm', maxTokens: 64 }, assistFields).maxTokens === 64
)
// The service must actually hand the Session to the request builder — the module
// above is dead code otherwise, and that is exactly the shape of the bug.
const serviceSource = readFileSync(new URL('../src/polish/service.ts', import.meta.url), 'utf8')
check(
  'both assists build their request through assistStreamOptions()',
  (serviceSource.match(/assistStreamOptions\(/g) ?? []).length === 2 &&
    /async polish\([^)]*sessionId: string/.test(serviceSource) &&
    /async optimize\([^)]*sessionId: string/.test(serviceSource)
)

// --- 2c. first-launch auto-fill must not pin the official provider ----------
// `listProviders()` returns registration order, and the base bundle activates
// the official DeepSeek adapter before any configured pi-ai provider — so
// `routes[0]` is `deepseek-official` on every stock composition. Storing it made
// the plugin look "pinned to the official key", invisibly, because the rows
// render the composer's model while they follow it.
const officialFirst = [{ provider: 'deepseek-official', model: 'deepseek-chat' }, { provider: 'relay', model: 'mine' }]
check(
  "auto-fill prefers dsh's agent default model over the first registered route",
  JSON.stringify(resolveAutoRoute({ provider: 'relay', model: 'mine' }, officialFirst)) ===
    JSON.stringify({ provider: 'relay', model: 'mine' })
)
check(
  'a default model the Host does not advertise is not stored verbatim',
  JSON.stringify(resolveAutoRoute({ provider: 'relay', model: 'gone' }, officialFirst)) ===
    JSON.stringify({ provider: 'deepseek-official', model: 'deepseek-chat' })
)
check(
  'an absent default-model service still stores a usable route',
  JSON.stringify(resolveAutoRoute(null, officialFirst)) === JSON.stringify({ provider: 'deepseek-official', model: 'deepseek-chat' })
)
check(
  'an empty default model falls through instead of storing blanks',
  JSON.stringify(resolveAutoRoute({ provider: '  ', model: '' }, officialFirst)) ===
    JSON.stringify({ provider: 'deepseek-official', model: 'deepseek-chat' })
)
check('no routes means nothing to store', resolveAutoRoute({ provider: 'relay', model: 'mine' }, []) === null)

// --- 2d. the plugin's own documents live in dsh's home ----------------------
// `os.homedir()` ignores `$DSH_HOME`, so a machine launched with an explicit
// home gets the plugin's settings and templates in a *different* root from the
// credentials and sessions the user configured. Nothing fails; the plugin just
// silently reads the other installation's document.
//
// Expected paths are built with `node:path` rather than spelled with forward
// slashes: `dshHomeDir` returns a *native* path, so on Windows it answers
// `D:\tmp\explicit-home` — an assertion comparing against a hardcoded POSIX
// string fails there for a reason that has nothing to do with the rule under
// test (this guard was failing on Windows exactly that way).
check(
  '$DSH_HOME wins over the default home',
  dshHomeDir({ DSH_HOME: '/tmp/explicit-home' }) === resolve('/tmp/explicit-home')
)
check(
  'a blank $DSH_HOME is treated as unset',
  dshHomeDir({ DSH_HOME: '   ' }) === dshHomeDir({}) && dshHomeDir({}) === resolve(join(homedir(), '.dsh'))
)
check(
  'a tilde-prefixed $DSH_HOME expands to the OS home',
  dshHomeDir({ DSH_HOME: '~/custom' }) === resolve(join(homedir(), 'custom'))
)

// --- 3. capture failures are classified into the right user-facing sentence --
// A machine with no microphone rejects `getUserMedia` with `NotFoundError`. If
// that is folded into `unavailable` the bar tells the user their *origin* is at
// fault ("HTTPS or localhost required"), which sends them down a dead end: the
// fix is to plug a device in. Nothing else in the build can see this mapping.
const domError = (name: string): unknown => {
  const error = new Error(name)
  error.name = name
  return error
}
const kindOf = (name: string): string => toCaptureError(domError(name)).kind

check(
  'a missing input device is reported as "no-device", not as an origin problem',
  kindOf('NotFoundError') === 'no-device',
  kindOf('NotFoundError')
)
check(
  'an unsatisfiable device constraint is also "no-device"',
  kindOf('OverconstrainedError') === 'no-device',
  kindOf('OverconstrainedError')
)
check('a refused permission stays "permission"', kindOf('NotAllowedError') === 'permission')
check('an insecure origin stays "permission"', kindOf('SecurityError') === 'permission')
check('an aborted acquisition stays "interrupted"', kindOf('AbortError') === 'interrupted')
check(
  'an unrecognised rejection still degrades to "unavailable"',
  kindOf('SomethingElseError') === 'unavailable',
  kindOf('SomethingElseError')
)
// The kinds must stay disjoint: `no-device` sneaking back into `unavailable`
// would silently restore the misleading string.
check(
  '"no-device" is distinct from "unavailable"',
  kindOf('NotFoundError') !== kindOf('SomethingElseError')
)

// --- 3b. a failed start never leaves the microphone open --------------------
// `start()` acquires the device *before* it builds the audio graph, and its
// caller only reports the thrown error — it never receives a capture to
// `dispose()`. So every `throw` after `getUserMedia` has to hand the tracks
// back, or the browser keeps showing that the page is recording for the rest of
// its life. The graph construction is exactly where that leak used to be: both
// `new AudioContext(options)` and the bare `new AudioContext()` could throw, and
// the second failure escaped with the stream still live.
// `createAudioContext` is driven directly (the same reason `toCaptureError` is
// exported): the branch that leaked is only reachable when the *second*
// constructor attempt fails, and nothing else in the build can see it.
type ContextConstructor = new (options?: AudioContextOptions) => AudioContext
const stubContext = (sampleRate: number): AudioContext =>
  ({ sampleRate, state: 'running' }) as unknown as AudioContext
let attempts = 0
function rejectsRate(this: unknown, options?: AudioContextOptions): AudioContext {
  attempts += 1
  if (options !== undefined) throw new Error('unsupported sample rate')
  return stubContext(48000)
}
function alwaysFails(): AudioContext {
  throw new Error('no audio device available')
}
const fallbackContext = createAudioContext(rejectsRate as unknown as ContextConstructor)
check(
  'a context that rejects the requested sample rate falls back to the default constructor',
  fallbackContext?.sampleRate === 48000 && attempts === 2,
  `sampleRate=${String(fallbackContext?.sampleRate)} attempts=${attempts}`
)
check(
  'two failed context attempts answer undefined instead of throwing',
  createAudioContext(alwaysFails as unknown as ContextConstructor) === undefined
)
const captureSource = readFileSync(new URL('../src/client/audio-capture.ts', import.meta.url), 'utf8')
check(
  'every failure after the device is acquired hands it back',
  (captureSource.match(/throw this\.releaseDevice\(/g) ?? []).length >= 2 &&
    /private releaseDevice\(stream: MediaStream, message: string\): CaptureError/.test(captureSource)
)
check(
  'a refused audio graph releases the device too',
  /catch \(error\) \{\n {6}\/\/ A node can be refused[\s\S]{0,200}await this\.release\(\)/.test(captureSource)
)

// --- 4. dsh's own microphone stays hidden -----------------------------------
// `conversation.input.activity` is a `single` slot, so the native microphone and
// ours cannot both occupy it — the plugin takes the seat by registering at a
// LOWER priority than the occupant (the registry renders the lowest). Two silent
// failures here, neither visible to `tsc`:
//
//   * `priority` drifting to 0 or above. Registration then either throws
//     (`already has a registration at priority 0`) or loses the election, and
//     the composer shows two microphones again — the reported bug, verbatim.
//   * the slot name drifting. Shadowing a slot that is not `single` stops
//     hiding anything while still looking correct in the source.
//
// Both are string/constant facts on one small module, so they are checked here.
const seatSource = readFileSync(new URL('../src/client/native-voice-seat.ts', import.meta.url), 'utf8')
const declaredPriority = /const SHADOW_PRIORITY = (-?\d+)/.exec(seatSource)?.[1]
check(
  'the voice-input shadow registers below the native entry',
  declaredPriority !== undefined && Number(declaredPriority) < 0,
  `SHADOW_PRIORITY=${declaredPriority ?? 'missing'}`
)
check(
  'the shadow targets the single slot the native microphone occupies',
  /const NATIVE_VOICE_SLOT = 'conversation\.input\.activity'/.test(seatSource)
)
// The seat must be wired into the client entry, or the module above is dead code.
const clientSource = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
check(
  'the client entry actually mounts the seat shadow',
  /shadowNativeVoiceInput\(/.test(clientSource)
)

// --- 5. reading the composer's model must never re-create its directory ------
// `ctx.modelDirectories.directoryFor(sessionId)` hands out ONE directory per
// Session binding, and the model-selection package's entrypoints each file a
// scope teardown that runs
//
//     directory.dispose(); live.directories.delete(binding)
//
// i.e. the first scope to go away destroys the shared directory that every
// other subscriber — the `/model` popup AND the composer's own model seat — is
// still rendering from. A consumer that answers a disposed directory by asking
// `directoryFor()` again therefore mints a replacement *and* registers a fresh
// destructive teardown, in a render path, which is how a plugin can make dsh's
// model seat drop its own subscription on a model switch: the composer then
// renders a model the rest of the UI cannot read, the harness keeps tracking
// the model we just left, and nothing logs anything.
//
// Two source facts pin the safe shape, because `tsc` cannot see either:
//
//   * the disposed-directory branch must not construct an entry;
//   * the resolver must not cache a failed resolution, or a Session that is not
//     resident yet would be stuck on "unknown model" forever.
const composerModelSource = readFileSync(new URL('../src/client/composer-model.ts', import.meta.url), 'utf8')
const disposedBranch = /if \(directory\.disposed === true\)[\s\S]*?\n {4}\}/.exec(composerModelSource)?.[0] ?? ''
check(
  'a disposed model directory is never re-created during a read',
  disposedBranch !== '' && !/new ComposerModelEntry/.test(disposedBranch),
  disposedBranch === '' ? 'disposed branch missing' : disposedBranch.replace(/\s+/g, ' ').slice(0, 120)
)
check(
  'a disposed directory marks the cached entry orphaned instead of handing back a stale one',
  /orphan\(\)/.test(disposedBranch)
)
check(
  'an unresolvable Session is retried later rather than cached as "no model"',
  !/this\.entries\.set\(sessionId, (?:undefined|null)\)/.test(composerModelSource)
)
// The fallback boundary, which is the subtle one. dsh's `ModelDirectory` answers
// `current: null` on a LIVE directory whenever its Host catalog is not `ready`
// yet, so `null` does not mean "no selection". Treating it as a miss would
// silently substitute the catalog default — measured on a real profile the
// composer read `DeepSeek-V41-Flash` while the catalog default was
// `deepseek-official/deepseek-flash`, and the follow row showed the latter. A
// wrong-but-plausible model defeats the whole point of the follow row, so the
// fallback must be reachable only when the directory itself is missing.
const readForBody = (/private readFor\([\s\S]*?\n {2}\}/.exec(composerModelSource)?.[0] ?? '').replace(/\s+/g, ' ')
check(
  'a live directory is authoritative even when it answers null',
  /if \(entry !== undefined\) return entry\.read\(\)/.test(readForBody),
  readForBody.slice(0, 140)
)
check(
  'the unresolvable directory is what falls back to the Host catalog default',
  /const entry = this\.entryFor\(sessionId\)[\s\S]{0,200}return this\.catalogDefault/.test(readForBody)
)

// --- 6. the assist route is resolved on the HOST, not the browser ------------
// The browser's copy of the composer selection is a render-time snapshot whose
// backing store is only populated once the model-selection plugin's Host catalog
// is `ready`; before that it reports `current: null`. Any client-side substitute
// is therefore a guess about which model a request is billed to, which is how a
// follow row can confidently name the wrong model. The Host owns both inputs, so
// it answers. Adding an RPC means four places in lockstep (AGENTS.md rule 2), and
// `check:typert` only compares the two Typert faces — it cannot see a missing
// service method, which is the failure mode that shipped the template library
// broken. So the service method is asserted here.
const assistServiceSource = readFileSync(new URL('../src/polish/service.ts', import.meta.url), 'utf8')
check(
  'the Host resolves assist routes through the shared resolver',
  /resolveAssistRoute\(feature: string, sessionId: string\)/.test(assistServiceSource) &&
    /resolveInputModelRoute\(follow, composer, configured\)/.test(assistServiceSource)
)
check(
  'an unknown assist feature is rejected rather than resolved',
  /unknown assist feature/.test(assistServiceSource)
)
// The composer selection must come from the Host-side projection, and the
// services must be optional lookups (`ctx.get`), never `static inject`.
//
// The *field* matters as much as the call, and this is where a "does the source
// contain the call?" assertion is not enough — the previous version of this
// check only looked for `stateOf(session, 'modelSelection')` and therefore
// passed while the code read `.next`, a field that exists on the projection's
// *client-visible view* schema and not on its *state* schema (see
// `dsh-api-session-controller/lib/types/model-selection-projection.js`:
// state = `{ lastUsed, pending }`, view = `{ lastUsed, next }`). `stateOf()`
// returns the state, so `.next` was `undefined` on every composition: the
// composer branch was dead, the settings route quietly won, and the reported
// "polish does not follow the input box" bug was still there. Assert the exact
// expression, and assert the wrong one is gone.
check(
  'the Host reads the state fields the projection actually publishes',
  /const next = state\?\.pending \?\? state\?\.lastUsed/.test(assistServiceSource) &&
    !/const next = state\?\.next/.test(assistServiceSource)
)
check(
  'the projection is read as an optional service, never injected',
  /stateOf\(session, 'modelSelection'\)/.test(assistServiceSource) &&
    !/static inject = \[[^\]]*sessionProjections/.test(assistServiceSource)
)
check(
  'the effort never follows the composer, on the Host either',
  /reasoningEffort: route\.reasoningEffort/.test(assistServiceSource)
)

// --- 6b. the resolver the buttons and the follow row share -------------------
// `src/client/assist-route.ts` is the single decision point on the browser side:
// the ✨ button, the microphone button and the settings page's follow row all go
// through it, which is what makes "what the row shows" and "what the assist
// calls" the same answer. It is a pure function over an injected Remote call, so
// every branch is driven here with a stub instead of being trusted to a comment.
const hosted = (answer: { provider: string; model: string; reasoningEffort: string; source: 'composer' | 'settings' | 'none' }) =>
  async () => ({ ok: true as const, value: answer })
const rejected = async () => {
  throw new Error('remote unavailable')
}
const refused = async () => ({ ok: false as const, error: { message: 'nope' } })
const followSettings: BetterInputSettings = {
  ...DEFAULT_SETTINGS,
  polishFollowInputModel: true,
  polishProvider: 'settings-provider',
  polishModel: 'settings-model',
  polishReasoningEffort: 'low'
}
const composerPick = { provider: 'composer-provider', model: 'composer-model' }
const remoteOf = (call: () => Promise<unknown>) => ({ resolveAssistRoute: call as never })

const fromHost = await resolveAssistRoute(
  remoteOf(hosted({ provider: 'host-provider', model: 'host-model', reasoningEffort: 'high', source: 'composer' })),
  followSettings,
  'polish',
  'session-1',
  composerPick
)
check(
  'a Host answer is what the assist calls, effort included',
  fromHost?.route.provider === 'host-provider' && fromHost.route.model === 'host-model' &&
    fromHost.route.reasoningEffort === 'high' && fromHost.source === 'composer',
  JSON.stringify(fromHost)
)
// The `sqs.3` regression: the Host answers "no route" (follow on, selection
// unreadable) while the browser can still read one. Skipping the assist there
// silently drops polishing on a perfectly usable model.
const hostEmpty = await resolveAssistRoute(
  remoteOf(hosted({ provider: '', model: '', reasoningEffort: 'low', source: 'none' })),
  followSettings,
  'polish',
  'session-1',
  composerPick
)
check(
  'an empty Host answer falls back to the composer the browser can read',
  hostEmpty?.route.provider === 'composer-provider' && hostEmpty.route.model === 'composer-model' &&
    hostEmpty.route.reasoningEffort === 'low' && hostEmpty.source === 'composer',
  JSON.stringify(hostEmpty)
)
for (const [label, call] of [['rejects', rejected], ['refuses', refused]] as const) {
  const degraded = await resolveAssistRoute(remoteOf(call), followSettings, 'polish', 'session-1', composerPick)
  check(
    `a Host call that ${label} degrades to the readable composer instead of dropping the assist`,
    degraded?.route.provider === 'composer-provider' && degraded.source === 'composer',
    JSON.stringify(degraded)
  )
}
const hostFellBack = await resolveAssistRoute(
  remoteOf(hosted({ provider: 'settings-provider', model: 'settings-model', reasoningEffort: 'low', source: 'settings' })),
  followSettings,
  'polish',
  'session-1',
  composerPick
)
check(
  'a Host answer that fell back is reported as a fallback, not as a follow',
  hostFellBack?.source === 'settings' && hostFellBack.route.provider === 'settings-provider',
  `${hostFellBack?.source}`
)
const nothingAnywhere = await resolveAssistRoute(
  remoteOf(hosted({ provider: '', model: '', reasoningEffort: '', source: 'none' })),
  { ...followSettings, polishProvider: '', polishModel: '' },
  'polish',
  'session-1',
  null
)
check('nothing on either side yields null instead of an uncallable route', nothingAnywhere === null)
let optOutCalls = 0
const optedOut = await resolveAssistRoute(
  remoteOf(async () => {
    optOutCalls += 1
    return { ok: true as const, value: { provider: '', model: '', reasoningEffort: '', source: 'none' as const } }
  }),
  { ...followSettings, polishFollowInputModel: false },
  'polish',
  'session-1',
  composerPick
)
check(
  'with the follow off the configured route wins and no request is made',
  optedOut?.route.provider === 'settings-provider' && optedOut.source === 'settings' && optOutCalls === 0,
  `source=${optedOut?.source} calls=${optOutCalls}`
)
const optimizeSide = await resolveAssistRoute(
  remoteOf(hosted({ provider: '', model: '', reasoningEffort: '', source: 'none' })),
  { ...DEFAULT_SETTINGS, optimizeFollowInputModel: false, optimizeProvider: 'o-p', optimizeModel: 'o-m', optimizeReasoningEffort: 'medium' },
  'optimize',
  '',
  null
)
check(
  'the feature selects its own settings, not polish’s',
  optimizeSide?.route.provider === 'o-p' && optimizeSide.route.model === 'o-m' && optimizeSide.route.reasoningEffort === 'medium',
  JSON.stringify(optimizeSide)
)
// The module is dead code unless both assists and the settings row use it: the
// follow row and the call must be the same function, or the row can name a
// model the call does not use (the whole point of the check above).
const clientSources = {
  microphone: readFileSync(new URL('../src/client/MicrophoneButton.tsx', import.meta.url), 'utf8'),
  optimize: readFileSync(new URL('../src/client/OptimizeButton.tsx', import.meta.url), 'utf8'),
  settings: readFileSync(new URL('../src/client/settings.tsx', import.meta.url), 'utf8')
}
check(
  'the settings follow row renders the Host-resolved route, not the snapshot alone',
  /FollowModelRow/.test(clientSources.settings) &&
    /assistRoutes\.polish/.test(clientSources.settings) &&
    /assistRoutes\.optimize/.test(clientSources.settings)
)
check(
  'neither button resolves the route by itself any more',
  /resolveAssistRoute\(remote, current, 'polish'/.test(clientSources.microphone) &&
    /resolveAssistRoute\(\s*remote,\s*settings,\s*'optimize'/.test(clientSources.optimize)
)

// The wire type must be declared in all four places, or the boundary rejects it.
const contractSource = readFileSync(new URL('../src/remote-contract.ts', import.meta.url), 'utf8')
const hostManifestSource = readFileSync(new URL('../src/typert.ts', import.meta.url), 'utf8')
const clientManifestSource = readFileSync(new URL('../src/remote.ts', import.meta.url), 'utf8')
check(
  'the new RPC exists in the contract, both manifests and the service',
  /assistRouteViewSchema/.test(contractSource) &&
    /betterInput\/resolveAssistRoute/.test(hostManifestSource) &&
    /betterInput\/resolveAssistRoute/.test(clientManifestSource)
)
check(
  'the host manifest declares the service member, not just the invocation',
  /name: 'resolveAssistRoute'/.test(hostManifestSource)
)
// Every type a declaration *names* must itself be declared: the loader only
// checks that `name`/`declaration` are non-empty strings, so a dangling
// reference (the manifest used `ComposerModelRoute` with no entry for it) is
// invisible until someone reads the registry and cannot find the type.
const declaredTypeNames = new Set(
  [...hostManifestSource.matchAll(/\{ name: '([A-Za-z0-9_]+)', declaration:/g)].map((match) => match[1] ?? '')
)
const dangling = new Set<string>()
for (const match of hostManifestSource.matchAll(/\{ name: '([A-Za-z0-9_]+)', declaration: '([^']*)'/g)) {
  const own = match[1] ?? ''
  for (const inner of (match[2] ?? '').matchAll(/\b([A-Z][A-Za-z0-9_]+)\b/g)) {
    const name = inner[1] ?? ''
    // `Partial` / `Readonly` are lib helpers, and a declaration naming itself is
    // not a reference to resolve.
    if (name === own || name === 'Partial' || name === 'Readonly') continue
    if (!declaredTypeNames.has(name)) dangling.add(name)
  }
}
check(
  'the manifest declares every type its declarations reference',
  dangling.size === 0,
  dangling.size === 0 ? `${declaredTypeNames.size} types` : `undeclared: ${[...dangling].join(', ')}`
)

if (failures.length > 0) {
  console.error(`\n${failures.length} input route check(s) failed — a setting would silently revert (or be stripped at the wire boundary), an assist would stop following the composer model or lose its Session stamp, the follow row could confirm a follow that did not happen, first-launch auto-fill would pin the official provider, a capture failure would be misdiagnosed or leak the microphone, the plugin's documents would land outside dsh's home or leave stray staging files behind, or reading the composer's model would re-create dsh's model directory and freeze the model switch.`)
  process.exit(1)
}
console.log('\nOK  settings round-trip and wire boundary, atomic document writes, composer-model route resolution, the shared assist resolver, assist Session stamping, first-launch auto-fill, dsh home resolution, capture-failure classification and device release, the native voice-input seat and the composer-model directory lifetime')
