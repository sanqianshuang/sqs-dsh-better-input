import type { SnapshotSelectorHook, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client';
import type { BetterInputRemote } from '../remote.js';
import type { ComposerModelFace } from './composer-model.js';
import type { SettingsFace } from './MicrophoneButton.js';
/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>;
/**
 * Props handed to a `conversation.input.right` entry, plus the injected
 * remote and settings face. In dsh 0.1.2 the slot standard kit supplies
 * `useChat` (Chat target snapshot, whose `legacy.nodes` carries the message
 * array) and `useInput` (draft); message history is no longer exposed through
 * a top-level `session` owner.
 */
export type OptimizeButtonProps = {
    readonly useChat: SnapshotSelectorHook<ChatSnapshot>;
    readonly useInput: SnapshotSelectorHook<InputState>;
    readonly inputActions: {
        setDraft(text: string): void;
    };
    readonly remote: BetterInputRemote;
    readonly useSettings: () => SettingsFace;
    /** The composer's selected model for this Session (see composer-model.ts). */
    readonly composerModel: ComposerModelFace;
    readonly t: Translate;
};
/**
 * The ✨ optimize button rendered above the composer card (in
 * `conversation.input.dock`), right-aligned. Click reads the current draft,
 * calls the Host LLM to optimize it, then shows a confirmation panel with
 * the original and optimized text. The draft is replaced only when the user
 * clicks "Adopt".
 */
export declare function OptimizeButton({ useChat, useInput, inputActions, remote, useSettings, composerModel, t }: OptimizeButtonProps): import("react").JSX.Element;
export {};
