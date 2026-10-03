import { useEffect, useRef } from 'react'
import type { SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { DEFAULT_SETTINGS, effectiveRecordingSeconds, resolveInputModelRoute, type BetterInputSettings, type BetterInputSettingsPatch, type ComposerModelRoute, type EffectiveModelRoute } from '../config.js'
import type { BetterInputRemote } from '../remote.js'
import { resolveAssistRoute } from './assist-route.js'
import type { ComposerModelFace } from './composer-model.js'
import { captureFailureMessage, NativeSpeechSession, sessionOptionsFor, type SpeechSessionSettings } from './native-speech.js'
import { isCaptureSupported } from './audio-capture.js'
import { useVoiceInputSession, type VoiceInputSession } from './voice-session.js'

/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>

/**
 * Standard props the conversation input zone hands to every
 * `conversation.input.right` entry, plus the injected voice session and
 * settings controller face.
 */
export type InputZoneLikeProps = {
  readonly useInput: SnapshotSelectorHook<InputState>
  readonly inputActions: {
    setDraft(text: string): void
  }
  readonly voiceSession: VoiceInputSession
  readonly remote: BetterInputRemote
  readonly useSettings: () => SettingsFace
  /** The composer's selected model for this Session (see composer-model.ts). */
  readonly composerModel: ComposerModelFace
  /**
   * The Session this button belongs to. Forwarded with the polish call so dsh's
   * `llm/stream` middleware can attach the per-session transport metadata some
   * provider routes require (see `src/polish/assist-options.ts`).
   */
  readonly sessionId: string
  readonly t: Translate
}

export type SettingsFace = {
  readonly status: 'loading' | 'ready' | 'error'
  readonly settings: BetterInputSettings
}

/**
 * The route polish will call for the current settings and composer selection.
 *
 * Returns `null` when no usable route exists, so callers get one answer to "is
 * polish actually pointed somewhere" instead of repeating the emptiness test.
 * `resolveInputModelRoute` itself always returns a route object — with the
 * thinking tier decoupled from the composer it has no failure branch left — so
 * the pair has to be validated here.
 */
function resolvePolishRoute(
  settings: BetterInputSettings | null,
  composer: ComposerModelRoute | null
): EffectiveModelRoute | null {
  if (settings === null) return null
  const route = resolveInputModelRoute(settings.polishFollowInputModel, composer, {
    provider: settings.polishProvider,
    model: settings.polishModel,
    reasoningEffort: settings.polishReasoningEffort
  })
  if (route.provider.trim() === '' || route.model.trim() === '') return null
  return route
}

/**
 * The microphone button in the composer tool row. Click to start recording,
 * click again to stop.
 *
 * The recording is transcribed by dsh's own local recognizer
 * (`remote.transcribeSpeech` → `ctx.speechToText`, the SenseVoice provider from
 * the optional voice-input bundle) instead of the browser's Web Speech API.
 * While recording, the text of each finished segment streams into the draft;
 * when the user stops, one pass over the whole recording produces the
 * authoritative transcript and AI polishing runs on that.
 */
export function MicrophoneButton({ useInput, inputActions, voiceSession, remote, useSettings, composerModel, sessionId, t }: InputZoneLikeProps) {
  const snapshot = useVoiceInputSession(voiceSession)
  const state = snapshot.state
  const setState = (next: typeof state, detail = '') => voiceSession.setState(next, detail)
  // The model the composer currently has selected; re-renders this button when
  // the user switches it so the "polish configured" hint stays honest.
  const composer = composerModel.useCurrent()
  // The current composer draft, read through the framework's standard `useInput`
  // hook. `InputState` keeps exposing `.draft` in dsh 0.1.2.
  const input = useInput((state) => state)

  const speechRef = useRef<NativeSpeechSession | null>(null)
  const baseDraftRef = useRef('')
  const mountedRef = useRef(true)
  const stopRef = useRef<(() => void) | null>(null)
  const polishAbortRef = useRef<AbortController | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRef = useRef<BetterInputSettings | null>(null)
  /** First non-fatal transcription error of the current session, if any. */
  const speechErrorRef = useRef<Error | null>(null)
  /** Set when capture itself failed, which makes `onEnd` meaningless. */
  const captureFailedRef = useRef(false)
  const settingsFace = useSettings()
  if (settingsFace.status === 'ready') settingsRef.current = settingsFace.settings

  // The latest committed draft. Updated on every input prop change so the
  // polish race check can tell whether the user edited the draft meanwhile.
  const latestDraftRef = useRef(input.draft)
  useEffect(() => {
    latestDraftRef.current = input.draft
  }, [input.draft])

  useEffect(() => {
    mountedRef.current = true
    const stop = voiceSession.onStopRequested(() => stopRef.current?.())
    const cancel = voiceSession.onCancelRequested(() => {
      speechRef.current?.abort()
      polishAbortRef.current?.abort()
    })
    return () => {
      mountedRef.current = false
      stop()
      cancel()
      speechRef.current?.abort()
      speechRef.current = null
      polishAbortRef.current?.abort()
      polishAbortRef.current = null
      clearRecordingTimer(recordingTimerRef)
      voiceSession.meter.reset()
      voiceSession.setState('idle')
    }
  }, [voiceSession])

  const active = state === 'starting' || state === 'recording'
  const busy = state === 'transcribing' || state === 'polishing'

  const settings = settingsFace.status === 'ready' ? settingsFace.settings : settingsRef.current
  const polishingEnabled = settings?.polishingEnabled ?? false
  // The route polish will call: the composer's model when the feature follows the
  // input box (the default), otherwise the route configured in settings — which
  // is also the fallback when the composer's selection cannot be read. The
  // thinking tier is this feature's own setting; it does not follow the composer
  // (see `resolveInputModelRoute`).
  const polishConfigured = polishingEnabled && resolvePolishRoute(settings, composer) !== null

  /** Localized capture failure; the kind decides which sentence the user sees. */
  const captureDetail = (kind: string, message: string): string => {
    if (kind === 'permission') return t('voicePermissionDenied')
    if (kind === 'no-device') return t('voiceNoDevice')
    if (kind === 'unavailable') return t('voiceCaptureUnavailable')
    return message !== '' ? message : t('voiceFailed')
  }

  const startListening = () => {
    if (active || busy) return
    const baseDraft = input.draft
    baseDraftRef.current = baseDraft
    captureFailedRef.current = false
    speechErrorRef.current = null
    voiceSession.meter.reset()
    setState('starting')

    // Writing through one helper keeps the polish race check honest: the
    // reference is always the exact text this session put in the draft.
    const writeDraft = (text: string): string => {
      const next = updateDraft(baseDraft, text)
      latestDraftRef.current = next
      inputActions.setDraft(next)
      return next
    }

    const speechSettings: SpeechSessionSettings = settingsRef.current ?? DEFAULT_SETTINGS
    const session = new NativeSpeechSession(
      sessionOptionsFor(speechSettings, (audio, language, signal) => remote.transcribeSpeech(audio, language, signal), {
        onPreview: (text) => {
          if (!mountedRef.current || captureFailedRef.current) return
          writeDraft(text)
        },
        onError: (error) => {
          const failure = captureFailureMessage(error)
          // `interrupted` means the recording was cancelled on purpose.
          if (failure.kind === 'interrupted') return
          if (failure.kind !== '') {
            // Capture itself failed: no transcript will arrive.
            captureFailedRef.current = true
            voiceSession.meter.reset()
            if (mountedRef.current) setState('error', captureDetail(failure.kind, failure.message))
            return
          }
          // A failed segment or final pass is only worth reporting when it
          // changed the outcome, which the caller decides in `onEnd`.
          speechErrorRef.current ??= error
        },
        onTick: (tick) => {
          if (!mountedRef.current) return
          voiceSession.meter.publish(tick)
        },
        onAutoStop: () => {
          // The session is stopping itself on the silence timeout; the button
          // only follows the state (its own `stopListening` is not involved).
          clearRecordingTimer(recordingTimerRef)
          if (mountedRef.current) setState('transcribing')
        },
        onEnd: (text) => {
          speechRef.current = null
          clearRecordingTimer(recordingTimerRef)
          voiceSession.meter.reset()
          if (!mountedRef.current || captureFailedRef.current) return
          const transcript = text.trim()
          const speechError = speechErrorRef.current
          speechErrorRef.current = null
          if (transcript === '') {
            if (speechError !== null) setState('error', speechError.message)
            else setState('idle')
            return
          }
          const draftAtStop = writeDraft(transcript)
          void finishPolishing(transcript, draftAtStop)
        }
      })
    )

    /**
     * Resolve the polish route and run the assist.
     *
     * One call through the shared resolver (`src/client/assist-route.ts`), which
     * is the same function the settings page's follow row renders from: when the
     * feature follows the composer it asks the Host — the browser's snapshot of
     * the composer selection can legitimately read `null` while the
     * model-selection plugin's Host catalog is warming up, and a local
     * substitute there would quietly polish with the *settings* route, i.e. a
     * different model than the input box displays. When the Host cannot answer
     * (follow off, unreadable selection, failed RPC) it degrades to exactly the
     * route this button's own enable/disable state is computed from, so a
     * readable selection is never silently skipped. The resolver never rejects.
     */
    const finishPolishing = async (transcript: string, draftAtStop: string): Promise<void> => {
      const current = settingsRef.current
      let route: EffectiveModelRoute | null = null
      if (current !== null && current.polishingEnabled) {
        route = (await resolveAssistRoute(remote, current, 'polish', sessionId, composerModel.read()))?.route ?? null
      }
      if (!mountedRef.current) return
      if (route === null) {
        setState('idle')
        return
      }
      void polishDraft({
        transcript,
        baseDraft: baseDraftRef.current,
        draftAtStop,
        provider: route.provider,
        model: route.model,
        reasoningEffort: route.reasoningEffort,
        sessionId,
        remote,
        setState,
        latestDraftRef,
        actionsRef: { current: inputActions },
        polishAbortRef
      })
    }

    speechRef.current = session
    void session.start().then(() => {
      if (!mountedRef.current || speechRef.current !== session) return
      if (!session.active) {
        // `start()` reported the failure through `onError`, which already moved
        // the session into its error state. Leaving `starting` here would strand
        // the status bar on "Listening…" for a recording that never began.
        if (voiceSession.getSnapshot().state === 'starting') setState('idle')
        return
      }
      setState('recording')
      // Auto-stop at the configured recording limit so an abandoned session
      // never holds the microphone forever.
      armRecordingTimer(recordingTimerRef, effectiveRecordingSeconds(settingsRef.current ?? DEFAULT_SETTINGS), () => {
        speechRef.current?.stop()
      })
    })
  }

  const stopListening = () => {
    clearRecordingTimer(recordingTimerRef)
    if (!active) return
    // From here on the microphone is released and the authoritative pass runs;
    // `transcribing` is also what makes this cancellable from the status bar.
    setState('transcribing')
    speechRef.current?.stop()
  }

  stopRef.current = stopListening

  const tooltip = busy
    ? t('voiceBusy')
    : active
      ? t('voiceStop')
      : state === 'polish-error'
        ? t('polishFailedKeepOriginal')
        : state === 'error'
          ? t('voiceFailed')
          : !polishConfigured
            ? `${t('voiceStart')} — ${t('polishNotConfigured')}`
            : t('voiceStart')
  const label = busy ? '…' : active ? t('voiceStop') : t('voiceStart')

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={busy}
      title={tooltip}
      onClick={active ? stopListening : startListening}
      data-better-input-state={state}
      data-better-input-polish-configured={polishConfigured ? 'yes' : 'no'}
      style={buttonStyle(active, busy, !polishConfigured)}
    >
      <MicrophoneIcon />
    </button>
  )
}

export interface PolishDraftOptions {
  transcript: string
  baseDraft: string
  draftAtStop: string
  provider: string
  model: string
  /** Reasoning effort to forward; `''` asks the Host for its default policy. */
  reasoningEffort: string
  /**
   * The Session this polish runs for. Forwarded to the Host so dsh's
   * `llm/stream` middleware can attach per-session transport metadata (see
   * `src/polish/assist-options.ts`); `''` when the caller has no Session.
   */
  sessionId: string
  remote: BetterInputRemote
  setState: (state: 'idle' | 'error' | 'polish-error' | 'polishing', detail?: string) => void
  latestDraftRef: { current: string }
  actionsRef: { current: { setDraft(text: string): void } }
  polishAbortRef: { current: AbortController | null }
}

export async function polishDraft(options: PolishDraftOptions): Promise<void> {
  if (options.provider.trim() === '' || options.model.trim() === '') return
  const controller = new AbortController()
  options.polishAbortRef.current = controller
  options.setState('polishing')

  try {
    const result = await options.remote.polish(
      options.transcript,
      options.provider,
      options.model,
      options.reasoningEffort,
      options.sessionId,
      controller.signal
    )
    if (controller.signal.aborted) return
    if (!shouldApplyPolishResult(options.latestDraftRef.current, options.draftAtStop, options.baseDraft)) {
      options.setState('idle')
      return
    }
    if (!result.ok) {
      options.setState('polish-error', result.error.message)
      return
    }
    const text = result.value.trim() !== '' ? result.value.trim() : options.transcript
    const nextDraft = updateDraft(options.baseDraft, text)
    options.latestDraftRef.current = nextDraft
    options.actionsRef.current.setDraft(nextDraft)
    options.setState('idle')
  } catch (error) {
    if (controller.signal.aborted) return
    options.setState('polish-error', error instanceof Error ? error.message : 'Polishing failed')
  } finally {
    if (options.polishAbortRef.current === controller) options.polishAbortRef.current = null
  }
}

/**
 * Only replace the draft when the user has not edited it since our own last
 * write. Both the text we wrote last (`draftAtStop` — the finished transcript,
 * or the last streamed preview segment) and the untouched base draft count as
 * unchanged.
 *
 * This matters more since the preview became segmented: the text on screen
 * while recording is a *preview*, and the authoritative transcript that arrives
 * after stopping can differ from it. Comparing against the text this session
 * wrote is what keeps a user's mid-recording edit from being overwritten.
 */
export function shouldApplyPolishResult(currentDraft: string, draftAtStop: string, baseDraft: string): boolean {
  const current = collapseDraft(currentDraft)
  return current === collapseDraft(draftAtStop) || current === collapseDraft(baseDraft)
}

function collapseDraft(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function buttonStyle(active: boolean, busy: boolean, polishUnconfigured: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    padding: 0,
    border: 'none',
    borderRadius: 6,
    background: active ? 'var(--dsw-alias-state-business-primary, #4f8cff)' : 'transparent',
    color: active ? '#fff' : 'var(--dsw-alias-label-primary, inherit)',
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.5 : polishUnconfigured ? 0.75 : 1,
    flex: 'none'
  }
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path
        d="M8 1.75a2.25 2.25 0 0 0-2.25 2.25v3.5a2.25 2.25 0 0 0 4.5 0V4A2.25 2.25 0 0 0 8 1.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12.25V14M5.5 14h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

/** Append transcript to a base draft with one space separator. */
export function updateDraft(baseDraft: string, transcript: string): string {
  const text = transcript.trim()
  if (text === '') return baseDraft
  if (baseDraft === '') return text
  if (/\s$/.test(baseDraft) || /^\s/.test(text)) return baseDraft + text
  return `${baseDraft} ${text}`
}

function armRecordingTimer(timerRef: { current: ReturnType<typeof setTimeout> | null }, seconds: number, stop: () => void): void {
  clearRecordingTimer(timerRef)
  timerRef.current = setTimeout(stop, Math.max(1, seconds) * 1000)
}

function clearRecordingTimer(timerRef: { current: ReturnType<typeof setTimeout> | null }): void {
  if (timerRef.current === null) return
  clearTimeout(timerRef.current)
  timerRef.current = null
}

export function isSupported(): boolean {
  return isCaptureSupported()
}

export type { BetterInputSettingsPatch }
