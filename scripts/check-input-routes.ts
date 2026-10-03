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
  resolveInputModelRoute,
  type BetterInputSettings
} from '../src/config.js'
import { normalizeSettings } from '../src/settings/store.js'
import { toCaptureError } from '../src/client/audio-capture.js'
import { readFileSync } from 'node:fs'

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

if (failures.length > 0) {
  console.error(`\n${failures.length} input route check(s) failed — a setting would silently revert, an assist would stop following the composer model, a capture failure would be misdiagnosed, or dsh's own microphone would reappear beside this plugin's.`)
  process.exit(1)
}
console.log('\nOK  settings round-trip, composer-model route resolution, capture-failure classification and the native voice-input seat')
