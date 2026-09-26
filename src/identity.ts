/**
 * Single source of truth for this package's identity.
 *
 * Every externally visible name (the Typert package key, the npm package name
 * used by the update check, the settings namespace) derives from here so a
 * rename never leaves a stale literal behind.
 */

/** Stable identifier for this fork. Used as the Typert package key. */
export const PACKAGE_NAME = 'sanqianshuang-better-input'

/** Author of this secondary development. */
export const AUTHOR = 'sanqianshuang'

/** Repository for this fork. */
export const REPOSITORY_URL = 'https://github.com/sanqianshuang/sanqianshuang-better-input'

/** License inherited from the upstream MIT project. */
export const LICENSE = 'MIT'

/**
 * Upstream attribution. This is a secondary development of the MIT-licensed
 * `dsh-better-input` project; the original copyright notice and license text
 * are retained in LICENSE as the MIT terms require.
 */
export const UPSTREAM_NAME = 'dsh-better-input'
export const UPSTREAM_URL = 'https://github.com/DIAG5/dsh-better-input'
