import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type VoiceInputSession } from './voice-session.js';
/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>;
export type RecognitionBarProps = {
    readonly voiceSession: VoiceInputSession;
    readonly t: Translate;
};
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
export declare function VoiceRecognitionBar({ voiceSession, t }: RecognitionBarProps): import("react").JSX.Element | null;
/** `mm:ss`, the stopwatch shown next to the listening label. */
export declare function formatClock(seconds: number): string;
export {};
