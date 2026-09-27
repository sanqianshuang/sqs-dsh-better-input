//#region src/identity.ts
/**
* Single source of truth for this package's identity.
*
* Every externally visible name (the Typert package key, the npm package name
* used by the update check, the settings namespace) derives from here so a
* rename never leaves a stale literal behind.
*/
/** Stable identifier for this fork. Used as the Typert package key. */
const PACKAGE_NAME = "sqs-dsh-better-input";
/** Repository for this fork. */
const REPOSITORY_URL = "https://github.com/sanqianshuang/sqs-dsh-better-input";
/** npm scope owner; only used to build the fallback slug when a URL is unparseable. */
const NPM_SCOPE = "sanqianshuang";
//#endregion
export { PACKAGE_NAME as n, REPOSITORY_URL as r, NPM_SCOPE as t };

//# sourceMappingURL=identity-CzaR1Taa.js.map