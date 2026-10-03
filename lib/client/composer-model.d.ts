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
}
/**
 * Resolves — and keeps watching — the composer's selected model per session.
 *
 * One instance is created by the client half and handed to the slot entries as a
 * per-session face, so both the optimize button and the microphone read the same
 * value the composer shows.
 */
export declare class ComposerModelSource {
    private readonly ctx;
    private readonly entries;
    private readonly faces;
    private active;
    private disposeActive;
    private disposed;
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
     * Resolve — and memoize — one session's directory store.
     *
     * `directoryFor` throws for a session that is not resident yet, and the model
     * directory is optional in the first place, so every failure degrades to
     * `undefined` and the caller falls back to the configured route.
     */
    private entryFor;
}
