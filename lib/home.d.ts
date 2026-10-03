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
/** dsh's home directory, honouring `$DSH_HOME` exactly as dsh does. */
export declare function dshHomeDir(env?: NodeJS.ProcessEnv): string;
/** Join segments onto dsh's home directory. */
export declare function dshHomePath(...segments: string[]): string;
