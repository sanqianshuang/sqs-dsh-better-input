#!/usr/bin/env node
/**
 * Post-build invariant guard for the browser bundle.
 *
 * Three things must hold after `tsdown` runs, and all three are easy to break
 * by accident because the breakage is silent (the bundle still builds, it just
 * balloons or throws at page load):
 *
 *   1. `lib/client.js` must not contain zod. The client face never validates
 *      wire bytes — only the Host runs `codec.create().parse(...)`. Any zod in
 *      the browser bundle means something in the client graph acquired a VALUE
 *      import of `remote-contract.js` (usually via `remote.ts`).
 *   2. Every `require()` in the bundle must name a specifier the web shell can
 *      actually resolve: a platform seed word, or a row this plugin declares in
 *      `dsh.client.inject`. Anything else throws
 *      `client-modules: require("…") missed the module table` at load.
 *   3. The bundle factory must be exec-able and export the Cordis `apply`/`inject`
 *      pair, under a resolver that mimics the shell's (seeds + declared rows).
 *
 * Run via `npm run check:bundle` (wired into `npm run verify`).
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clientPath = join(root, 'lib', 'client.js')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

if (!existsSync(clientPath)) {
  console.error(`[check-client-bundle] FAIL  ${clientPath} not found — run the build first.`)
  process.exit(1)
}
const src = readFileSync(clientPath, 'utf8')
const failures = []
const pass = (m, d = '') => console.log(`PASS  ${m}${d ? `  [${d}]` : ''}`)
const fail = (m, d = '') => { failures.push(m); console.log(`FAIL  ${m}${d ? `  [${d}]` : ''}`) }

// --- 1. no zod in the browser bundle -------------------------------------
// Strip block/line comments first: the source carries explanatory comments that
// mention zod, and those are not code.
const codeOnly = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

const zodHits = codeOnly.match(/zod|ZodError|_zod/gi) ?? []
if (zodHits.length === 0) pass('client bundle contains no zod code')
else fail('client bundle contains no zod code', `${zodHits.length} occurrence(s): ${[...new Set(zodHits)].join(', ')}`)

// --- 2. every require() resolves in the shell -----------------------------
const SEED_WORDS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit'
])
const declaredRows = new Set(pkg.dsh?.client?.inject ?? [])
const resolvable = (name) => SEED_WORDS.has(name) || declaredRows.has(name)

const requires = [...codeOnly.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1])
const unresolved = [...new Set(requires)].filter((n) => !resolvable(n))
if (unresolved.length === 0) {
  pass('every require() names a shell-resolvable specifier',
    requires.length === 0 ? 'no requires' : [...new Set(requires)].sort().join(', '))
} else {
  fail('every require() names a shell-resolvable specifier', `unresolved: ${unresolved.join(', ')}`)
}

// --- 3. factory executes and exports apply/inject -------------------------
let captured = null
const stub = () => new Proxy(function () {}, {
  get: (_t, p) => (p === '__esModule' ? true : stub()),
  apply: () => stub(),
  has: () => true
})
const requireFn = (name) => {
  if (!resolvable(name)) {
    throw new Error(`client-modules: require("${name}") missed the module table — not a platform seed word, not a materialized module, and no registered package factory`)
  }
  return stub()
}
try {
  vm.runInContext(src, vm.createContext({
    window: { __ModuleLoader__: { load: (m) => { captured = m } } },
    console,
    document: { createElement: () => ({ dataset: {}, remove() {}, style: {} }), head: { appendChild() {} } },
    navigator: { language: 'en-US' },
    setTimeout, clearTimeout, queueMicrotask, Promise, Object, Array, JSON, Error, Symbol,
    Map, Set, Math, Reflect, String, Number, Boolean, Date, RegExp, TypeError, RangeError,
    Proxy, Function
  }))
  if (captured === null) fail('bundle registers itself via window.__ModuleLoader__.load')
  else pass('bundle registers itself via window.__ModuleLoader__.load', captured.id)

  const exportsObj = captured.factory(requireFn)
  const keys = Object.keys(exportsObj).sort()
  const wanted = keys.length === 2 && keys[0] === 'apply' && keys[1] === 'inject'
  if (wanted) pass('factory executes and exports { apply, inject }')
  else fail('factory executes and exports { apply, inject }', `got ${JSON.stringify(keys)}`)

  if (Array.isArray(exportsObj.inject) && exportsObj.inject.length > 0) {
    pass('inject declares required client services', exportsObj.inject.join(', '))
  } else {
    fail('inject declares required client services')
  }
} catch (error) {
  fail('bundle loads and its factory executes', String(error.message ?? error))
}

console.log(`\n${failures.length === 0 ? 'client bundle OK' : `${failures.length} check(s) failed`}`)
process.exit(failures.length === 0 ? 0 : 1)
