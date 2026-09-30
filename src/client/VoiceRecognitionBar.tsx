import { useEffect, useRef } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { useVoiceInputSession, useVoiceMeter, type VoiceInputSession } from './voice-session.js'

/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>

export type RecognitionBarProps = {
  readonly voiceSession: VoiceInputSession
  readonly t: Translate
}

/** Bars in the level meter: 22 × 3 px + gaps = the 108 px the CSS reserves. */
const METER_BARS = 22
/** Input level that fills the meter; speech RMS sits well below it. */
const METER_FULL_LEVEL = 0.12
const RING_RADIUS = 7
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
/** Seconds below which the countdown turns red. */
const COUNTDOWN_URGENT_SECONDS = 3

/**
 * The recognition status bar above the composer.
 *
 * Shows the live state, a stopwatch for the current listening session, a level
 * meter fed by the capture's own RMS, and — once the user has spoken and gone
 * quiet — the countdown to the silence auto-stop. Renders nothing when idle.
 *
 * Timer and level come from `session.meter`, a store that only this component
 * subscribes to: they change five times a second, which would otherwise
 * re-render the microphone button (and every other session subscriber) too.
 */
export function VoiceRecognitionBar({ voiceSession, t }: RecognitionBarProps) {
  const snapshot = useVoiceInputSession(voiceSession)
  const meter = useVoiceMeter(voiceSession)

  const active = snapshot.state === 'starting' || snapshot.state === 'recording'
  const busy = snapshot.state === 'transcribing' || snapshot.state === 'polishing'

  // Level history for the meter. Kept in a ref because it is presentation-only
  // and the component already re-renders on every telemetry frame; one frame of
  // lag is invisible at 5 Hz.
  const historyRef = useRef<number[]>([])
  useEffect(() => {
    if (!active) {
      historyRef.current = []
      return
    }
    const next = [...historyRef.current, meter.level]
    if (next.length > METER_BARS) next.splice(0, next.length - METER_BARS)
    historyRef.current = next
  }, [active, meter.level])

  const label = active
    ? t('listening')
    : snapshot.state === 'transcribing'
      ? t('transcribing')
      : snapshot.state === 'polishing'
        ? t('polishing')
        : snapshot.state === 'polish-error'
          ? t('polishFailedKeepOriginal')
          : snapshot.state === 'error'
            ? t('voiceFailed')
            : ''

  if (label === '') return null

  const remaining = active ? meter.autoStopRemainingSeconds : null
  const countdown =
    remaining === null || meter.autoStopSeconds <= 0
      ? null
      : {
          seconds: Math.ceil(remaining),
          fraction: Math.max(0, Math.min(1, remaining / meter.autoStopSeconds))
        }

  return (
    <div
      className="sqs-bi-bar"
      data-better-input-bar="true"
      data-better-input-bar-layout="dock-card"
      data-state={snapshot.state}
      role="status"
    >
      {active ? (
        <span className="sqs-bi-dot" aria-hidden="true" />
      ) : busy ? (
        <span className="sqs-bi-spin" aria-hidden="true" />
      ) : null}
      <span className="sqs-bi-label">{label}</span>
      {active ? (
        <span className="sqs-bi-clock" aria-hidden="true">
          {formatClock(meter.elapsedSeconds)}
        </span>
      ) : null}
      {active ? <LevelMeter history={historyRef.current} /> : null}
      {snapshot.detail !== '' ? <span className="sqs-bi-detail">{snapshot.detail}</span> : null}
      <span className="sqs-bi-space" />
      {countdown !== null ? (
        <span
          className="sqs-bi-count"
          data-urgent={countdown.seconds <= COUNTDOWN_URGENT_SECONDS ? 'true' : 'false'}
          title={t('autoStopTitle', { seconds: meter.autoStopSeconds })}
        >
          <CountdownRing fraction={countdown.fraction} />
          <span aria-hidden="true">{t('autoStopIn', { seconds: countdown.seconds })}</span>
        </span>
      ) : null}
      {active ? (
        <button
          type="button"
          className="sqs-bi-btn"
          data-tone="danger"
          onClick={() => voiceSession.requestStop()}
        >
          {t('voiceStop')}
        </button>
      ) : null}
      {busy ? (
        <button
          type="button"
          className="sqs-bi-btn"
          data-tone="ghost"
          onClick={() => voiceSession.requestCancel()}
        >
          {t('voiceCancel')}
        </button>
      ) : null}
    </div>
  )
}

/** `mm:ss`, the stopwatch shown next to the listening label. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const minutes = Math.floor(total / 60)
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function LevelMeter({ history }: { history: readonly number[] }) {
  const offset = METER_BARS - history.length
  return (
    <span className="sqs-bi-meter" aria-hidden="true">
      {Array.from({ length: METER_BARS }, (_, index) => (
        <i key={index} style={{ height: `${barHeight(index >= offset ? history[index - offset] ?? 0 : 0)}px` }} />
      ))}
    </span>
  )
}

/** Map an RMS level onto a 2–18 px bar; square-root keeps speech readable. */
function barHeight(level: number): number {
  const normalized = Math.sqrt(Math.max(0, Math.min(1, level / METER_FULL_LEVEL)))
  return 2 + Math.round(normalized * 16)
}

function CountdownRing({ fraction }: { fraction: number }) {
  return (
    <svg className="sqs-bi-ring" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle className="sqs-bi-ring-track" cx="8" cy="8" r={RING_RADIUS} />
      <circle
        cx="8"
        cy="8"
        r={RING_RADIUS}
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
      />
    </svg>
  )
}
