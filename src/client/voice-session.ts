import { useSyncExternalStore } from 'react'

export type VoiceInputState = 'idle' | 'starting' | 'recording' | 'transcribing' | 'polishing' | 'error' | 'polish-error'

export type VoiceInputSessionSnapshot = {
  readonly state: VoiceInputState
  readonly detail: string
}

type Listener = () => void
type StopListener = () => void

const NOTICE_STATES = new Set<VoiceInputState>(['error', 'polish-error'])
export const VOICE_ERROR_DISMISS_MS = 2600

/**
 * Live recording telemetry for the status bar: elapsed time, input level and
 * the silence auto-stop countdown.
 *
 * Deliberately a **separate** store from the session state: it updates five
 * times a second while recording, and the microphone button (which also
 * subscribes to the session) has no use for it. `getSnapshot` returns a cached
 * object so an unchanged frame does not re-render anything — required by
 * `useSyncExternalStore`.
 */
export type VoiceMeterSnapshot = {
  readonly elapsedSeconds: number
  readonly level: number
  /** Configured silence window in seconds, `0` when the auto-stop is off. */
  readonly autoStopSeconds: number
  /** Seconds left before the auto-stop, `null` when no countdown is running. */
  readonly autoStopRemainingSeconds: number | null
}

export const EMPTY_VOICE_METER: VoiceMeterSnapshot = Object.freeze({
  elapsedSeconds: 0,
  level: 0,
  autoStopSeconds: 0,
  autoStopRemainingSeconds: null
})

export class VoiceMeter {
  private snapshot: VoiceMeterSnapshot = EMPTY_VOICE_METER
  private readonly listeners = new Set<Listener>()

  readonly getSnapshot = (): VoiceMeterSnapshot => this.snapshot

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  publish(next: VoiceMeterSnapshot): void {
    const current = this.snapshot
    if (
      current.elapsedSeconds === next.elapsedSeconds &&
      current.level === next.level &&
      current.autoStopSeconds === next.autoStopSeconds &&
      current.autoStopRemainingSeconds === next.autoStopRemainingSeconds
    ) {
      return
    }
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }

  reset(): void {
    this.publish(EMPTY_VOICE_METER)
  }

  dispose(): void {
    this.listeners.clear()
    this.snapshot = EMPTY_VOICE_METER
  }
}

/**
 * Shared voice-input state for one session, written from scratch for
 * sqs-dsh-better-input. The microphone button and the recognition bar both
 * subscribe; the bar can request stop/cancel through the same instance.
 */
export class VoiceInputSession {
  /** Recording telemetry, subscribed to only by the recognition bar. */
  readonly meter = new VoiceMeter()

  private snapshot: VoiceInputSessionSnapshot = { state: 'idle', detail: '' }
  private readonly listeners = new Set<Listener>()
  private readonly stopListeners = new Set<StopListener>()
  private readonly cancelListeners = new Set<StopListener>()
  private epoch = 0
  private errorTimer: ReturnType<typeof setTimeout> | undefined

  captureEpoch(): number {
    return this.epoch
  }

  isCurrentEpoch(epoch: number): boolean {
    return this.epoch === epoch
  }

  readonly getSnapshot = (): VoiceInputSessionSnapshot => this.snapshot

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly onStopRequested = (listener: StopListener): (() => void) => {
    this.stopListeners.add(listener)
    return () => this.stopListeners.delete(listener)
  }

  readonly onCancelRequested = (listener: StopListener): (() => void) => {
    this.cancelListeners.add(listener)
    return () => this.cancelListeners.delete(listener)
  }

  setState(state: VoiceInputState, detail = ''): void {
    const nextDetail = NOTICE_STATES.has(state) ? detail : ''
    if (this.snapshot.state === state && this.snapshot.detail === nextDetail) return
    this.clearErrorTimer()
    this.snapshot = { state, detail: nextDetail }
    this.emit()
    if (NOTICE_STATES.has(state)) {
      this.errorTimer = setTimeout(() => {
        this.errorTimer = undefined
        if (NOTICE_STATES.has(this.snapshot.state)) this.setState('idle')
      }, VOICE_ERROR_DISMISS_MS)
    }
  }

  requestStop(): void {
    for (const listener of this.stopListeners) listener()
  }

  requestCancel(): void {
    if (this.snapshot.state !== 'transcribing' && this.snapshot.state !== 'polishing') return
    this.epoch += 1
    for (const listener of this.cancelListeners) listener()
    this.setState('idle')
  }

  dispose(): void {
    this.clearErrorTimer()
    this.meter.dispose()
    this.listeners.clear()
    this.stopListeners.clear()
    this.cancelListeners.clear()
  }

  private clearErrorTimer(): void {
    if (this.errorTimer === undefined) return
    clearTimeout(this.errorTimer)
    this.errorTimer = undefined
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export function useVoiceInputSession(session: VoiceInputSession): VoiceInputSessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
}

/** Subscribe to the live recording telemetry of one session. */
export function useVoiceMeter(session: VoiceInputSession): VoiceMeterSnapshot {
  return useSyncExternalStore(session.meter.subscribe, session.meter.getSnapshot, session.meter.getSnapshot)
}
