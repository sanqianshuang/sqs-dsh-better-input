import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { BetterInputRemote } from '../remote.js'
import { resolveInputModelRoute, type EffectiveModelRoute } from '../config.js'
import { resolveAssistRoute } from './assist-route.js'
import type { ComposerModelFace } from './composer-model.js'
import type { SettingsFace } from './MicrophoneButton.js'

/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>

/**
 * Props handed to a `conversation.input.right` entry, plus the injected
 * remote and settings face. In dsh 0.1.2 the slot standard kit supplies
 * `useChat` (Chat target snapshot, whose `legacy.nodes` carries the message
 * array) and `useInput` (draft); message history is no longer exposed through
 * a top-level `session` owner.
 */
export type OptimizeButtonProps = {
  readonly useChat: SnapshotSelectorHook<ChatSnapshot>
  readonly useInput: SnapshotSelectorHook<InputState>
  readonly inputActions: {
    setDraft(text: string): void
  }
  readonly remote: BetterInputRemote
  readonly useSettings: () => SettingsFace
  /** The composer's selected model for this Session (see composer-model.ts). */
  readonly composerModel: ComposerModelFace
  /**
   * The Session this button belongs to. Forwarded with the optimize call so
   * dsh's `llm/stream` middleware can attach the per-session transport metadata
   * some provider routes require (see `src/polish/assist-options.ts`).
   */
  readonly sessionId: string
  readonly t: Translate
}

type OptimizeState =
  | { kind: 'idle' }
  | { kind: 'optimizing' }
  | { kind: 'result'; original: string; optimized: string }
  | { kind: 'error'; message: string }

/**
 * The ✨ optimize button rendered above the composer card (in
 * `conversation.input.dock`), right-aligned. Click reads the current draft,
 * calls the Host LLM to optimize it, then shows a confirmation panel with
 * the original and optimized text. The draft is replaced only when the user
 * clicks "Adopt".
 */
export function OptimizeButton({ useChat, useInput, inputActions, remote, useSettings, composerModel, sessionId, t }: OptimizeButtonProps) {
  const [state, setState] = useState<OptimizeState>({ kind: 'idle' })
  const settingsFace = useSettings()
  const abortRef = useRef<AbortController | null>(null)
  // Draft comes from `useInput`; message history comes from the `useChat`
  // target snapshot (its `legacy.nodes` carries the ordered message array).
  const input = useInput((state) => state)
  const chat = useChat((area) => area)
  // The model the composer currently has selected; re-renders this button when
  // the user switches it, so the enable/disable state stays honest.
  const composer = composerModel.useCurrent()

  // Keep the latest draft in a ref so the click handler can read it without
  // re-subscribing on every keystroke.
  const draftRef = useRef(input.draft)
  useEffect(() => {
    draftRef.current = input.draft
  }, [input.draft])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const settings = settingsFace.status === 'ready' ? settingsFace.settings : null
  // The prompt-optimize feature is a core capability: an on/off toggle works
  // against the "everything is a plugin" philosophy, so it stays always-on
  // and users just configure its provider/model/prompt in settings.

  // The route actually called: the composer's model when the feature follows the
  // input box (the default), otherwise the route configured in settings — which
  // is also the fallback when the composer's selection cannot be read. The
  // thinking tier is this feature's own setting; it does not follow the composer
  // (see `resolveInputModelRoute`).
  const route = resolveInputModelRoute(
    settings?.optimizeFollowInputModel ?? true,
    composer,
    {
      provider: settings?.optimizeProvider ?? '',
      model: settings?.optimizeModel ?? '',
      reasoningEffort: settings?.optimizeReasoningEffort ?? ''
    }
  )
  const modelConfigured = route.provider.trim() !== '' && route.model.trim() !== ''

  const handleClick = async () => {
    if (state.kind === 'optimizing') return
    const draft = draftRef.current.trim()
    if (draft === '') {
      setState({ kind: 'error', message: t('optimizeEmpty') })
      return
    }

    // Resolve the route at click time. Following the composer asks the **Host**
    // (it owns the settings document and the Session's durable selection; the
    // browser only holds a render-time snapshot whose backing store can
    // legitimately read `null` while the model catalog warms up). The shared
    // resolver never rejects, so a failed RPC cannot turn this handler into an
    // unhandled rejection — it degrades to the snapshot this button renders
    // from. See `src/client/assist-route.ts`.
    let current: EffectiveModelRoute | null = null
    try {
      const resolved = await resolveAssistRoute(
        remote,
        settings,
        'optimize',
        sessionId,
        // Fresh read rather than the render-time value: the click may land in
        // the same tick as a model switch.
        composerModel.read()
      )
      current = resolved?.route ?? null
    } catch {
      // Unreachable by construction (the resolver catches internally), but a
      // click handler must never die silently.
      current = null
    }
    if (current === null) {
      setState({ kind: 'error', message: t('optimizeNotConfigured') })
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState({ kind: 'optimizing' })

    try {
      // Extract conversation context based on user settings
      const contextTurns = settings?.contextTurns ?? 3
      const context = contextTurns > 0 ? extractConversationContext(chat.legacy.nodes, contextTurns) : ''
      const result = await remote.optimize(
        draft,
        current.provider,
        current.model,
        context,
        current.reasoningEffort,
        sessionId,
        controller.signal
      )
      if (controller.signal.aborted) return
      if (!result.ok) {
        setState({ kind: 'error', message: result.error.message })
        return
      }
      const optimized = result.value.trim()
      if (optimized === '') {
        setState({ kind: 'error', message: t('optimizeFailed') })
        return
      }
      // Always show the comparison panel, even when the model returned the
      // text unchanged — silently closing after a visible loading state
      // reads as "the button did nothing".
      setState({ kind: 'result', original: draft, optimized })
    } catch (error) {
      if (controller.signal.aborted) return
      setState({ kind: 'error', message: error instanceof Error ? error.message : t('optimizeFailed') })
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const handleAdopt = () => {
    if (state.kind !== 'result') return
    inputActions.setDraft(state.optimized)
    setState({ kind: 'idle' })
  }

  const handleCancel = () => {
    setState({ kind: 'idle' })
  }

  const busy = state.kind === 'optimizing'
  const disabled = busy || !modelConfigured
  const buttonTitle = modelConfigured ? t('optimizeButton') : t('optimizeNotConfigured')

  const errorToast = state.kind === 'error' ? (
    <ErrorToastPortal
      message={state.message}
      onDismiss={handleCancel}
    />
  ) : null

  const confirmModal = state.kind === 'result' ? (
    <ConfirmModalPortal
      title={t('optimizePanelTitle')}
      originalLabel={t('optimizeOriginalLabel')}
      optimizedLabel={t('optimizeOptimizedLabel')}
      original={state.original}
      optimized={state.optimized}
      adoptLabel={t('optimizeAdopt')}
      cancelLabel={t('optimizeCancel')}
      onAdopt={handleAdopt}
      onCancel={handleCancel}
    />
  ) : null

  return (
    <>
      <div style={containerStyle}>
        <button
          type="button"
          aria-label={buttonTitle}
          title={buttonTitle}
          disabled={disabled}
          onClick={handleClick}
          style={buttonStyle(disabled)}
        >
          <SparkleIcon />
          {busy ? t('optimizeBusy') : ''}
        </button>
      </div>
      {errorToast}
      {confirmModal}
    </>
  )
}

/** Ctrl/Cmd+A inside a `<pre>` selects only that block's text. */
function selectAllInPre(e: KeyboardEvent<HTMLPreElement>) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    const range = document.createRange()
    range.selectNodeContents(e.currentTarget)
    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }
}

function OptimizeConfirmPanel(props: {
  title: string
  originalLabel: string
  optimizedLabel: string
  original: string
  optimized: string
  adoptLabel: string
  cancelLabel: string
  onAdopt: () => void
  onCancel: () => void
}) {
  return (
    <div style={modalContentStyle}>
      <div style={panelTitleStyle}>{props.title}</div>
      <div style={compareRowStyle}>
        <div style={compareColStyle}>
          <div style={compareLabelStyle}>{props.originalLabel}</div>
          <pre style={preStyle} tabIndex={0} onKeyDown={selectAllInPre}>{props.original}</pre>
        </div>
        <div style={compareColStyle}>
          <div style={compareLabelStyle}>{props.optimizedLabel}</div>
          <pre style={{ ...preStyle, borderColor: 'var(--dsw-alias-state-business-primary, #4f8cff)' }} tabIndex={0} onKeyDown={selectAllInPre}>{props.optimized}</pre>
        </div>
      </div>
      <div style={panelActionsStyle}>
        <button type="button" style={cancelBtnStyle} onClick={props.onCancel}>{props.cancelLabel}</button>
        <button type="button" style={adoptBtnStyle} onClick={props.onAdopt}>{props.adoptLabel}</button>
      </div>
    </div>
  )
}

/**
 * Comparison modal portalled to `document.body`. DSH renders slot content
 * inside shadow roots whose ancestors may clip or contain fixed-position
 * children, so the overlay must escape the component tree entirely.
 */
function ConfirmModalPortal(props: {
  title: string
  originalLabel: string
  optimizedLabel: string
  original: string
  optimized: string
  adoptLabel: string
  cancelLabel: string
  onAdopt: () => void
  onCancel: () => void
}) {
  return createPortal(
    <div
      style={modalOverlayStyle}
      onClick={(e) => {
        // Ignore clicks that finish a text drag-select (selection not
        // collapsed), so releasing the mouse outside the modal neither
        // closes it nor loses the selection.
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) return
        props.onCancel()
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <OptimizeConfirmPanel {...props} />
      </div>
    </div>,
    document.body
  )
}

/**
 * Small error modal, also portalled to `document.body` for the same
 * stacking/escaping reasons as the comparison modal.
 */
function ErrorToastPortal({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return createPortal(
    <div
      style={modalOverlayStyle}
      onClick={(e) => {
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) return
        onDismiss()
      }}
    >
      <div style={errorModalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 1 }}>{message}</div>
        <button type="button" style={errorDismissStyle} onClick={onDismiss}>×</button>
      </div>
    </div>,
    document.body
  )
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
      <path
        d="M8 1.5l1.3 3.7L13 6.5l-3.7 1.3L8 11.5 6.7 7.8 3 6.5l3.7-1.3L8 1.5z"
        fill="currentColor"
      />
      <path
        d="M12.5 10.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z"
        fill="currentColor"
        opacity="0.6"
      />
    </svg>
  )
}

/**
 * Minimal structural view of a ConversationNode, read purely for its message
 * text. Declared locally (rather than importing `ConversationNode`) so the
 * extractor does not depend on third-party type resolution of the conversation
 * records package. Matches the fields emitted by `ChatSnapshot.legacy.nodes`.
 */
type ConversationNodeView =
  | { readonly kind: 'user'; readonly content: readonly { readonly type: 'text'; readonly text: string }[] }
  | { readonly kind: 'assistant'; readonly blocks: readonly { readonly kind: 'text'; readonly text: string }[] }

/**
 * Extract recent conversation context from the message array. Returns a
 * plain-text summary of the last N user/assistant turns, formatted as:
 *
 *   User: <message text>
 *   Assistant: <response text (truncated at 500 chars)>
 *
 * Returns an empty string when there are no user/assistant nodes.
 */
function extractConversationContext(nodes: readonly ConversationNodeView[], maxTurns: number): string {
  // chat.legacy.nodes is the ordered message array from the Chat target.
  const relevant: Array<{ role: 'user' | 'assistant'; text: string }> = []
  for (const node of nodes) {
    if (node.kind === 'user') {
      // Extract text from user content blocks.
      const text = node.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('')
      if (text.trim()) relevant.push({ role: 'user', text: text.trim() })
    } else if (node.kind === 'assistant') {
      // Extract text from assistant blocks.
      const text = node.blocks
        .filter((b) => b.kind === 'text')
        .map((b) => b.text)
        .join('')
      if (text.trim()) relevant.push({ role: 'assistant', text: text.trim().slice(0, 500) })
    }
  }

  // Take only the last `maxTurns` turns (a turn = user + assistant pair).
  const recent = relevant.slice(-maxTurns * 2)
  if (recent.length === 0) return ''

  return recent
    .map((entry) => (entry.role === 'user' ? `User: ${entry.text}` : `Assistant: ${entry.text}`))
    .join('\n')
}

// --- Styles ---
// Now rendered inline as a regular item in the `conversation.input.right`
// flex row (left of the microphone button). No more position hacks — order
// in `index.ts` places it on the microphone's immediate left.

const containerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 26,
  flex: 'none'
}

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 26,
  padding: '0 8px',
  border: 'none',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary, inherit)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  fontSize: 12,
  flex: 'none'
})

// "Full-screen" overlay with position:fixed anchored to the viewport so it
// escapes any overflow clipping inside the composer card.
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99998
}

const modalContentStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 10,
  background: 'var(--dsw-alias-bg-layer-2, #fff)',
  border: '1px solid var(--dsw-alias-border-l2, #e0e0e0)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  width: 'min(640px, 92vw)',
  zIndex: 99999
}

const panelTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 10,
  color: 'var(--dsw-alias-label-primary, inherit)'
}

const compareRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  maxHeight: 300
}

const compareColStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0
}

const compareLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--dsw-alias-label-secondary, #888)',
  marginBottom: 4
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 10,
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'auto',
  maxHeight: 240,
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-l2, #e8e8e8)',
  background: 'var(--dsw-alias-bg-layer-1, #f9f9f9)',
  color: 'var(--dsw-alias-label-primary, inherit)',
  fontFamily: 'inherit'
}

const panelActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 12
}

const adoptBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  border: 'none',
  borderRadius: 6,
  background: 'var(--dsw-alias-state-business-primary, #4f8cff)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 13
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 16px',
  border: '1px solid var(--dsw-alias-border-l2, #ddd)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary, inherit)',
  cursor: 'pointer',
  fontSize: 13
}

// Error toast, also portal-rendered on top of everything.
const errorModalStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-2, #fff)',
  border: '1px solid var(--dsw-alias-state-error-secondary, #f5c2c7)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  color: 'var(--dsw-alias-state-error-primary, #c33)',
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  zIndex: 99999,
  maxWidth: 420,
  width: 'min(420px, 90vw)'
}

const errorDismissStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 18,
  padding: 0,
  lineHeight: 1,
  flex: 'none'
}
