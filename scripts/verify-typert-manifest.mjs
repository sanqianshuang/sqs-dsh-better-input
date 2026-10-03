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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

// --- implementation parity: TYPERT ↔ the real service classes ------------------
//
// The validator above checks the manifest's *shape*. That is not enough: for a
// `{ kind: 'direct' }` invocation the gateway resolves
//
//     const implementation = descriptor.implementation ?? descriptor.method
//     const method = Reflect.get(callReceiver, implementation)
//
// against the live service instance (`@deepseek-ai/dsh-api-gateway/lib/index.js`,
// "gateway/method-unavailable"). A method that exists in `TYPERT` — and in
// `TYPERT.model.services[].members` — but never on the class passes every schema
// check, composes, activates cleanly, and only fails when the user actually
// calls it:
//
//     typert gateway: betterInput/templatesList: active Service
//     "BetterInputPolish" has no callable method "templatesList"
//
// That is exactly how the template library shipped broken in 0.2.0-rc.2: the
// manifest, the client face, the RPC contract and the browser UI were all
// present, and only the Host methods were missing. `tsc` cannot see it because
// the manifest is a plain object; the loader cannot see it because it never
// calls the method. So the method names are read from the classes themselves.

/** Every non-declaration `.ts` file under a directory, recursively. */
function sourceFiles(root) {
  const found = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) found.push(path)
  }
  return found
}

/**
 * The method names declared directly in `export class <exportName>`.
 *
 * Class members in this repo are indented by exactly two spaces and method
 * bodies by four or more, so an indentation anchor is enough to distinguish a
 * member declaration from a statement inside one — no parser needed, which
 * keeps this guard runnable with no dependencies.
 */
function declaredMethods(source, exportName) {
  const anchor = source.search(new RegExp(`^export\\s+class\\s+${exportName}\\b`, 'm'))
  if (anchor === -1) return undefined
  const close = source.indexOf('\n}', anchor)
  const body = source.slice(anchor, close === -1 ? source.length : close)
  const methods = new Set()
  const member = /^ {2}(?:(?:public|private|protected|static|readonly|async|override|get|set)\s+)*([A-Za-z_$][\w$]*)\s*[(<]/gm
  for (const match of body.matchAll(member)) methods.add(match[1])
  return methods
}

const srcRoot = resolve(here, '..', 'src')

function verifyImplementationParity(manifest) {
  const problems = []
  const sources = sourceFiles(srcRoot).map((path) => ({ path, text: readFileSync(path, 'utf8') }))
  const services = new Map()
  for (const service of manifest.model.services) {
    const file = sources.find((candidate) => declaredMethods(candidate.text, service.exportName) !== undefined)
    services.set(service.key, {
      exportName: service.exportName,
      file: file?.path,
      methods: file === undefined ? undefined : declaredMethods(file.text, service.exportName),
      members: new Set(
        (Array.isArray(service.members) ? service.members : [])
          .filter((member) => member?.kind === 'method')
          .map((member) => member.name)
      )
    })
  }
  for (const invocation of manifest.invocations) {
    // `context` receivers resolve `implementation` elsewhere; only `direct`
    // invocations are bound to the service class.
    if (invocation?.invocation?.kind !== 'direct') continue
    const service = services.get(invocation.service)
    if (service === undefined) {
      problems.push(`invocation "${invocation.id}" names service "${invocation.service}", which TYPERT.model.services does not declare`)
      continue
    }
    if (!service.members.has(invocation.method)) {
      problems.push(`invocation "${invocation.id}" calls ${invocation.service}.${invocation.method}(), but that service's TYPERT.model members do not list it`)
      continue
    }
    if (service.methods === undefined) {
      problems.push(`service ${service.exportName} was not found under src/ — cannot prove ${invocation.service}.${invocation.method}() is implemented`)
      continue
    }
    if (!service.methods.has(invocation.method)) {
      const where = service.file === undefined ? service.exportName : service.file.slice(resolve(here, '..').length + 1)
      problems.push(`invocation "${invocation.id}" calls ${invocation.service}.${invocation.method}(), but ${where} declares no such method — dsh fails the call with gateway/method-unavailable`)
    }
  }
  return problems
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

if (existsSync(srcRoot)) {
  const problems = verifyImplementationParity(manifest)
  if (problems.length === 0) {
    console.log('PASS  implementation parity (TYPERT invocations ↔ src/ service classes)')
  } else {
    for (const problem of problems) {
      failures.push(`implementation: ${problem}`)
      console.log(`FAIL  implementation: ${problem}`)
    }
  }
} else {
  console.log('SKIP  implementation parity: src/ is not present (the npm tarball ships lib/ only)')
}

// --- client face parity: TYPERT_REMOTE ↔ TYPERT -------------------------------
//
// The Host manifest and the browser face are written in two different files
// (`src/typert.ts` / `src/remote.ts`) and dsh only checks each one's shape. A
// parameter added to one side and not the other is not caught by `tsc` (both are
// plain objects) and lands at call time: the browser builds its args object from
// its OWN descriptor, so a missing wire field is rejected by the gateway's
// `assertExactArguments` and an extra one shifts every positional argument — the
// service then reads a string where the AbortSignal belongs. Compare the two
// faces endpoint-for-endpoint: same methods, same wire names, same order, same
// cancellation parameter.
const remoteTarget = resolve(here, '..', 'lib/remote.js')
if (!existsSync(remoteTarget)) {
  console.log('SKIP  client face parity: lib/remote.js is not present (run the build first)')
} else {
  const clientFace = (await import(pathToFileURL(remoteTarget).href)).TYPERT_REMOTE ?? (await import(pathToFileURL(remoteTarget).href)).default
  const problems = []
  const faceOf = (value) => {
    const map = new Map()
    // The Host manifest calls its descriptors `invocations`; the client face
    // calls them `descriptors`. Everything else about the shape is identical.
    const entries = Array.isArray(value?.invocations)
      ? value.invocations
      : Array.isArray(value?.descriptors) ? value.descriptors : []
    for (const descriptor of entries) {
      map.set(descriptor.id, {
        service: descriptor.service,
        namespace: descriptor.namespace,
        method: descriptor.method,
        invocation: descriptor.invocation?.kind,
        wires: (Array.isArray(descriptor.parameters) ? descriptor.parameters : []).map((parameter) => parameter.wire).join(','),
        cancellation: descriptor.cancellation?.parameter ?? null
      })
    }
    return map
  }
  const host = faceOf(manifest)
  const client = faceOf(clientFace)
  for (const [id, hostFace] of host) {
    const clientShape = client.get(id)
    if (clientShape === undefined) {
      problems.push(`${id} is missing from the client face (lib/remote.js TYPERT_REMOTE) — the browser cannot call it`)
      continue
    }
    for (const key of ['service', 'namespace', 'method', 'invocation', 'wires', 'cancellation']) {
      if (hostFace[key] !== clientShape[key]) {
        problems.push(`${id} declares ${key}=${JSON.stringify(hostFace[key])} on the Host but ${JSON.stringify(clientShape[key])} on the client`)
      }
    }
  }
  for (const id of client.keys()) {
    if (!host.has(id)) problems.push(`${id} exists only on the client face — the Host would reject the call as an unknown endpoint`)
  }
  if (problems.length === 0) {
    console.log(`PASS  client face parity (${host.size} endpoints mirror method-for-method)`)
  } else {
    for (const problem of problems) {
      failures.push(`client face: ${problem}`)
      console.log(`FAIL  client face: ${problem}`)
    }
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} typert check(s) failed — dsh would refuse to activate this entry, or fail the call at runtime.`)
  process.exit(1)
}

console.log(
  `\nOK  schemas=${manifest.schemas.length} invocations=${manifest.invocations.length}` +
    ` services=${manifest.model.services.length} events=${manifest.model.events.length} objects=${manifest.model.objects.length}`
)
