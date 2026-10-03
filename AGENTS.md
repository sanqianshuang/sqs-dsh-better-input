# AGENTS.md

`sqs-dsh-better-input` — a DeepSeek Harness (dsh) plugin: voice input, AI polishing,
prompt optimization, local prompt templates. Fork of MIT `dsh-better-input`, retargeted at
dsh `0.2.0-rc.2`. Two fork rules: features dsh now ships natively are **removed**, not
duplicated; APIs dsh removed are migrated away from.

> Keep this file minimal — it is auto-loaded into every agent session, so every line is a
> permanent cost. Reasoning, forensics and operational recipes live in
> [docs/internals.md](./docs/internals.md), not here.

## Before calling anything done

```sh
npm install --legacy-peer-deps   # dsh type packages have peer chains npm cannot resolve alone
npm run verify                   # build + bundle + speech + typert + routes + peers
```

Then boot once in a throwaway profile — `verify` cannot see activation failures:

```sh
export DSH_HOME=/tmp/probe       # honoured by dsh; proves composition without touching the live service
# healthy: silent. broken: "1 entry did not activate" / "skipping profile bundle" on STDERR, exit still 0
```

## Hard rules

1. **Never let a peer range exclude the running dsh runtime.** `dsh-app-boot` evaluates peers with
   `semver.satisfies(v, range, { includePrerelease: true })` and silently **demotes the whole
   bundle** on mismatch. `<0.2.0-0` excludes every prerelease of 0.2.0 — use
   `>=0.2.0-rc.2 <0.3.0-0`. Keep dev pins at the exact runtime version.
   - A peer can be needed with no `import` — types reachable from a peer's `.d.ts` count.
   - A **type-only** import must be a **dev dep**, never a peer.
   - Optional dsh services: `ctx.get('name')`, **never** `static inject`.
   - Guard: `npm run check:peers`.

2. **Never ship a Typert manifest without the `model` block** (an object with `services` /
   `events` / `objects` arrays). A failure here kills dsh's built-in loader too: zero definitions
   register and every Typert-gated read breaks, which looks like lost config. Adding or removing
   an RPC means updating **four** places in lockstep: `remote-contract.ts`, `remote.ts`,
   `typert.ts` (invocations **and** `model.services[N].members`), and the service class.
   Guard: `npm run check:typert`.

3. **Keep zod out of the browser bundle.** `src/remote.ts` uses schema-free lazy codecs; a *value*
   import of `remote-contract.js` from the client graph silently adds ~180 kB of zod. Do not add
   zod to client `externals` and do not widen `alwaysBundle`. Guard: `npm run check:bundle`.

4. **Strict codecs need a `create()` factory** — always build them via the `codec()` helper in
   `src/typert.ts`.

5. **`src/` is the only source of truth.** `lib/` is generated; `prepack` overwrites it.

6. **Audio crossing our Remote must be canonical 16 kHz mono PCM16 WAV.** It bypasses dsh's intake
   validation, so drift fails per recording with no compile error. Guard: `npm run check:speech`.

7. **The local recognizer registers asynchronously** (~3 s after Host start). "Service present,
   roster empty" means *warming up*, not *unavailable* — never read the roster once and cache it.

8. **A `conversation.input.dock` child must constrain its own width** — it renders into
   `.composerStack`, which spans the whole column. Read the published variables, never hardcode:

   ```css
   box-sizing: border-box;
   width: calc(100% - 2 * var(--dsh-composer-side-clearance, 16px));
   max-width: var(--dsh-composer-card-max-width, 952px);
   margin: 0 auto;
   flex: none;
   ```

   No check catches this: measure the bar against the composer card in a browser, at ~800 px and
   at ≥1200 px.

## Invariants no guard catches

- **No default export** from the entry — the Loader discards function plugins that have one.
- Client `inject` **omits** `remote.betterInput`: it is mounted via `ctx.remote.$mount`, so
  declaring it on the outer inject deadlocks. Declare it only on the inner `ctx.inject()`.
- New externally visible names go in `src/identity.ts`, never as literals.
- Settings are a **self-owned JSON doc** under `~/.dsh/sqs-dsh-better-input/`, not the settings
  API — `settings.register` was removed in 0.1.7 and is still absent. Out-of-range legacy values
  are **repaired on read** in `settings/store.ts#normalizeSettings`.
- **Only the model follows the composer, never the thinking tier.** `resolveEffortConfig()` only
  forwards a tier the model advertises. Guard: `npm run check:routes`.
- LF everywhere (`.gitattributes`).

## Do not restore

- **File input / OCR** (`src/converter/**`, the `convertFile` RPC, `ocrProvider`): dsh implements
  file input natively. The `convertFile` / `ConvertFileResult` manifest entries must stay deleted —
  those exact deletions triggered rule 2.
- **Web Speech API** (`src/client/web-speech.ts`): on Chrome/Edge it is a cloud recognizer.
- **The native-mic shadow** (`src/client/native-voice-seat.ts`): without it the composer shows two
  microphones running the same recognizer. Read that file's comments before touching it.

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess`, ESM, `NodeNext` `.js` import specifiers in source.
- Code comments in English; `CHANGELOG.md` and incident docs in Chinese, following the existing
  `修复` / `新增` / `变更` / `移除` structure.
