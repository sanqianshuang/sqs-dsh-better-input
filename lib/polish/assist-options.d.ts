/**
 * The `GenerateOptions` one polish / optimize assist dispatches.
 *
 * This module exists on its own — with no runtime imports, only erased type
 * imports — so `npm run check:routes` can exercise it directly. The bug it
 * guards against is invisible to `tsc`, to the build, and to a boot probe: the
 * request still reaches the provider, and only that provider's own answer says
 * anything is wrong.
 */
import type { GenerateOptions, LlmCallConfig } from '@deepseek-ai/dsh-llm';
/** The request fields an assist owns; everything else comes from the prepared call. */
export interface AssistStreamFields {
    readonly messages: GenerateOptions['messages'];
    readonly system: string;
    /** Composer Session the assist runs for; `''` when the caller has none. */
    readonly sessionId: string;
    readonly signal: AbortSignal;
}
/**
 * Assemble the request for one assist, stamping the composer Session.
 *
 * `sessionId` is **not** optional decoration. dsh routes every model request
 * through the `llm/stream` waterfall, and a provider that needs per-session
 * transport metadata reads it from exactly there. OpenCode is the working
 * example, and its support is **native** — no plugin involved: pi-ai ships the
 * `opencode` / `opencode-go` providers, both wrapping their API surfaces in
 * `withOpenCodeSessionHeader()`, which turns `options.sessionId` into the
 * `x-opencode-session` header; `@deepseek-ai/dsh-llm-pi-ai` reuses that catalog
 * provider and forwards the field into `streamSimple`. The relay answers HTTP
 * 400 `MissingSessionID` when the header is absent, so the only thing a caller
 * must do is supply the id. dsh's own auxiliary callers stamp the field for the
 * same reason — `dsh-session-title-llm` passes `sessionId: request.session.id`,
 * `dsh-compaction-basic` passes `agent.session.id`.
 *
 * Without it an assist is not a request "on behalf of this conversation" at all:
 * it is an anonymous request that only first-party providers happen to accept.
 * That is why switching the composer to a relay route broke prompt optimization
 * while the official route kept working.
 *
 * An empty id is omitted rather than sent as `''`: adapters treat the field as
 * present-or-absent, and a blank string would be attached as a real (empty)
 * session header.
 *
 * @param config - the registration-bound config returned by `prepareCall`.
 * @param fields - the request fields this plugin owns.
 * @returns a complete request carrying every prepared config field unchanged.
 */
export declare function assistStreamOptions(config: LlmCallConfig, fields: AssistStreamFields): GenerateOptions;
