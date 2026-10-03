/**
 * Manual, network-dependent probe — NOT part of `npm run verify`.
 *
 * Proves where `x-opencode-session` comes from: dsh attaches it natively, from
 * `options.sessionId`, through pi-ai's built-in `opencode-go` provider. No plugin
 * participates, so this runs the provider factory directly and reads the real
 * outgoing headers by wrapping `fetch`.
 *
 * Usage (a key is required; nothing is printed but the header and the status):
 *
 *   OPENCODE_GO_API_KEY=... node scripts/probe-opencode-session.mjs
 *
 * It resolves `@earendil-works/pi-ai` from the running dsh installation, so it
 * works from this checkout without adding a dependency.
 *
 * Expected, against https://opencode.ai/zen/go/v1/chat/completions:
 *   sessionId set      -> header present -> HTTP 200
 *   sessionId omitted  -> header absent  -> HTTP 400 MissingSessionID
 *   sessionId ''       -> header absent  -> HTTP 400 MissingSessionID
 */

import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * Locate the dsh installation and import pi-ai from inside it.
 *
 * pi-ai is ESM-only and its exports map declares no `require` condition, so this
 * imports the dist file by URL instead of resolving the bare specifier.
 */
async function resolvePiAi() {
  const roots = []
  try {
    roots.push(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim())
  } catch {
    /* npm may be absent; the explicit fallbacks below still apply */
  }
  roots.push('/usr/local/lib/node_modules', '/usr/lib/node_modules')
  for (const root of roots) {
    const dist = `${root}/@deepseek-ai/dsh/node_modules/@earendil-works/pi-ai/dist/providers`
    if (!existsSync(`${dist}/opencode-go.js`)) continue
    const load = (name) => import(pathToFileURL(`${dist}/${name}.js`).href)
    return { provider: await load('opencode-go'), models: await load('opencode-go.models') }
  }
  throw new Error('could not find @earendil-works/pi-ai inside any known dsh installation')
}

const apiKey = process.env.OPENCODE_GO_API_KEY ?? process.env.OPENCODE_API_KEY
if (!apiKey) throw new Error('set OPENCODE_GO_API_KEY (or OPENCODE_API_KEY)')

const { provider: providerModule, models: modelsModule } = await resolvePiAi()
const model = Object.values(modelsModule.OPENCODE_GO_MODELS).find((entry) => entry.id === 'deepseek-v4.1-flash')
if (!model) throw new Error('deepseek-v4.1-flash is not in the opencode-go catalog')
console.log(`model: ${model.id} | api: ${model.api} | provider: ${model.provider}`)

const calls = []
const realFetch = globalThis.fetch
globalThis.fetch = async (url, init = {}) => {
  const headers = new Headers(init.headers ?? {})
  const record = { url: String(url), session: headers.get('x-opencode-session'), status: null }
  calls.push(record)
  const response = await realFetch(url, init)
  record.status = response.status
  return response
}

const provider = providerModule.opencodeGoProvider()
const context = { messages: [{ role: 'user', content: 'Reply with exactly: ok' }] }

/** Run one request and report the header that actually left the process. */
async function run(label, extra) {
  calls.length = 0
  let failure = null
  try {
    for await (const chunk of provider.streamSimple(model, context, { apiKey, maxRetries: 0, maxTokens: 16, ...extra })) {
      if (chunk.type === 'finish' && chunk.failure) failure = chunk.failure
      if (chunk.type === 'error') failure = chunk.error?.errorMessage ?? chunk.error
    }
  } catch (error) {
    failure = `${error?.name ?? 'Error'}: ${error?.message ?? error}`
  }
  const call = calls[0] ?? {}
  console.log(`\n[${label}]`)
  console.log(`  x-opencode-session: ${call.session ?? '(ABSENT)'}`)
  console.log(`  -> HTTP ${call.status ?? '(no request)'}`)
  if (failure) console.log(`  failure: ${typeof failure === 'string' ? failure : JSON.stringify(failure)}`)
  return call
}

const present = await run('sessionId: "probe-native-session-abc"', { sessionId: 'probe-native-session-abc' })
const omitted = await run('sessionId: omitted', {})
const blank = await run('sessionId: "" (empty string)', { sessionId: '' })

console.log('\n=== VERDICT ===')
console.log(`native injection with sessionId : ${present.session === 'probe-native-session-abc'} (HTTP ${present.status})`)
console.log(`header absent when omitted      : ${omitted.session === null} (HTTP ${omitted.status})`)
console.log(`empty string is also skipped    : ${blank.session === null} (HTTP ${blank.status})`)
