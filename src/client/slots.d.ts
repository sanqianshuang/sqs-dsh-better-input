/**
 * Host-provided `slots` service type.
 *
 * dsh 0.1.2 removed the client runtime assembly package (`dsh-client-runtime`)
 * whose cordis `Context` augmentation previously exposed `ctx.slots` to plugin
 * code. The slot-registry service is still injected by the host at runtime, but
 * its public type no longer ships in any package a plugin depends on — the
 * `SlotsService` export moved out of `@deepseek-ai/dsh-client-ui-slots`.
 *
 * The harness ecosystem convention (e.g. dsh-routing-suite) is that a plugin
 * declares its own minimal ClientContext. We mirror that here: reuse the pure
 * slot registry's strongly-typed `register` contract (`SlotCore`) and add the
 * host's nested `inject(name, contribute)` wiring face used by this plugin's
 * `apply`.
 */
import type { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'

interface BetterInputSlotsService extends SlotCore {
  inject(name: string, contribute: () => unknown): unknown
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: BetterInputSlotsService
  }
}