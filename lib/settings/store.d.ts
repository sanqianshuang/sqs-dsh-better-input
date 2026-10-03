/**
 * Host-side JSON file storage for the plugin's own settings.
 *
 * Location: `$DSH_HOME/sqs-dsh-better-input/settings.json` — dsh's own home
 * (see `src/home.ts`), which is `~/.dsh` unless the launcher overrides it.
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
 * slot (unchanged in 0.2.0-rc.2, the current target).
 */
import { type BetterInputSettings } from '../config.js';
export declare function defaultSettingsFilePath(): string;
/**
 * Coerce an untrusted stored document into a complete settings object. Every
 * field falls back to its default, so a partially written or hand-edited file
 * still yields a usable value instead of throwing.
 *
 * Out-of-range numbers are repaired here, not merely defaulted: `merge()`
 * validates the whole merged document before writing, so a value left over
 * from an older schema (the recording limit used to allow 600 seconds; the
 * ceiling is now dsh's own 120) would otherwise make *every* later save fail.
 * `language` is narrowed onto a hint the local recognizer accepts for the same
 * reason — `speechToText.resolve()` rejects an unadvertised language.
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
