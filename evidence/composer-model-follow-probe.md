# Composer-model follow probe — findings (verify profile, 2026-10-03)

Throwaway `verify` profile (`$DSH_HOME=D:\project\DeepseekHarness\.tmp-verify`, port 3091),
running the **rebuilt sqs.2** client bundle, driven over CDP. Composer rendered
`DeepSeek-V41-Flash · High`; the settings page's follow rows rendered
`deepseek-official / deepseek-flash`.

## What each value is

| value | source | how it was read |
|---|---|---|
| `DeepSeek-V41-Flash` | the composer's rendered model | `button[aria-label^="选择模型"].title` |
| `deepseek-official / deepseek-flash` | the session's **stored fallback route** | `betterInput/getSettings` → `settings.polishProvider` / `polishModel` |
| `deepseek-official / deepseek-flash` | dsh's **agent default model** | `betterInput/getSettings` → `defaultRoute` |
| `deepseek-official / deepseek-flash` | the **Host catalog `default`** | `POST /api/session/modelCatalog` → `result.value.default` |

All three fallback-shaped values are the *same string* on this profile, which is why the
row's text alone cannot identify which code path produced it. The distinguishing fact is
that the stored route is rendered **only** when the feature is not following, or when the
composer read returned `null` — and flipping `polishFollowInputModel` / `optimizeFollowInputModel`
to `false` and back to `true` did not change the rendered text, while the composer was on a
different model the whole time.

## Conclusion

**`readFor()` returns `null` on this profile**: the live directory read did not produce the
composer's model. Per dsh's `ModelDirectory.syncInputs()`
(`dsh-client-ui-model-selection/lib/client.js`):

```js
if (catalog.status !== "ready" || catalog.value === null || projected === undefined) {
  this.store.set({ current: catalog.value === null ? null : store.current, … })
  return                       // ← `current` is left unset
}
store.set({ current: projected.next ?? catalog.value.default, … })
```

`current: null` is the **catalog-not-ready** branch. The directory exists, so `entryFor()`
resolves it, and (after the fix) the live directory is authoritative — it answers `null`,
the row falls back to the stored route, and the assist uses the settings route.

This is a **pre-existing dsh-side precondition on a freshly created throwaway profile**, not
a regression introduced here: on a brand-new profile the Host model catalog had not reached
`ready` for the working Session, and this probe profile has no credentials configured
(`defaultRoute` is the placeholder `deepseek-flash`, and the composer's own label is a
different model name than the catalog's group listing of `[deepseek-flash, deepseek-v4-pro]`).
The live desktop profile is the meaningful environment for the follow behaviour.

## What this probe did establish

1. **No freeze on model switch.** Instrumented `requestAnimationFrame` gap during two
   composer model switches: `maxGapMs = 7` and `39`, zero `error` / `unhandledrejection`
   events. The composer followed the switch immediately (`DeepSeek-V41-Flash · High` →
   `DeepSeek-V4-Pro · High` → back).
2. **The plugin's client half activates** in a real dsh web host: its stylesheet tag is
   present, and both composer buttons (`优化提示词`, `语音输入`) render and are clickable.
3. **The catalog default is what a naive fallback would show**, and it is a *different
   model* from the composer's — which is why the fallback boundary matters (see
   `docs/internals.md`). The first build of this change substituted it whenever `live` was
   null, and this probe caught exactly that.

## Not established here

Whether `directory.current` is populated on a profile where the Host model catalog reaches
`ready` (i.e. the live desktop profile). That requires observing the running desktop app,
which exposes no CDP port. Treat "the follow row shows the composer's model" as verified by
the guards and the mechanism, not by this probe.
