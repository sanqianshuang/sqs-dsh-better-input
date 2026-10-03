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

import { createElement, Fragment, type ReactElement } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Loads the conversation SlotMap augmentation that declares
// `conversation.input.activity` as a `single` session slot.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** The seat dsh's own microphone occupies. Declared `single` by dsh. */
const NATIVE_VOICE_SLOT = 'conversation.input.activity'

/**
 * Priority our shadowing entry registers at.
 *
 * dsh registers the native microphone at the slot default (0) and the registry
 * renders the **lowest** priority, so any negative value wins. `-1` is the
 * smallest nudge that does it, leaving room below for another plugin to take the
 * seat from us by the same rule rather than by load order.
 */
const SHADOW_PRIORITY = -1

/**
 * Renders nothing: this entry exists to shadow, not to draw.
 *
 * Returns a real element rather than `null`. A `null` render is not neutral
 * here: the outlet wraps every entry in `SlotErrorBoundary`, whose
 * `componentDidCatch` retires (`abdicates`) the entry from its cell — so a
 * component that renders nothing usable stops shadowing anything, which is the
 * worst of both worlds. An empty fragment is a valid, zero-layout render that
 * keeps the entry live in the ledger.
 */
function Nothing(): ReactElement {
  return createElement(Fragment)
}

/**
 * The business face this entry contributes.
 *
 * It must be an **object**, not `undefined`: the outlet passes every entry's
 * inject share through `bindInjectSources`, which reads `face["hooks"]` before
 * deciding there is nothing to bind. Returning `undefined` therefore throws
 * `TypeError: Cannot read properties of undefined (reading 'hooks')` while the
 * component renders, and the entry-boundary error handler *abdicates* the entry
 * — it silently stops shadowing, which is exactly how the first two revisions of
 * this module failed. An empty object has no hooks and binds to nothing.
 */
const EMPTY_INJECT_FACE = {}

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
export function shadowNativeVoiceInput(ctx: ClientContext, onError: (message: string) => void): () => void {
  // One narrow structural view of the two slot calls used here. The registry's
  // real generic proves every prop share structurally against the target slot's
  // declaration; this entry draws nothing and reads no seat, so there is nothing
  // for that proof to check and the calls are made through the shapes this
  // module actually depends on. Kept local so no other call site loses the
  // checked overloads.
  const slots = ctx.slots as unknown as {
    inject(key: string, contribute: () => () => void): () => void
    register(options: { name: string; priority: number; inject: () => Record<string, never> }, component: () => ReactElement): () => void
  }
  try {
    return slots.inject(NATIVE_VOICE_SLOT, () => {
      try {
        return slots.register(
          { name: NATIVE_VOICE_SLOT, priority: SHADOW_PRIORITY, inject: () => EMPTY_INJECT_FACE },
          Nothing
        )
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error))
        return () => {}
      }
    })
  } catch (error) {
    // `inject` itself only throws when the caller's fiber is already gone.
    onError(error instanceof Error ? error.message : String(error))
    return () => {}
  }
}
