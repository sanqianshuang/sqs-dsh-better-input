import type { SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { type BetterInputSettings, type BetterInputSettingsPatch } from '../config.js';
import type { BetterInputRemote } from '../remote.js';
import type { ComposerModelFace } from './composer-model.js';
import { type VoiceInputSession } from './voice-session.js';
/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>;
/**
 * Standard props the conversation input zone hands to every
 * `conversation.input.right` entry, plus the injected voice session and
 * settings controller face.
 */
export type InputZoneLikeProps = {
    readonly useInput: SnapshotSelectorHook<InputState>;
    readonly inputActions: {
        setDraft(text: string): void;
    };
    readonly voiceSession: VoiceInputSession;
    readonly remote: BetterInputRemote;
    readonly useSettings: () => SettingsFace;
    /** The composer's selected model for this Session (see composer-model.ts). */
    readonly composerModel: ComposerModelFace;
    readonly t: Translate;
};
export type SettingsFace = {
    readonly status: 'loading' | 'ready' | 'error';
    readonly settings: BetterInputSettings;
};
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
export declare function MicrophoneButton({ useInput, inputActions, voiceSession, remote, useSettings, composerModel, t }: InputZoneLikeProps): import("react").JSX.Element;
export interface PolishDraftOptions {
    transcript: string;
    baseDraft: string;
    draftAtStop: string;
    provider: string;
    model: string;
    /** Reasoning effort to forward; `''` asks the Host for its default policy. */
    reasoningEffort: string;
    remote: BetterInputRemote;
    setState: (state: 'idle' | 'error' | 'polish-error' | 'polishing', detail?: string) => void;
    latestDraftRef: {
        current: string;
    };
    actionsRef: {
        current: {
            setDraft(text: string): void;
        };
    };
    polishAbortRef: {
        current: AbortController | null;
    };
}
export declare function polishDraft(options: PolishDraftOptions): Promise<void>;
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
export declare function shouldApplyPolishResult(currentDraft: string, draftAtStop: string, baseDraft: string): boolean;
/** Append transcript to a base draft with one space separator. */
export declare function updateDraft(baseDraft: string, transcript: string): string;
export declare function isSupported(): boolean;
export type { BetterInputSettingsPatch };
