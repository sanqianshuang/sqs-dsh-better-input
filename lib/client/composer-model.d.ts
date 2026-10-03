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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ComposerModelRoute } from '../config.js';
/** The read-only face one slot entry gets for its own session. */
export interface ComposerModelFace {
    /** Current route, or `null` when the composer's selection is unknown. */
    read(): ComposerModelRoute | null;
    /** Render-time view of the same value (`useSyncExternalStore`). */
    useCurrent(): ComposerModelRoute | null;
    /** Subscribe to changes, for holders that re-point their own listeners. */
    subscribe(listener: () => void): () => void;
    /**
     * The Session this face is bound to, `''` when unknown.
     *
     * Needed to ask the Host about *this* Session
     * (`betterInput/resolveAssistRoute`), and deliberately a plain read rather
     * than part of the render snapshot: `useSyncExternalStore` compares snapshot
     * identity, and a Session switch that lands on the same model publishes the
     * same route — the resolved answer would be identical anyway.
     */
    readSessionId(): string;
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
export declare class ComposerModelSource {
    private readonly ctx;
    private readonly entries;
    private readonly faces;
    private active;
    private disposeActive;
    private disposed;
    private activeSessionId;
    private catalogDefault;
    private catalogRequested;
    constructor(ctx: ClientContext);
    /** The stable per-session face; identities do not change between renders. */
    faceFor(sessionId: string): ComposerModelFace;
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
    activeFace(): ComposerModelFace;
    /** Fan out to the active-face listeners, copying first (one may unsubscribe). */
    private notifyActive;
    dispose(): void;
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
    private readFor;
    /** Subscribe to one Session's directory, re-resolving it when it was disposed. */
    private subscribeFor;
    /**
     * Resolve — and memoize — one session's directory store.
     *
     * `directoryFor` throws for a session that is not resident yet, and the model
     * directory is optional in the first place, so every failure degrades to
     * `undefined` and the caller falls back to the configured route.
     */
    private entryFor;
    /**
     * Fetch the Host model catalog once, for the last-resort default route.
     *
     * Failure is not an error worth surfacing: the assists keep working from the
     * settings route (see the header). The result is memoized on the source, so
     * the settings page and every slot entry share one request.
     */
    private ensureCatalog;
}
