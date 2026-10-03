/**
 * Read the model the composer currently has selected.
 *
 * dsh's own model-selection client plugin
 * (`@deepseek-ai/dsh-client-ui-model-selection`) owns the per-session
 * "directory" both the composer seat and the `/model` popup render from:
 * `ctx.modelDirectories.directoryFor(sessionId).store` is a snapshot store whose
 * `current` is the session's durable selection and whose `pending` is a
 * selection that has been submitted but not settled yet.
 *
 * Two deliberate decisions:
 *
 * 1. The service is looked up **lazily through `ctx.get()`** at read time and is
 *    not part of this plugin's client `inject`. Injecting it would gate the whole
 *    browser half — settings page, template library, microphone — on another
 *    plugin being composed, and the model directory is only *nice to have*:
 *    without it the assists fall back to the route configured in settings.
 * 2. Its shape is declared **structurally** below rather than imported. The
 *    package is not one of this plugin's peers (the browser half must keep
 *    working without it) and importing it for a handful of field names would add
 *    a dev dependency whose own type graph (`dsh-api-session-controller`, …) is
 *    not resolvable here. `src/client/OptimizeButton.tsx` reads conversation
 *    nodes the same way.
 *
 * The snapshot returned by `read()`/`useCurrent()` is cached, because
 * `useSyncExternalStore` requires a referentially stable value while nothing
 * changed.
 */

import { useSyncExternalStore } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ComposerModelRoute } from '../config.js'

/** The durable selection frame projected from Session history. */
interface ModelSelectionLike {
  readonly provider: string
  readonly model: string
}

/** The slice of dsh's `ModelDirectoryState` this plugin reads. */
interface ModelDirectoryStateLike {
  readonly current: ModelSelectionLike | null
  readonly pending: ModelSelectionLike | null
}

/** `SnapshotStore<ModelDirectoryState>` as this plugin uses it. */
interface ModelDirectoryStoreLike {
  getSnapshot(): ModelDirectoryStateLike
  subscribe(listener: () => void): () => void
}

/** dsh's `ctx.modelDirectories` service, narrowed to the one lookup we need. */
interface ModelDirectoriesLike {
  directoryFor(sessionId: string): { readonly store: ModelDirectoryStoreLike }
}

/** A uSES-safe source holding the Session the composer is currently showing. */
interface CurrentSessionSourceLike {
  getSnapshot(): { readonly key: string | undefined }
  subscribe(listener: () => void): () => void
}

/** dsh's `ctx.uiSession` service, narrowed to the main-view binding. */
interface UiSessionLike {
  readonly current: CurrentSessionSourceLike
}

/**
 * Read dsh's main-view Session binding, absent when dsh did not compose the
 * Session UI plugin. Used by the session-less settings page, which has no
 * `sessionId` of its own and must follow whichever Session the composer shows.
 */
function uiSession(ctx: ClientContext): UiSessionLike | undefined {
  const lookup = ctx as unknown as { get(name: string): unknown }
  const service = lookup.get('uiSession')
  if (service === null || typeof service !== 'object') return undefined
  const current = (service as { current?: unknown }).current
  if (current === null || typeof current !== 'object') return undefined
  const { getSnapshot, subscribe } = current as { getSnapshot?: unknown; subscribe?: unknown }
  if (typeof getSnapshot !== 'function' || typeof subscribe !== 'function') return undefined
  return service as UiSessionLike
}

/** Read one session's model directory service, absent when dsh did not compose it. */
function modelDirectories(ctx: ClientContext): ModelDirectoriesLike | undefined {
  // `ctx.get` is typed against the augmented Context, which does not carry this
  // optional service (see the header note), so the name goes through a narrow
  // structural cast instead of the real package types.
  const lookup = ctx as unknown as { get(name: string): unknown }
  const service = lookup.get('modelDirectories')
  if (service === null || typeof service !== 'object') return undefined
  const directoryFor = (service as { directoryFor?: unknown }).directoryFor
  if (typeof directoryFor !== 'function') return undefined
  return service as ModelDirectoriesLike
}

/**
 * Resolve the composer's route from one directory snapshot.
 *
 * `pending` wins over `current`: it is the selection the user just made, and the
 * durable projection only catches up a moment later.
 *
 * Only `provider` and `model` are reported. The composer's reasoning effort is
 * deliberately NOT carried here: an assist's thinking tier is its own setting
 * (`polishReasoningEffort` / `optimizeReasoningEffort`), because inheriting the
 * conversation's effort made every polish and every ✨ click pay for whatever
 * tier the user happened to have selected — the reported cost regression.
 */
function routeOf(state: ModelDirectoryStateLike): ComposerModelRoute | null {
  const selection = state.pending ?? state.current
  if (selection === null) return null
  const provider = selection.provider.trim()
  const model = selection.model.trim()
  if (provider === '' || model === '') return null
  return { provider, model }
}

function sameRoute(left: ComposerModelRoute | null, right: ComposerModelRoute | null): boolean {
  if (left === null || right === null) return left === right
  return left.provider === right.provider && left.model === right.model
}

/** The read-only face one slot entry gets for its own session. */
export interface ComposerModelFace {
  /** Current route, or `null` when the composer's selection is unknown. */
  read(): ComposerModelRoute | null
  /** Render-time view of the same value (`useSyncExternalStore`). */
  useCurrent(): ComposerModelRoute | null
  /** Subscribe to changes, for holders that re-point their own listeners. */
  subscribe(listener: () => void): () => void
}

/** One session's cached snapshot plus its store subscription. */
class ComposerModelEntry {
  private snapshot: ComposerModelRoute | null
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribe: () => void
  private disposed = false

  constructor(private readonly store: ModelDirectoryStoreLike) {
    this.snapshot = routeOf(store.getSnapshot())
    this.unsubscribe = store.subscribe(() => this.refresh())
  }

  read(): ComposerModelRoute | null {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribe()
    this.listeners.clear()
  }

  private refresh(): void {
    if (this.disposed) return
    const next = routeOf(this.store.getSnapshot())
    if (sameRoute(next, this.snapshot)) return
    this.snapshot = next
    // Copy before dispatch: a listener may unsubscribe itself.
    for (const listener of [...this.listeners]) listener()
  }
}

/**
 * Resolves — and keeps watching — the composer's selected model per session.
 *
 * One instance is created by the client half and handed to the slot entries as a
 * per-session face, so both the optimize button and the microphone read the same
 * value the composer shows.
 */
export class ComposerModelSource {
  private readonly entries = new Map<string, ComposerModelEntry>()
  private readonly faces = new Map<string, ComposerModelFace>()
  private active: ComposerModelFace | undefined
  private disposeActive: (() => void) | undefined
  private disposed = false

  constructor(private readonly ctx: ClientContext) {}

  /** The stable per-session face; identities do not change between renders. */
  faceFor(sessionId: string): ComposerModelFace {
    let face = this.faces.get(sessionId)
    if (face === undefined) {
      const read = (): ComposerModelRoute | null => (this.disposed ? null : (this.entryFor(sessionId)?.read() ?? null))
      const subscribe = (listener: () => void): (() => void) => {
        if (this.disposed) return () => {}
        return this.entryFor(sessionId)?.subscribe(listener) ?? (() => {})
      }
      face = { read, subscribe, useCurrent: () => useSyncExternalStore(subscribe, read) }
      this.faces.set(sessionId, face)
    }
    return face
  }

  /**
   * A face that follows whichever Session the composer is currently showing.
   *
   * The settings page is session-less — the framework passes an empty
   * `sessionId` there — yet it must display the model the composer is on. It
   * therefore tracks dsh's main-view binding and re-points the underlying
   * per-session face whenever the user switches Session. Without the Session UI
   * service it degrades to "no selection", which the settings page renders as
   * the configured fallback route.
   */
  activeFace(): ComposerModelFace {
    if (this.active !== undefined) return this.active
    const listeners = new Set<() => void>()
    let current: ComposerModelFace | undefined
    let target: string | undefined
    let unsubscribeSession: (() => void) | undefined

    const read = (): ComposerModelRoute | null => (this.disposed ? null : (current?.read() ?? null))
    const subscribe = (listener: () => void): (() => void) => {
      if (this.disposed) return () => {}
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
    // Re-point the inner face at the new Session and re-subscribe to its store,
    // so a Session switch and a model switch are both seen by our listeners.
    const retarget = (): void => {
      if (this.disposed) return
      const next = uiSession(this.ctx)?.current.getSnapshot().key
      if (next === target) return
      target = next
      unsubscribeSession?.()
      unsubscribeSession = undefined
      current = next === undefined ? undefined : this.faceFor(next)
      if (current !== undefined) unsubscribeSession = current.subscribe(() => this.notifyActive(listeners))
      this.notifyActive(listeners)
    }

    this.active = {
      read,
      subscribe,
      useCurrent: () => useSyncExternalStore(subscribe, read)
    }
    const session = uiSession(this.ctx)
    this.disposeActive = () => {
      unsubscribeSession?.()
      unsubscribeSession = undefined
      listeners.clear()
    }
    if (session !== undefined) {
      const stop = session.current.subscribe(retarget)
      const previous = this.disposeActive
      this.disposeActive = () => {
        stop()
        previous()
      }
    }
    retarget()
    return this.active
  }

  /** Fan out to the active-face listeners, copying first (one may unsubscribe). */
  private notifyActive(listeners: ReadonlySet<() => void>): void {
    for (const listener of [...listeners]) listener()
  }

  dispose(): void {
    this.disposed = true
    this.disposeActive?.()
    this.disposeActive = undefined
    this.active = undefined
    for (const entry of this.entries.values()) entry.dispose()
    this.entries.clear()
    this.faces.clear()
  }

  /**
   * Resolve — and memoize — one session's directory store.
   *
   * `directoryFor` throws for a session that is not resident yet, and the model
   * directory is optional in the first place, so every failure degrades to
   * `undefined` and the caller falls back to the configured route.
   */
  private entryFor(sessionId: string): ComposerModelEntry | undefined {
    if (this.disposed) return undefined
    const cached = this.entries.get(sessionId)
    if (cached !== undefined) return cached
    const service = modelDirectories(this.ctx)
    if (service === undefined) return undefined
    let store: ModelDirectoryStoreLike
    try {
      store = service.directoryFor(sessionId).store
    } catch {
      return undefined
    }
    const entry = new ComposerModelEntry(store)
    this.entries.set(sessionId, entry)
    return entry
  }
}
