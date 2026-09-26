/**
 * Host-side JSON file storage for the plugin's own settings.
 *
 * Location: `~/.dsh/sanqianshuang-better-input/settings.json`.
 *
 * dsh 0.1.7 replaced the old per-plugin `settings.register(namespace, schema)`
 * API with a Loader-entry configuration model (`SettingsForms`, addressed by
 * profile entry id with revision CAS). That model is built for schema-declared
 * plugin *Config* in the composition, not for a plugin's own runtime knobs, and
 * it changes shape between releases.
 *
 * This plugin therefore owns its settings in a plain JSON document, exactly like
 * the template library. That keeps it independent of the settings API churn,
 * keeps writes atomic, and keeps the settings page a normal `settings.section`
 * slot (which is unchanged in 0.1.7).
 */
import { type BetterInputSettings } from '../config.js';
export declare function defaultSettingsFilePath(): string;
/**
 * Coerce an untrusted stored document into a complete settings object. Every
 * field falls back to its default, so a partially written or hand-edited file
 * still yields a usable value instead of throwing.
 */
export declare function normalizeSettings(raw: unknown): BetterInputSettings;
export declare class SettingsStore {
    private readonly filePath;
    private cache;
    private persistChain;
    constructor(filePath?: string);
    /** Read the current settings, falling back to defaults when absent/corrupt. */
    load(): Promise<BetterInputSettings>;
    /**
     * Merge a patch into the stored settings and persist. Validates the merged
     * document first, so an out-of-range value never reaches disk.
     */
    merge(patch: Partial<BetterInputSettings>): Promise<BetterInputSettings>;
    private quarantineCorruptFile;
    private persist;
    /** Write via temp file + rename so a crash never leaves a half-written file. */
    private writeAtomic;
}
