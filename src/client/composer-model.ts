/**
 * Read the model the composer currently has selected.
 *
 * dsh's own model-selection client plugin
 * (`@deepseek-ai/dsh-client-ui-model-selection`) owns the per-session
 * "directory". Its store is what the composer seat renders; DSH populates that
 * store from two asynchronous inputs, a Host model catalog and the Session's
 * projected `modelSelection`:
 *
 * ```
 * ModelDirectory.syncInputs()
 *   projected = projections.faceOf('modelSelection').getSnapshot()   // Session
 *   catalog   = catalog.store.getSnapshot()                          // Host RPC
 *   if (catalog.status !== 'ready' || catalog.value === null || projected === undefined) {
 *     store.set({ current: catalog.value === null ? null : store.current, status: 'loading' })
 *     return                                                         // ← current NOT updated
 *   }
 *   store.set({ current: projected.next ?? catalog.value.default, ... })
 * ```
 *
 * Two entry points of the model-selection package call `directoryFor()` and
 * then `directory.store.subscribe(...)`: the `/model` popup **and the composer's
 * own model seat**. Every one of those subscriptions shares a single Session
 * binding, and `ModelDirectory` keeps one `WeakMap` keyed by that binding — but
 * the entrypoints are evaluated in *different Cordis scopes*, and a scope
 * teardown runs `actx.effect(() => () => { directory.dispose(); live.directories.delete(binding) },
 * 'ui-model-selection: session directory')`, i.e. it **disposes the directory of
 * every other subscriber too** while they remain subscribed.
 *
 * That is why this plugin's `read()` refuses to call `directoryFor()` when the
 * cached directory already reports `disposed`: asking again would mint a fresh
 * directory and re-register that same destructive teardown, which is precisely
 * how a plugin can amplify the churn it is trying to observe.
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
 * The value handed to React is a **cached route object**, because
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

/** One session's directory, including the `disposed` flag it publishes. */
interface ModelDirectoryLike {
  readonly store: ModelDirectoryStoreLike
  /** Set by dsh when the directory's owning scope tears down. */
  readonly disposed: boolean
}

/** dsh's `ctx.modelDirectories` service, narrowed to the one lookup we need. */
interface ModelDirectoriesLike {
  directoryFor(sessionId: string): ModelDirectoryLike
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

/** The write-only Remote face used to resolve a route without a Session. */
interface SessionCatalogRemoteLike {
  modelCatalog(): Promise<{
    readonly ok: boolean
    readonly value?: { readonly default?: { readonly provider?: unknown; readonly model?: unknown } }
  }>
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
  const provider = String(selection.provider ?? '').trim()
  const model = String(selection.model ?? '').trim()
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
  /**
   * The Session this face is bound to, `''` when unknown.
   *
   * Needed to ask the Host about *this* Session
   * (`betterInput/resolveAssistRoute`), and deliberately a plain read rather
   * than part of the render snapshot: `useSyncExternalStore` compares snapshot
   * identity, and a Session switch that lands on the same model publishes the
   * same route — the resolved answer would be identical anyway.
   */
  readSessionId(): string
}

/** One session's cached snapshot plus its store subscription. */
class ComposerModelEntry {
  private snapshot: ComposerModelRoute | null
  private readonly listeners = new Set<() => void>()
  private unsubscribe: (() => void) | undefined
  /** Set when the directory this entry watches was disposed by another scope. */
  private orphaned = false
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

  /**
   * Whether the directory this entry was built from is still alive.
   *
   * `directoryFor()` hands back the *same* directory object to every subscriber
   * that shares a Session binding, so a teardown performed by any other scope
   * disposes this entry's store too. Once that happened the cached value is
   * frozen (the disposed directory never publishes again), and the owner must
   * ask `directoryFor()` for a fresh one instead of caching `null`.
   */
  isOrphaned(): boolean {
    return this.orphaned || this.disposed
  }

  /** Mark the watched store disposed; keeps the last value until re-resolution. */
  orphan(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    this.orphaned = true
  }

  dispose(): void {
    this.disposed = true
    this.unsubscribe?.()
    this.unsubscribe = undefined
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
 *
 * **The Host catalog default is a fallback for an ABSENT directory only, never
 * for a directory that is merely warming up.** dsh's `ModelDirectory.syncInputs()`
 * writes `current` only once its Host catalog is `ready`:
 *
 * ```
 * if (catalog.status !== 'ready' || catalog.value === null || projected === undefined) {
 *   store.set({ current: catalog.value === null ? null : store.current, status: 'loading' })
 *   return                                  // ← `current` is left unset
 * }
 * store.set({ current: projected.next ?? catalog.value.default, … })
 * ```
 *
 * so `current: null` on a *live* directory means "not ready yet", not "no
 * selection". Substituting the catalog default there would silently name a
 * *different* model than the composer displays — measured on a real profile, the
 * composer read `DeepSeek-V41-Flash` while the catalog default was
 * `deepseek-official/deepseek-flash`, and the settings page's follow row showed
 * the latter. A wrong-but-plausible model is worse than "no model": the follow
 * row exists precisely so the user can confirm the follow works, and it would
 * have confirmed the wrong thing. So a live directory answers with its own
 * value (`null` included) and only a *missing* directory falls back to the
 * catalog default.
 */
export class ComposerModelSource {
  private readonly entries = new Map<string, ComposerModelEntry>()
  private readonly faces = new Map<string, ComposerModelFace>()
  private active: ComposerModelFace | undefined
  private disposeActive: (() => void) | undefined
  private disposed = false
  private activeSessionId: string | undefined
  private catalogDefault: ComposerModelRoute | null = null
  private catalogRequested = false

  constructor(private readonly ctx: ClientContext) {}

  /** The stable per-session face; identities do not change between renders. */
  faceFor(sessionId: string): ComposerModelFace {
    let face = this.faces.get(sessionId)
    if (face === undefined) {
      const read = (): ComposerModelRoute | null => (this.disposed ? null : this.readFor(sessionId))
      const subscribe = (listener: () => void): (() => void) => {
        if (this.disposed) return () => {}
        return this.subscribeFor(sessionId, listener)
      }
      face = {
        read,
        subscribe,
        useCurrent: () => useSyncExternalStore(subscribe, read),
        readSessionId: () => sessionId
      }
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
    let disposeInner: (() => void) | undefined

    const read = (): ComposerModelRoute | null => (this.disposed ? null : this.readFor(this.activeSessionId))
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
      if (next === this.activeSessionId && disposeInner !== undefined) return
      this.activeSessionId = next
      disposeInner?.()
      disposeInner = next === undefined ? undefined : this.subscribeFor(next, () => this.notifyActive(listeners))
      this.notifyActive(listeners)
    }

    this.active = {
      read,
      subscribe,
      useCurrent: () => useSyncExternalStore(subscribe, read),
      readSessionId: () => this.activeSessionId ?? ''
    }
    const session = uiSession(this.ctx)
    this.disposeActive = () => {
      disposeInner?.()
      disposeInner = undefined
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
    this.activeSessionId = undefined
    for (const entry of this.entries.values()) entry.dispose()
    this.entries.clear()
    this.faces.clear()
  }

  /**
   * Read one Session's route.
   *
   * A **live** directory is authoritative even when it answers `null` — that is
   * how dsh represents "the Host catalog is not ready yet", and substituting the
   * catalog default there would name a different model than the composer shows
   * (see the class note). The catalog default therefore covers only a directory
   * that could not be resolved at all: dsh's model-selection plugin not being
   * composed, or this Session not being resident.
   *
   * Never throws and never allocates: the returned object is the cached snapshot
   * while nothing changed.
   */
  private readFor(sessionId: string | undefined): ComposerModelRoute | null {
    if (sessionId !== undefined) {
      const entry = this.entryFor(sessionId)
      if (entry !== undefined) return entry.read()
    }
    this.ensureCatalog()
    return this.catalogDefault
  }

  /** Subscribe to one Session's directory, re-resolving it when it was disposed. */
  private subscribeFor(sessionId: string, listener: () => void): () => void {
    const entry = this.entryFor(sessionId)
    if (entry === undefined) return () => {}
    return entry.subscribe(listener)
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
    if (cached !== undefined && !cached.isOrphaned()) return cached

    const service = modelDirectories(this.ctx)
    if (service === undefined) return undefined
    let directory: ModelDirectoryLike
    try {
      directory = service.directoryFor(sessionId)
    } catch {
      return undefined
    }
    // A disposed directory never publishes again: reusing it would freeze this
    // Session's route forever, and minting a new one here would re-register the
    // teardown that disposed it — the exact churn that makes dsh's model seat
    // drop its own subscription. Keep the cached value, keep it fresh from its
    // (still readable) store, but stop claiming the store is trustworthy.
    if (directory.disposed === true) {
      cached?.orphan()
      return cached
    }
    const entry = new ComposerModelEntry(directory.store)
    this.entries.set(sessionId, entry)
    return entry
  }

  /**
   * Fetch the Host model catalog once, for the last-resort default route.
   *
   * Failure is not an error worth surfacing: the assists keep working from the
   * settings route (see the header). The result is memoized on the source, so
   * the settings page and every slot entry share one request.
   */
  private ensureCatalog(): void {
    if (this.catalogRequested || this.disposed) return
    this.catalogRequested = true
    const lookup = this.ctx as unknown as { remote?: { session?: SessionCatalogRemoteLike } }
    const remote = lookup.remote?.session
    if (remote === undefined) return
    void remote
      .modelCatalog()
      .then((response) => {
        if (this.disposed || !response.ok) return
        const fallback = response.value?.default
        const provider = String(fallback?.provider ?? '').trim()
        const model = String(fallback?.model ?? '').trim()
        if (provider === '' || model === '') return
        this.catalogDefault = { provider, model }
        // The faces read this through their cached snapshot, so nothing new is
        // published here; the next model switch or re-render picks it up.
      })
      .catch(() => {
        // Optional convenience only — never fail the page for it.
      })
  }
}
