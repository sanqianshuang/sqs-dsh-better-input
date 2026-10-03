/**
 * Resolve DeepSeek Harness's own home directory.
 *
 * dsh keeps every piece of user data under **one** root, and `$DSH_HOME`
 * overrides the `~/.dsh` default (see `@deepseek-ai/dsh-home-paths`
 * `resolveDshHome`). This plugin owns two JSON documents inside that root, so
 * resolving them with `os.homedir()` instead of dsh's own rule silently splits
 * the plugin's state across two homes: dsh — and therefore the credentials,
 * sessions and settings the user actually configured — follows `$DSH_HOME`,
 * while the plugin keeps reading and writing `~/.dsh`. On a machine launched
 * with an explicit home that surfaces as "the plugin still shows the other
 * installation's settings", and edits made on one side never reach the other.
 *
 * `@deepseek-ai/dsh-home-paths` is a dsh package this plugin does not otherwise
 * depend on, so the rule is mirrored here rather than imported (no new peer, no
 * new demotion risk): `$DSH_HOME` wins when it is non-blank, then `~/.dsh`. An
 * explicit *configured* home — dsh's highest-precedence source — is not
 * reachable from a plugin; `$DSH_HOME` covers every launch that does not pass
 * one through app-boot options.
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** dsh's home directory, honouring `$DSH_HOME` exactly as dsh does. */
export function dshHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.DSH_HOME
  const base = fromEnv !== undefined && fromEnv.trim().length > 0 ? fromEnv : join(homedir(), '.dsh')
  return resolve(expandHome(base))
}

/** Join segments onto dsh's home directory. */
export function dshHomePath(...segments: string[]): string {
  return join(dshHomeDir(), ...segments)
}

/**
 * Expand the tilde prefixes dsh accepts in a configured home path.
 *
 * Mirrors `expandHomePath` from `dsh-home-paths`: only a whole `~` or a leading
 * `~/` / `~\` is a home reference, so a Windows path that merely contains a `~`
 * is left alone.
 */
function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}
