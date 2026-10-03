/**
 * Give this plugin the composer's single voice-input seat.
 *
 * dsh ships its own microphone in `conversation.input.activity`
 * (`@deepseek-ai/dsh-experimental-client-ui-voice-input`). That slot is declared
 * **`kind: 'single'`** (`dsh-client-ui-conversation`), so it renders at most one
 * entry and `ctx.slots.register` rejects a second registration at the same
 * priority:
 *
 * ```
 * single slot "conversation.input.activity" already has a registration at
 * priority 0 — register at a different priority to shadow it (lowest renders)
 * ```
 *
 * Registering **below** the occupant's priority is therefore the supported way
 * to take the seat: `entriesOfSlot` sorts entries by ascending priority and
 * keeps the first live entry, so our entry wins and dsh's own microphone simply
 * stops rendering. When this plugin is disposed the shadowing entry leaves the
 * ledger and the native button comes back on its own — no cross-plugin state, no
 * patching of another package.
 *
 * Why take the seat instead of sharing it: with both plugins enabled the
 * composer showed **two** microphones side by side (dsh's in
 * `conversation.input.activity`, ours in `conversation.input.right`), both
 * running the same local SenseVoice recognizer, with no way to tell them apart.
 * This plugin's microphone is the one that also streams preview text, polishes
 * the finished transcript and drives the recognition bar, so it is the one that
 * should be visible.
 *
 * ## The registration must wait for the declaration
 *
 * The slot does not exist when this plugin activates. `dsh-client-ui-conversation`
 * declares it inside a nested `slots.inject('main', …)` contribution, several
 * declaration layers deep (`main` → `conversation.composer.bar` →
 * `conversation.input.activity`). A bare `slots.register` at apply time
 * therefore throws `slot "…" is not declared` and the shadow never lands — while
 * looking perfectly correct in the source. (That is exactly how the first
 * revision of this module shipped, and the live slot ledger showed the native
 * entry as the only occupant at priority 0.)
 *
 * `slots.inject(key, callback)` is the API for this: it runs the callback as
 * soon as the declaration exists, however late that is, and collapses it again
 * if the declaration goes away. The plugin's own `conversation.input.right` /
 * `conversation.input.dock` entries use the same call for the same reason.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/**
 * Take the composer's voice-input seat from dsh's bundled microphone.
 *
 * Must be called from a context where `slots` is available. The returned
 * disposer withdraws both the pending wait and the shadow itself; the owning
 * `ctx.effect` does this automatically when this plugin unloads, which is what
 * restores dsh's own button.
 *
 * Registration can still fail — the declaration may be torn down and rebuilt, or
 * the deposit may be refused for a reason this plugin cannot see. A failure is
 * reported through `onError` and degrades to "the native button keeps showing":
 * a duplicate microphone is a cosmetic regression, never a reason to fail this
 * plugin's activation.
 *
 * @param ctx - a client context carrying the `slots` service.
 * @param onError - receives a message when the seat could not be taken.
 * @returns the idempotent disposer for the wait and the active shadow.
 */
export declare function shadowNativeVoiceInput(ctx: ClientContext, onError: (message: string) => void): () => void;
