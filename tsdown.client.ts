import type { UserConfig } from 'tsdown'

/**
 * Specifiers the browser bundle MUST NOT inline: they are resolved at runtime by
 * the harness's client module system (`window.__ModuleLoader__`).
 *
 * This list is NOT a preference — it is the exact set of names the web shell can
 * answer. `@deepseek-ai/dsh-client-modules` resolves every `require()` against
 * (a) platform seed words, (b) already-loaded rows in the boot graph, or
 * (c) a registered package factory; anything else throws
 * `client-modules: require("…") missed the module table`.
 *
 * The platform seed words the shell pre-registers are, verbatim:
 *   react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis,
 *   @deepseek-ai/dsh-client-store, @deepseek-ai/dsh-client-ui-slots,
 *   @deepseek-ai/dsh-client-ui-primitives, @deepseek-ai/dsh-client-ui-dockkit
 *
 * Everything below is either one of those seeds or a package row this plugin
 * declares in `dsh.client.inject`, so a runtime `require()` for it succeeds.
 *
 * DO NOT add `zod` here. zod is neither a seed word nor a boot-graph row, so
 * externalizing it makes the client bundle throw on load.
 *
 * zod must also never be INLINED here, which is why `alwaysBundle` below is a
 * narrow whitelist rather than a blanket `true`. The browser bundle has no
 * business carrying a validator: the Host is the only side that runs
 * `codec.create().parse(value)` (dsh-api-gateway `lib/index.js`); the client's
 * `$mount` path only checks `codec.mode === 'strict'` and never invokes the
 * factory. `src/remote.ts` therefore builds schema-free client-face codecs, and
 * a stray value import of `remote-contract.js` from the client graph would
 * silently pull ~180 kB of zod back in. `scripts/check-client-bundle.mjs`
 * guards that invariant.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-conversation/client',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-input-trigger/client',
  '@deepseek-ai/dsh-api-remotes/client'
] as const

export function clientBundle(id: string, entry: string): UserConfig {
  return {
    name: `${id}/client`,
    entry: { client: entry },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: [...CLIENT_EXTERNALS],
      // Bundle first-party (relative) modules ONLY. A blanket `true` would be
      // wrong: it silently swallows ANY future bare dependency into the browser
      // bundle, and the shell can only satisfy the names in CLIENT_EXTERNALS.
      // `zod` is deliberately absent — see the header note; a bare specifier
      // reaching the client graph is a bug to be fixed at the import site, not
      // something to bundle away.
      alwaysBundle: (specifier: string) => specifier.startsWith('.')
    },
    outputOptions: {
      entryFileNames: 'client.js',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });'
    }
  }
}
