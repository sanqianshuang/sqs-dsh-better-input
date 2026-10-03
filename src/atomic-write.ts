/**
 * Atomic JSON document storage, shared by this plugin's two Host-side files
 * (`settings/store.ts` and `templates/store.ts`).
 *
 * Why a shared helper rather than four lines in each store: the two stores used
 * to disagree about the staging name (one suffixed `Date.now()`, the other did
 * not), and neither cleaned up. A name carrying a timestamp makes every failed
 * write a **new** file, so a full disk, a permission error or a crash between
 * `writeFile` and `rename` left one stray `.tmp` per attempt, forever. The rules
 * here — one deterministic name per process, and a `finally`-equivalent cleanup
 * on every failing path — are what make the plugin's temp-file footprint
 * bounded; see the "temporary files" section of `docs/internals.md`.
 *
 * `rename` is the publish step and is atomic within one filesystem, so a reader
 * either sees the previous document or the next one, never a half-written file.
 */

import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

/**
 * The staging path a document is written to before it is published.
 *
 * Deliberately **deterministic**: the pid identifies the process, and a second
 * write from the same process reuses (and overwrites) the leftover of a previous
 * failure instead of adding another file. Exported so the failure contract can be
 * driven directly by the guards.
 */
export function temporaryPathFor(filePath: string): string {
  return `${filePath}.${process.pid}.tmp`
}

/**
 * Write one UTF-8 document so readers never observe a partial file.
 *
 * Creates the parent directory first, writes the staging file, then renames it
 * over the destination. Any failure — un-creatable directory, full disk,
 * permission error, a locked destination — removes the staging file before the
 * error is re-thrown, so a failing save leaves the previous document in place
 * and nothing else behind.
 *
 * @param filePath - destination document path.
 * @param payload - complete file contents.
 */
export async function writeFileAtomic(filePath: string, payload: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const temporary = temporaryPathFor(filePath)
  try {
    await writeFile(temporary, payload, 'utf8')
    await rename(temporary, filePath)
  } catch (error) {
    // Best effort: the original error is the one worth reporting. A cleanup
    // failure must never mask it (and a locked staging file is the caller's
    // environment problem, not a reason to lose the diagnosis).
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

/**
 * How long a dead process's staging file is allowed to sit on disk before a load
 * reaps it. Writes are a few milliseconds of work, so anything this old belongs to
 * a process that is gone — the plugin's Host entry lives as long as the session.
 */
export const STALE_TEMPORARY_MS = 10 * 60 * 1000

/**
 * Remove staging files stranded by processes that are no longer running.
 *
 * The failing-path cleanup above covers every error the process can still observe.
 * It cannot cover the two it cannot: a `SIGKILL` between `writeFile` and `rename`,
 * and a machine losing power in the same window. Those leave the staging file
 * behind, and because the name is deterministic no *later* write is harmed —
 * it is overwritten in place. So this is not about unbounded growth; it is about
 * not leaving an unowned file in dsh's home directory forever.
 *
 * Called on the first load of each document, which happens once per process before
 * any write, and is deliberately narrow: only `<document>.<pid>.tmp` next to the
 * document itself, only when the pid is not ours, and only when the file is older
 * than `maxAgeMs`. Anything else in the directory is somebody else's business.
 *
 * Never throws, and never reports its own failures: failing to reap an orphan must
 * not stop a document from being read.
 *
 * @param filePath - the document whose staging files should be swept.
 * @param maxAgeMs - age above which another process's staging file is orphaned.
 * @returns how many files were removed, for the guards to assert on.
 */
export async function sweepStaleTemporaries(
  filePath: string,
  maxAgeMs: number = STALE_TEMPORARY_MS
): Promise<number> {
  const directory = dirname(filePath)
  const prefix = `${basename(filePath)}.`
  const suffix = '.tmp'
  let removed = 0
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch {
    // A directory that does not exist yet has nothing to sweep.
    return 0
  }
  for (const entry of entries) {
    if (!entry.startsWith(prefix) || !entry.endsWith(suffix)) continue
    const pid = entry.slice(prefix.length, entry.length - suffix.length)
    // Our own staging file is reused by the next write, so leave it alone; a name
    // that is not `<document>.<digits>.tmp` was never written by this helper.
    if (!/^\d+$/.test(pid) || pid === String(process.pid)) continue
    try {
      const info = await stat(join(directory, entry))
      if (Date.now() - info.mtimeMs < maxAgeMs) continue
      await rm(join(directory, entry), { force: true })
      removed += 1
    } catch {
      // Best effort: an orphan we cannot inspect or delete is not worth an error.
    }
  }
  return removed
}
