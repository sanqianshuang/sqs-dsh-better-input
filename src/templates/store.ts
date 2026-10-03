/**
 * Host-side JSON file storage for prompt templates.
 *
 * Location: `$DSH_HOME/sqs-dsh-better-input/templates.json` — dsh's own home
 * (see `src/home.ts`), which is `~/.dsh` unless the launcher overrides it. The
 * plugin ships as a flat bundle under node_modules, so anything stored next to
 * the package would be wiped on update — the only durable, dependency-free
 * location is dsh's home directory (Node builtins only).
 *
 * Writes are serialized through a promise chain and performed atomically
 * (temp file + rename). A corrupt file is quarantined aside once with a
 * warning instead of failing every subsequent call.
 */

import { randomUUID } from 'node:crypto'
import { readFile, rename } from 'node:fs/promises'
import {
  MAX_TEMPLATE_COUNT,
  normalizeTags,
  validateTemplateInput,
  type BetterInputTemplate,
  type TemplateInput
} from './model.js'
import { dshHomePath } from '../home.js'
import { sweepStaleTemporaries, writeFileAtomic } from '../atomic-write.js'

export function defaultTemplatesFilePath(): string {
  return dshHomePath('sqs-dsh-better-input', 'templates.json')
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error
}

function isTemplateValue(value: unknown): value is BetterInputTemplate {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.description === 'string' &&
    typeof candidate.content === 'string' &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === 'string') &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number'
  )
}

function sortByRecency(templates: readonly BetterInputTemplate[]): BetterInputTemplate[] {
  return [...templates].sort((left, right) => right.updatedAt - left.updatedAt)
}

export class TemplateStore {
  private cache: readonly BetterInputTemplate[] | undefined
  private persistChain: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string = defaultTemplatesFilePath()) {}

  async list(): Promise<readonly BetterInputTemplate[]> {
    const templates = await this.load()
    return [...templates]
  }

  async save(input: TemplateInput): Promise<BetterInputTemplate> {
    validateTemplateInput(input)
    const templates = await this.load()
    const now = Date.now()
    const existing = input.id === undefined ? undefined : templates.find((template) => template.id === input.id)
    const saved: BetterInputTemplate = {
      id: existing === undefined ? randomUUID() : existing.id,
      name: input.name.trim(),
      description: input.description ?? existing?.description ?? '',
      content: input.content,
      tags: normalizeTags(input.tags ?? existing?.tags ?? []),
      createdAt: existing === undefined ? now : existing.createdAt,
      updatedAt: now
    }
    if (existing === undefined && templates.length >= MAX_TEMPLATE_COUNT) {
      throw new Error(`sqs-dsh-better-input template count limit (${MAX_TEMPLATE_COUNT}) reached`)
    }
    const next =
      existing === undefined
        ? [...templates, saved]
        : templates.map((template) => (template.id === existing.id ? saved : template))
    await this.persist(next)
    return saved
  }

  async remove(id: string): Promise<boolean> {
    const templates = await this.load()
    const next = templates.filter((template) => template.id !== id)
    if (next.length === templates.length) {
      return false
    }
    await this.persist(next)
    return true
  }

  private async load(): Promise<readonly BetterInputTemplate[]> {
    if (this.cache !== undefined) {
      return this.cache
    }
    // Same reason as the settings store: a process killed mid-write leaves its
    // staging file behind, and the first read of the process is where it is reaped.
    await sweepStaleTemporaries(this.filePath)
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        this.cache = []
        return this.cache
      }
      throw error
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      await this.quarantineCorruptFile()
      this.cache = []
      return this.cache
    }
    const entries = Array.isArray(parsed) ? parsed.filter(isTemplateValue) : []
    this.cache = sortByRecency(entries)
    return this.cache
  }

  private async quarantineCorruptFile(): Promise<void> {
    try {
      await rename(this.filePath, `${this.filePath}.corrupt-${Date.now()}`)
      console.warn('[sqs-dsh-better-input] templates file was corrupt; moved aside and started fresh')
    } catch {
      // Best effort: the next atomic write recreates the file anyway.
    }
  }

  private async persist(templates: readonly BetterInputTemplate[]): Promise<void> {
    const sorted = sortByRecency(templates)
    const write = this.persistChain.catch(() => undefined).then(() => this.writeAtomic(sorted))
    this.persistChain = write
    await write
    this.cache = sorted
  }

  /**
   * Write via temp file + rename (atomic publish, no stray staging file on
   * failure) — see `src/atomic-write.ts`, which owns the rule for both of this
   * plugin's documents.
   */
  private async writeAtomic(templates: readonly BetterInputTemplate[]): Promise<void> {
    await writeFileAtomic(this.filePath, `${JSON.stringify(templates, null, 2)}\n`)
  }
}
