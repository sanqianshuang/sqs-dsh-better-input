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

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS, validateSettings, type BetterInputSettings } from '../config.js'

export function defaultSettingsFilePath(): string {
  return join(homedir(), '.dsh', 'sanqianshuang-better-input', 'settings.json')
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Coerce an untrusted stored document into a complete settings object. Every
 * field falls back to its default, so a partially written or hand-edited file
 * still yields a usable value instead of throwing.
 */
export function normalizeSettings(raw: unknown): BetterInputSettings {
  const record = isRecord(raw) ? raw : {}
  return {
    language: text(record.language),
    maxRecordingSeconds: typeof record.maxRecordingSeconds === 'number'
      ? record.maxRecordingSeconds
      : DEFAULT_SETTINGS.maxRecordingSeconds,
    polishingEnabled: record.polishingEnabled !== false,
    polishProvider: text(record.polishProvider),
    polishModel: text(record.polishModel),
    polishReasoningEffort: text(record.polishReasoningEffort),
    polishPrompt: typeof record.polishPrompt === 'string' ? record.polishPrompt : '',
    optimizeEnabled: record.optimizeEnabled !== false,
    optimizeProvider: text(record.optimizeProvider),
    optimizeModel: text(record.optimizeModel),
    optimizeReasoningEffort: text(record.optimizeReasoningEffort),
    optimizePrompt: typeof record.optimizePrompt === 'string' ? record.optimizePrompt : '',
    contextTurns: typeof record.contextTurns === 'number' ? record.contextTurns : DEFAULT_SETTINGS.contextTurns,
  }
}

export class SettingsStore {
  private cache: BetterInputSettings | undefined
  private persistChain: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string = defaultSettingsFilePath()) {}

  /** Read the current settings, falling back to defaults when absent/corrupt. */
  async load(): Promise<BetterInputSettings> {
    if (this.cache !== undefined) return this.cache
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        this.cache = { ...DEFAULT_SETTINGS }
        return this.cache
      }
      throw error
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      await this.quarantineCorruptFile()
      this.cache = { ...DEFAULT_SETTINGS }
      return this.cache
    }
    this.cache = normalizeSettings(parsed)
    return this.cache
  }

  /**
   * Merge a patch into the stored settings and persist. Validates the merged
   * document first, so an out-of-range value never reaches disk.
   */
  async merge(patch: Partial<BetterInputSettings>): Promise<BetterInputSettings> {
    const current = await this.load()
    const next: BetterInputSettings = { ...current }
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) (next as unknown as Record<string, unknown>)[key] = value
    }
    validateSettings(next)
    await this.persist(next)
    return next
  }

  private async quarantineCorruptFile(): Promise<void> {
    try {
      await rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`)
      console.warn('[sanqianshuang-better-input] settings file was corrupt; moved aside and started fresh')
    } catch {
      // Best effort: the next atomic write recreates the file anyway.
    }
  }

  private async persist(settings: BetterInputSettings): Promise<void> {
    const write = this.persistChain.catch(() => undefined).then(() => this.writeAtomic(settings))
    this.persistChain = write
    await write
    this.cache = settings
  }

  /** Write via temp file + rename so a crash never leaves a half-written file. */
  private async writeAtomic(settings: BetterInputSettings): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    await rename(temporary, this.filePath)
  }
}
