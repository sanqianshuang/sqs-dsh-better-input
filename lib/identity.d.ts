/**
 * Single source of truth for this package's identity.
 *
 * Every externally visible name (the Typert package key, the npm package name
 * used by the update check, the settings namespace) derives from here so a
 * rename never leaves a stale literal behind.
 */
/** Stable identifier for this fork. Used as the Typert package key. */
export declare const PACKAGE_NAME = "sqs-dsh-better-input";
/** Author of this secondary development. */
export declare const AUTHOR = "sanqianshuang";
/** Repository for this fork. */
export declare const REPOSITORY_URL = "https://github.com/sanqianshuang/sqs-dsh-better-input";
/** npm scope owner; only used to build the fallback slug when a URL is unparseable. */
export declare const NPM_SCOPE = "sanqianshuang";
/** License inherited from the upstream MIT project. */
export declare const LICENSE = "MIT";
/**
 * Upstream attribution. This is a secondary development of the MIT-licensed
 * `dsh-better-input` project; the original copyright notice and license text
 * are retained in LICENSE as the MIT terms require.
 */
export declare const UPSTREAM_NAME = "dsh-better-input";
export declare const UPSTREAM_URL = "https://github.com/DIAG5/dsh-better-input";
