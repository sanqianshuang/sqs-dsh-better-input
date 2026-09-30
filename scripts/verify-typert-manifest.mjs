#!/usr/bin/env node
/**
 * Guard for the Host-face Typert manifest (`./typert` → `lib/typert.js`).
 *
 * Why this exists: dsh 0.1.7 tightened the Typert boundary, and the loader's
 * `validateTypertManifest` treats several manifest members as *required*.
 * Dropping one (0.1.0-0.1.2 lost the whole `model` block while removing the
 * file-input/OCR feature) does NOT fail the build or the type check — it fails
 * only at dsh boot, as
 *
 *     dsh: warning: 1 entry did not activate
 *     typert-loader: sqs-dsh-better-input TYPERT.model must be an object
 *
 * and the browser web boot then refuses to render the UI at all.
 *
 * The assertions below mirror `@deepseek-ai/dsh-typert-loader/lib/index.js`
 * (byte-identical in 0.1.7-rc.2 and 0.2.0-rc.2). When that loader is resolvable,
 * it is imported and run as the authoritative check — the mirror exists only so
 * this script also works outside a dsh install.
 *
 * Usage:
 *   node scripts/verify-typert-manifest.mjs [path/to/typert.js]
 *   DSH_TYPERT_LOADER=/path/to/dsh-typert-loader/lib/index.js node scripts/verify-typert-manifest.mjs
 */

import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const target = resolve(here, '..', process.argv[2] ?? 'lib/typert.js')

const MEMBER_KINDS = new Set(['property', 'method', 'getter', 'setter', 'call', 'construct', 'index'])

// --- mirror of dsh-typert-loader/lib/index.js ---------------------------------
const fail = (message) => {
  throw new Error(message)
}
const requireObject = (pkg, value, subject) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`typert-loader: ${pkg} ${subject} must be an object`)
  return value
}
const requireArray = (pkg, value, subject) => {
  if (!Array.isArray(value)) fail(`typert-loader: ${pkg} ${subject} must be an array`)
  return value
}
const requireString = (pkg, value, key, subject) => {
  if (typeof value[key] !== 'string' || value[key].length === 0) fail(`typert-loader: ${pkg} ${subject} has a missing or empty ${key}`)
}
const requireDocumentation = (pkg, value, subject) => {
  requireArray(pkg, value.tags, `${subject}.tags`)
  for (const key of ['description', 'summary', 'jsDoc']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') fail(`typert-loader: ${pkg} ${subject}.${key} must be a string`)
  }
}
const requireMembers = (pkg, value, subject) => {
  for (const item of requireArray(pkg, value, `${subject}.members`)) {
    const member = requireObject(pkg, item, `${subject} member`)
    requireString(pkg, member, 'name', `${subject} member`)
    requireString(pkg, member, 'signature', `${subject} member`)
    if (typeof member.kind !== 'string' || !MEMBER_KINDS.has(member.kind)) fail(`typert-loader: ${pkg} ${subject} member "${member.name}" has invalid kind`)
  }
}
const requireTypes = (pkg, value, subject) => {
  for (const item of requireArray(pkg, value, `${subject}.types`)) {
    const type = requireObject(pkg, item, `${subject} type`)
    requireString(pkg, type, 'name', `${subject} type`)
    requireString(pkg, type, 'declaration', `${subject} type`)
  }
}
const requireStrictCodec = (pkg, value, subject) => {
  const codec = requireObject(pkg, value, subject)
  if (codec.mode !== 'strict') fail(`typert-loader: ${pkg} ${subject} must use a strict codec`)
  requireString(pkg, codec, 'typeSymbol', subject)
  for (const method of ['decode', 'encode']) {
    if (codec[method] !== undefined && typeof codec[method] !== 'function') fail(`typert-loader: ${pkg} ${subject} ${method} must be a function`)
  }
  if (typeof codec.create !== 'function') fail(`typert-loader: ${pkg} ${subject} has no create() factory`)
}
const requireInvocation = (pkg, value) => {
  const invocation = requireObject(pkg, value, 'invocation')
  for (const key of ['id', 'service', 'namespace', 'method']) requireString(pkg, invocation, key, 'invocation')
  const id = invocation.id
  const receiver = requireObject(pkg, invocation.invocation, `invocation "${id}" receiver`)
  if (!(receiver.kind === 'context' || receiver.kind === 'direct')) fail(`typert-loader: ${pkg} invocation "${id}" receiver kind must be "direct" or "context"`)
  if (receiver.kind === 'context') {
    requireString(pkg, receiver, 'context', `invocation "${id}" Context receiver`)
    requireString(pkg, receiver, 'wire', `invocation "${id}" Context receiver`)
    requireStrictCodec(pkg, receiver.codec, `invocation "${id}" Context codec`)
  }
  const wires = new Set()
  let lookupCount = 0
  for (const item of requireArray(pkg, invocation.parameters, `invocation "${id}" parameters`)) {
    const parameter = requireObject(pkg, item, `invocation "${id}" parameter`)
    requireString(pkg, parameter, 'name', `invocation "${id}" parameter`)
    requireString(pkg, parameter, 'wire', `invocation "${id}" parameter`)
    if (wires.has(parameter.wire)) fail(`typert-loader: ${pkg} invocation "${id}" repeats wire field "${parameter.wire}"`)
    wires.add(parameter.wire)
    if (parameter.source === 'lookup') {
      lookupCount += 1
      requireString(pkg, parameter, 'lookup', `invocation "${id}" lookup parameter`)
    } else if (parameter.source === 'json') {
      if (parameter.lookup !== undefined) fail(`typert-loader: ${pkg} invocation "${id}" JSON parameter declares a lookup`)
    } else {
      fail(`typert-loader: ${pkg} invocation "${id}" parameter source must be "json" or "lookup"`)
    }
    requireStrictCodec(pkg, parameter.codec, `invocation "${id}" parameter codec`)
  }
  if (invocation.cancellation !== undefined) {
    if (requireObject(pkg, invocation.cancellation, `invocation "${id}" cancellation`).parameter !== 'signal') fail(`typert-loader: ${pkg} invocation "${id}" cancellation parameter must be "signal"`)
  }
  if (invocation.scope !== undefined) fail(`typert-loader: ${pkg} invocation "${id}" scope is not covered by this mirror; run against the real loader`)
  if (receiver.kind === 'context' && wires.has(receiver.wire)) fail(`typert-loader: ${pkg} invocation "${id}" repeats Context wire field "${receiver.wire}"`)
  requireStrictCodec(pkg, invocation.result, `invocation "${id}" result codec`)
}
const validateTypertManifest = (pkgName, exported) => {
  if (typeof exported !== 'object' || exported === null) fail(`typert-loader: ${pkgName} exports "./typert" but its module has no TYPERT manifest object`)
  const manifest = exported
  if (manifest.package !== pkgName) fail(`typert-loader: ${pkgName} TYPERT manifest names package ${JSON.stringify(manifest.package)} — the manifest must be owned by the package that exports it`)
  if (manifest.face !== 'host') fail(`typert-loader: ${pkgName} exports "./typert" but TYPERT.face is not "host"`)
  requireArray(pkgName, manifest.schemas, 'TYPERT.schemas')
  for (const value of manifest.schemas) {
    const schema = requireObject(pkgName, value, 'schema')
    requireString(pkgName, schema, 'name', 'schema')
    if (typeof schema.create !== 'function') fail(`typert-loader: ${pkgName} TYPERT schema "${schema.name}" has no create() factory`)
  }
  const model = requireObject(pkgName, manifest.model, 'TYPERT.model')
  const services = requireArray(pkgName, model.services, 'TYPERT.model.services')
  const events = requireArray(pkgName, model.events, 'TYPERT.model.events')
  const objects = requireArray(pkgName, model.objects, 'TYPERT.model.objects')
  for (const value of services) {
    const service = requireObject(pkgName, value, 'service')
    requireDocumentation(pkgName, service, 'service')
    requireString(pkgName, service, 'key', 'service')
    requireString(pkgName, service, 'exportName', 'service')
    requireMembers(pkgName, service.members, `service "${service.key}"`)
    requireTypes(pkgName, service.types, `service "${service.key}"`)
  }
  for (const value of events) {
    const event = requireObject(pkgName, value, 'event')
    requireDocumentation(pkgName, event, 'event')
    requireString(pkgName, event, 'name', 'event')
    requireString(pkgName, event, 'signature', `event "${event.name}"`)
    if (event.mode !== undefined && typeof event.mode !== 'string') fail(`typert-loader: ${pkgName} event "${event.name}" mode must be a string`)
  }
  for (const value of objects) {
    const object = requireObject(pkgName, value, 'object')
    requireDocumentation(pkgName, object, 'object')
    requireString(pkgName, object, 'name', 'object')
    requireString(pkgName, object, 'exportName', 'object')
    requireMembers(pkgName, object.members, `object "${object.name}"`)
    requireTypes(pkgName, object.types, `object "${object.name}"`)
  }
  for (const value of requireArray(pkgName, manifest.invocations, 'TYPERT.invocations')) requireInvocation(pkgName, value)
  return manifest
}
// -----------------------------------------------------------------------------

const candidates = [
  process.env.DSH_TYPERT_LOADER,
  '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-typert-loader/lib/index.js'
].filter((value) => typeof value === 'string' && value.length > 0)

let authoritative
for (const candidate of candidates) {
  if (!existsSync(candidate)) continue
  try {
    const mod = await import(pathToFileURL(candidate).href)
    if (typeof mod.validateTypertManifest === 'function') {
      authoritative = { path: candidate, validate: mod.validateTypertManifest }
      break
    }
  } catch {
    // keep looking; the mirror still runs below
  }
}

console.log(`verify-typert-manifest: target ${target}`)
if (authoritative === undefined) {
  console.log('verify-typert-manifest: dsh loader not resolvable — using the built-in mirror (set DSH_TYPERT_LOADER to cross-check)')
} else {
  console.log(`verify-typert-manifest: authoritative validator ${authoritative.path}`)
}

let manifest
try {
  manifest = (await import(pathToFileURL(target).href)).TYPERT
} catch (error) {
  console.error(`FAIL  could not import the manifest: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

const pkgName = typeof manifest?.package === 'string' ? manifest.package : 'sqs-dsh-better-input'
const failures = []
for (const [label, validate] of [
  ['mirror', validateTypertManifest],
  ...(authoritative === undefined ? [] : [['authoritative', authoritative.validate]])
]) {
  try {
    validate(pkgName, manifest)
    console.log(`PASS  ${label}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`${label}: ${message}`)
    console.log(`FAIL  ${label}: ${message}`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} typert manifest check(s) failed — dsh would refuse to activate this entry.`)
  process.exit(1)
}

console.log(
  `\nOK  schemas=${manifest.schemas.length} invocations=${manifest.invocations.length}` +
    ` services=${manifest.model.services.length} events=${manifest.model.events.length} objects=${manifest.model.objects.length}`
)
