#!/usr/bin/env node
/**
 * Guard for this plugin's `peerDependencies` against the dsh runtime.
 *
 * Why this exists — the failure mode is worse than the Typert one. dsh rejects
 * a plugin whose declared `@deepseek-ai/dsh*` peer ranges do not admit the
 * running runtime version, and it does so *silently from the user's point of
 * view*: `dsh-app-boot`'s compatibility preflight demotes the whole bundle, and
 * the only trace is one line on the launcher's stderr
 *
 *     dsh: skipping profile bundle "sqs-dsh-better-input": Error: Plugin
 *     sqs-dsh-better-input@0.1.0 is incompatible with dsh 0.2.0-rc.2:
 *     peerDependencies {"…":">=0.1.7-rc.2 <0.2.0-0", …}.
 *
 * On the 0.1.7-rc.2 → 0.2.0-rc.2 upgrade this is exactly what happened: the
 * shipped 0.1.0 declared `>=0.1.7-rc.2 <0.2.0-0`, and `0.2.0-rc.2` is NOT
 * `< 0.2.0-0` (that range excludes every prerelease of 0.2.0). The plugin was
 * composed nowhere, so the Host service, the slots, and the settings page all
 * simply did not exist — while `npm run build`, `npm run check`,
 * `check-client-bundle` and `check:typert` all still passed.
 *
 * Two things are asserted, because the trap has both a range half and a
 * bookkeeping half:
 *
 *   1. Every declared `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer range must
 *      admit the target runtime version, with prereleases participating exactly
 *      as dsh evaluates them (`includePrerelease: true`).
 *   2. The peer list must match what `src/` actually imports: every
 *      `@deepseek-ai/*` module imported by the source needs a peer entry, and
 *      every `@deepseek-ai/dsh-*` peer entry needs an importing source file.
 *      An unused peer is not harmless — it is one more range that can demote
 *      the bundle on a future runtime.
 *
 * dsh's own `evaluatePluginCompatibility` is used as the authoritative check
 * when it is resolvable (it is the function the launcher actually calls); the
 * mirror below only keeps this script useful outside a dsh install.
 *
 * Usage:
 *   node scripts/check-dsh-peers.mjs
 *   DSH_APP_BOOT=/path/to/@deepseek-ai/dsh-app-boot/lib/index.js node scripts/check-dsh-peers.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const failures = []
const pass = (m, d = '') => console.log(`PASS  ${m}${d ? `  [${d}]` : ''}`)
const fail = (m, d = '') => { failures.push(m); console.log(`FAIL  ${m}${d ? `  [${d}]` : ''}`) }

const peers = pkg.peerDependencies ?? {}
const devDeps = pkg.devDependencies ?? {}

// --- 1. resolve the target runtime version ---------------------------------
// The dev-pinned `@deepseek-ai/dsh-*` packages ARE the runtime this tree is
// built and verified against, so they define the version the ranges must admit.
const scopedDir = join(root, 'node_modules', '@deepseek-ai')
if (!existsSync(scopedDir)) {
  console.error(`[check-dsh-peers] FAIL  ${scopedDir} not found — run \`npm install\` first.`)
  process.exit(1)
}

const installedDshVersions = new Map()
for (const name of readdirSync(scopedDir)) {
  if (name !== 'dsh' && !name.startsWith('dsh-')) continue
  const manifest = join(scopedDir, name, 'package.json')
  if (!existsSync(manifest)) continue
  installedDshVersions.set(`@deepseek-ai/${name}`, JSON.parse(readFileSync(manifest, 'utf8')).version)
}
if (installedDshVersions.size === 0) {
  console.error('[check-dsh-peers] FAIL  no @deepseek-ai/dsh* package is installed as a dev dependency.')
  process.exit(1)
}

const distinct = [...new Set(installedDshVersions.values())]
if (distinct.length === 1) {
  pass('the pinned @deepseek-ai/dsh* dev packages agree on one runtime version', distinct[0])
} else {
  fail('the pinned @deepseek-ai/dsh* dev packages agree on one runtime version',
    [...installedDshVersions].map(([n, v]) => `${n}@${v}`).join(', '))
}
const targetVersion = distinct[0]

// --- 2. resolve dsh's own compatibility evaluator (authoritative) ----------
const candidates = [
  process.env.DSH_APP_BOOT,
  (() => {
    // Derive the installation root from the `dsh` binary on PATH so the real
    // runtime is found even though app-boot is not one of our dependencies.
    const bin = (process.env.PATH ?? '').split(':').map((dir) => join(dir, 'dsh')).find((p) => existsSync(p))
    if (bin === undefined) return undefined
    try {
      const real = statSync(bin).isSymbolicLink() ? resolve(dirname(bin), readFileSync(bin, 'utf8').trim()) : bin
      return join(dirname(dirname(real)), 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js')
    } catch { return undefined }
  })(),
  '/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js'
].filter((value) => typeof value === 'string' && value.length > 0)

let authoritative
for (const candidate of candidates) {
  if (!existsSync(candidate)) continue
  try {
    const mod = await import(pathToFileURL(candidate).href)
    if (typeof mod.evaluatePluginCompatibility === 'function' && typeof mod.getDshRuntimeVersion === 'function') {
      authoritative = mod
      break
    }
  } catch {
    // keep looking; the mirror below still runs
  }
}

if (authoritative === undefined) {
  console.log('check-dsh-peers: dsh-app-boot not resolvable — using the built-in mirror (set DSH_APP_BOOT to cross-check)')
} else {
  const installed = authoritative.getDshRuntimeVersion()
  console.log(`check-dsh-peers: authoritative evaluator for dsh ${installed}`)
  // The machine's runtime is what actually demoted the bundle, so disagreeing
  // with the pinned dev version is a warning, not a failure: a checkout may
  // legitimately be developed against next while an older dsh runs locally.
  if (installed !== targetVersion) {
    console.log(`WARN  the local dsh runtime (${installed}) differs from the pinned dev target (${targetVersion})`)
  }
  const issue = authoritative.evaluatePluginCompatibility(pkg, {}, targetVersion)
  if (issue === undefined) pass('dsh says every declared peer range admits the target runtime', targetVersion)
  else fail('dsh says every declared peer range admits the target runtime', JSON.stringify(issue.peers))
}

// --- 3. mirror the range evaluation (works without a dsh install) ----------
// Mirrors `semver.satisfies(version, range, { includePrerelease: true })`, which
// is what `evaluatePluginCompatibility` calls. Implemented locally so this guard
// carries no runtime dependency beyond Node itself.
function parse(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim())
  if (match === null) return null
  return { major: +match[1], minor: +match[2], patch: +match[3], prerelease: match[4] === undefined ? [] : match[4].split('.') }
}

/** Standard semver precedence: -1, 0 (equal), or 1. */
function compare(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i += 1) {
    const x = a.prerelease[i]
    const y = b.prerelease[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x) ? +x : null
    const yn = /^\d+$/.test(y) ? +y : null
    if (xn !== null && yn !== null) { if (xn !== yn) return xn < yn ? -1 : 1; continue }
    if (xn !== null) return -1
    if (yn !== null) return 1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}

/**
 * A single comparator (`>=1.2.3`, `<2.0.0-0`, …). `includePrerelease` is
 * approximated the way semver does for the comparator forms this plugin uses:
 * a comparator whose version carries a prerelease still admits the compared
 * prerelease, and an upper bound spelled `-0` excludes the prereleases of that
 * same version.
 */
function comparatorSatisfies(version, operator, bound) {
  const order = compare(version, bound)
  switch (operator) {
    case '': case '=': case '==': return order === 0
    case '>=': return order === 0 || order === 1
    case '>': return order === 1
    case '<=': return order === 0 || order === -1
    case '<': return order === -1
    default: return false
  }
}

function rangeSatisfies(version, range) {
  for (const alternative of range.split('||')) {
    const comparators = alternative.trim().split(/\s+/).filter((part) => part !== '')
    if (comparators.length === 0) continue
    let ok = true
    for (const comparator of comparators) {
      const match = /^(>=|<=|>|<|=|==)?\s*(.+)$/.exec(comparator)
      if (match === null) { ok = false; break }
      const bound = parse(match[2])
      if (bound === null || version === null) { ok = false; break }
      if (!comparatorSatisfies(version, match[1] ?? '', bound)) { ok = false; break }
    }
    if (ok) return true
  }
  return false
}

// `^0.2.0-rc.2` and `~0.2.0-rc.2` are declarative sugar; expand them the way
// semver does so the mirror accepts the shorthand too.
function expand(range) {
  return range.trim().replace(/(\^|~)\s*([^\s|]+)/g, (_all, operator, version) => {
    const v = parse(version)
    if (v === null) return range
    const core = `${v.major}.${v.minor}.${v.patch}`
    const base = v.prerelease.length === 0 ? core : `${core}-${v.prerelease.join('.')}`
    const lower = `>=${base}`
    if (operator === '~') return `${lower} <${v.major}.${v.minor + 1}.0-0`
    if (v.major > 0) return `${lower} <${v.major + 1}.0.0-0`
    // 0.x: the caret only allows patch and (for 0.0.x) nothing at all.
    if (v.minor > 0) return `${lower} <${v.major}.${v.minor + 1}.0-0`
    return `${lower} <${v.major}.${v.minor}.${v.patch + 1}-0`
  })
}

const target = parse(targetVersion)
const dshPeers = Object.entries(peers).filter(([name]) => name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-'))
if (dshPeers.length === 0) fail('the manifest declares at least one @deepseek-ai/dsh* peer')
for (const [name, range] of dshPeers) {
  if (rangeSatisfies(target, expand(range))) {
    pass(`peer range admits the runtime`, `${name} ${range} ⊇ ${targetVersion}`)
  } else {
    fail(`peer range admits the runtime`, `${name} ${range} excludes ${targetVersion} — dsh would SKIP this bundle`)
  }
}

// --- 4. peers must match what src/ actually imports ------------------------
function walkFiles(dir, pattern) {
  const out = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(full, pattern))
    else if (pattern.test(entry.name)) out.push(full)
  }
  return out
}
const sourceFiles = (dir) => walkFiles(dir, /\.(ts|tsx|mts|cts|js|mjs|cjs)$/)

const IMPORT_RE = /(?:^|[^\w$.])(import|export)\s+([^;]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|[^\w$.])import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[^\w$.])import\s+['"]([^'"]+)['"]/g

/** `@scope/pkg/sub/path` → `@scope/pkg`; `./rel` → undefined. */
function packageOf(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('node:')) return undefined
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * Whether an `import`/`export` clause names only types.
 *
 * Type-only imports and exports are erased by the compiler and are absent from
 * the emitted `lib/`, so they cannot make the Host fail at runtime and must NOT
 * force a peer entry: every peer is an extra range that can demote the whole
 * bundle when a future dsh moves that package. They still have to be installed
 * for the build, which is what the dev-dependency check below enforces.
 *
 * Value imports are the opposite case and still require a peer.
 */
function isTypeOnlyClause(clause) {
  if (/^\s*type\s/.test(clause)) return true
  const named = clause.match(/^\s*\{([\s\S]*)\}\s*$/)
  if (named === null) return false
  const specifiers = named[1].split(',').map((part) => part.trim()).filter((part) => part !== '')
  return specifiers.length > 0 && specifiers.every((part) => /^type\s/.test(part))
}

/**
 * Every `@deepseek-ai/*` package named by one file, split by how it is reached.
 *
 * @returns `{ value, typeOnly }` — value imports need a peer entry, type-only
 *   imports need an installed (dev) dependency.
 */
function referencedPackages(file) {
  const value = new Set()
  const typeOnly = new Set()
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(IMPORT_RE)) {
    const name = packageOf(match[3] ?? match[4] ?? match[5])
    if (name === undefined || !name.startsWith('@deepseek-ai/')) continue
    // Only the `… from '…'` form can be type-only; dynamic and side-effect
    // imports are always runtime imports.
    if (match[3] !== undefined && isTypeOnlyClause(match[2])) typeOnly.add(name)
    else value.add(name)
  }
  return { value, typeOnly }
}

const imported = new Map()
const importedTypes = new Map()
for (const file of sourceFiles(join(root, 'src'))) {
  const relative = file.slice(root.length + 1)
  const found = referencedPackages(file)
  for (const name of found.value) {
    if (!imported.has(name)) imported.set(name, new Set())
    imported.get(name).add(relative)
  }
  for (const name of found.typeOnly) {
    if (!importedTypes.has(name)) importedTypes.set(name, new Set())
    importedTypes.get(name).add(relative)
  }
}

const declared = new Set(Object.keys(peers))
const missingPeers = [...imported.keys()].filter((name) => !declared.has(name)).sort()
if (missingPeers.length === 0) {
  pass('every @deepseek-ai/* value import in src/ has a peer entry', `${imported.size} package(s)`)
} else {
  fail('every @deepseek-ai/* value import in src/ has a peer entry', missingPeers.join(', '))
}

// A type-only import still has to be installed for `tsc` to see its
// declarations; a peer entry also satisfies that, but is not required.
const declaredAnywhere = new Set([
  ...declared,
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(devDeps)
])
const missingDevDeps = [...importedTypes.keys()].filter((name) => !declaredAnywhere.has(name)).sort()
if (missingDevDeps.length === 0) {
  pass('every @deepseek-ai/* type-only import in src/ is installed for the build', `${importedTypes.size} package(s)`)
} else {
  fail('every @deepseek-ai/* type-only import in src/ is installed for the build',
    `${missingDevDeps.join(', ')} — add it (pinned to the runtime) to devDependencies`)
}
for (const name of importedTypes.keys()) {
  if (declared.has(name)) continue
  const pinned = devDeps[name]
  if (pinned !== targetVersion) {
    fail('every @deepseek-ai/* type-only dev package is pinned to the target runtime', `${name}@${pinned ?? 'missing'}`)
  } else {
    pass('type-only dev dependency is pinned to the target runtime', `${name}@${pinned}`)
  }
}

// A peer can be justified without a direct `src/` import: a peer we DO import
// may name packages in its own `.d.ts` that we must typecheck against.
// `@deepseek-ai/dsh-client-store` is exactly that case — `dsh-client-ui-slots`
// re-exports its `SnapshotSelectorHook` while declaring it nowhere, so our
// `useInput((state) => …)` callbacks only stay typed while that package is
// installed. The check is deliberately one level deep (the direct peers' type
// files), because the full transitive graph reaches most of the dsh ecosystem
// and is satisfied by the host runtime, not by this plugin's node_modules.
const peerTypeRefs = new Set()
// Value AND type-only imports count here: the question is which peers we
// typecheck against, not how the import is written in our own source.
for (const name of [...imported.keys(), ...importedTypes.keys()]) {
  for (const file of walkFiles(join(scopedDir, name.slice('@deepseek-ai/'.length)), /\.d\.(ts|mts|cts)$/)) {
    const refs = referencedPackages(file)
    for (const ref of [...refs.value, ...refs.typeOnly]) peerTypeRefs.add(ref)
  }
}

// A declared peer is justified when we import it for values OR for types: both
// mean we typecheck against it, which is the same reasoning as `peerTypeRefs`.
const unusedPeers = Object.keys(peers)
  .filter((name) => name.startsWith('@deepseek-ai/') && !imported.has(name) && !importedTypes.has(name) && !peerTypeRefs.has(name))
  .sort()
if (unusedPeers.length === 0) {
  pass('every @deepseek-ai/* peer entry is reachable from src/ or from a peer’s types')
} else {
  fail('every @deepseek-ai/* peer entry is reachable from src/ or from a peer’s types',
    `${unusedPeers.join(', ')} — an unused peer is one more range that can demote this bundle`)
}

// --- 5. the pinned dev version must not drift from the peer floor ----------
for (const [name, range] of dshPeers) {
  const pinned = devDeps[name]
  if (pinned === undefined) {
    fail('every @deepseek-ai/dsh* peer is also a pinned dev dependency', name)
    continue
  }
  if (pinned !== targetVersion) {
    fail('every @deepseek-ai/dsh* dev dependency is pinned to the target runtime', `${name}@${pinned}`)
  } else {
    pass('dev dependency is pinned to the target runtime', `${name}@${pinned}`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} peer check(s) failed — dsh would silently drop this plugin from the profile.`)
  process.exit(1)
}

console.log(`\nOK  target runtime ${targetVersion}, dsh peers ${dshPeers.length}, imported @deepseek-ai packages ${imported.size}`)
