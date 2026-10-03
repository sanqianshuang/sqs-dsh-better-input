import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsController } from './settings-controller.js';
import type { ComposerModelSource } from './composer-model.js';
/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>;
export type SettingsSectionProps = {
    readonly close: () => void;
    readonly t: Translate;
    readonly settingsController: SettingsController;
    /** The composer's model selection, so the model rows can follow the input box. */
    readonly composerModels: ComposerModelSource;
};
/**
 * The BetterInput settings page. Renders the recognition and polishing
 * configuration; every field edits a local draft and saves on blur/change.
 */
export declare function BetterInputSettingsSection({ close, settingsController, composerModels, t }: SettingsSectionProps): import("react").JSX.Element;
export {};
