import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_AUTO_STOP_SECONDS, MAX_SEGMENT_SECONDS, MIN_AUTO_STOP_SECONDS, MIN_SEGMENT_SECONDS, SPEECH_LANGUAGE_HINTS, SPEECH_MAX_RECORDING_SECONDS, type BetterInputSettings, type BetterInputSettingsPatch, type ReasoningEffortInfo } from '../config.js'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsController, UpdateSnapshot } from './settings-controller.js'
import { useAboutSnapshot, useEffortsSnapshot, useSettingsSnapshot, useRoutesSnapshot, useSpeechSnapshot, useUpdateSnapshot } from './settings-controller.js'
import type { ComposerModelSource } from './composer-model.js'

/** The framework-injected `t` seat for the BetterInput namespace. */
type Translate = TranslateNS<'better-input'>

/** Endonyms: a language picker is more useful in the language itself. */
const SPEECH_LANGUAGE_NAMES: Record<string, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어'
}

function speechLanguageLabel(hint: string, t: Translate): string {
  if (hint === 'yue') return t('languageCantonese')
  return SPEECH_LANGUAGE_NAMES[hint] ?? hint
}

/** Host-owned preparation phases that are still in flight. */
function isPreparingPhase(phase: string): boolean {
  return phase === 'checking' || phase === 'loading' || phase === 'waking' || phase === 'cancelling' || phase === 'downloading'
}

function ReasoningEffortSelect(props: {
  settingsController: SettingsController
  provider: string
  model: string
  storedEffort: string
  onChange: (effortId: string) => void
  /** Rendered but inert while the feature follows the composer's model. */
  disabled?: boolean
  t: Translate
}) {
  const { settingsController, provider, model, storedEffort, onChange, disabled = false, t } = props
  const efforts = useEffortsSnapshot(settingsController)

  // Kick off the lazy fetch whenever the selected model changes.
  useEffect(() => {
    if (provider === '' || model === '') return
    void settingsController.ensureEffortsFor(provider, model)
  }, [settingsController, provider, model])

  if (provider === '' || model === '') return null
  const key = `${provider}\u0000${model}`
  const entry = efforts[key]

  // Not yet requested / loading → show a disabled placeholder so the user
  // knows the field exists but is warming up.
  if (entry === undefined || entry.status === 'loading') {
    return (
      <select value="" disabled={true} style={inputStyle}>
        <option value="">{t('effortLoadingLabel')}</option>
      </select>
    )
  }
  if (entry.status === 'error' || entry.efforts.length === 0) {
    // Nothing to show; silently hide like the "no efforts" case so the UI
    // doesn't constantly surface adapter metadata misses for regular models.
    return null
  }
  // The default option means "let the Host decide" — it prefers the model's
  // `off` tier, so we no longer surface the adapter's defaultEffort here.
  const items: readonly ReasoningEffortInfo[] = entry.efforts
  return (
    <select
      value={storedEffort}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      style={inputStyle}
    >
      <option value="">{t('effortDefaultLabel')}</option>
      {items.map((effort) => (
        <option key={effort.id} value={effort.id} title={effort.description}>
          {effort.name}
        </option>
      ))}
    </select>
  )
}

export type SettingsSectionProps = {
  readonly close: () => void
  readonly t: Translate
  readonly settingsController: SettingsController
  /** The composer's model selection, so the model rows can follow the input box. */
  readonly composerModels: ComposerModelSource
}

type FieldState = {
  text: string
  invalid: boolean
}

/**
 * The BetterInput settings page. Renders the recognition and polishing
 * configuration; every field edits a local draft and saves on blur/change.
 */
export function BetterInputSettingsSection({ close, settingsController, composerModels, t }: SettingsSectionProps) {
  const settings = useSettingsSnapshot(settingsController)
  const routes = useRoutesSnapshot(settingsController)
  const about = useAboutSnapshot(settingsController)
  const update = useUpdateSnapshot(settingsController)
  const speech = useSpeechSnapshot(settingsController)
  // The model the composer is currently on. The settings page is session-less,
  // so this follows dsh's main-view Session binding; when the plugin is absent
  // it is `null` and the rows fall back to the configured route.
  const composerFace = useMemo(() => composerModels.activeFace(), [composerModels])
  const composerModel = composerFace.useCurrent()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saveFailed, setSaveFailed] = useState(false)
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false)
  const [showDefaultOptimizePrompt, setShowDefaultOptimizePrompt] = useState(false)
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  useEffect(() => {
    void settingsController.refreshSettings()
    void settingsController.refreshRoutes()
    void settingsController.refreshAbout()
    void settingsController.refreshSpeechStatus()
  }, [settingsController])

  // While dsh prepares a recognizer (first-use model download), poll so the
  // page shows real progress; preparation is Host-owned and outlives a reload.
  // A short poll also covers the moment after Host start, when the local
  // provider is still inspecting its model cache and the roster is empty.
  const speechAwaitingRoster = speech.status === 'ready' && speech.view.service && !speech.view.available
  const speechPreparing = speech.preparing || speech.view.providers.some((provider) => isPreparingPhase(provider.preparation))
  useEffect(() => {
    if (!speechPreparing && !speechAwaitingRoster) return
    // Bounded: the roster settles within a few seconds of Host start, and an
    // endless poll would keep a dead service busy forever.
    let remaining = 20
    const timer = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) clearInterval(timer)
      void settingsController.refreshSpeechStatus()
    }, 1000)
    return () => clearInterval(timer)
  }, [settingsController, speechPreparing, speechAwaitingRoster])

  if (settings.status === 'loading' || routes.status === 'loading') {
    return <SectionFrame title={t('settingsTitle')}>{t('loading')}</SectionFrame>
  }

  const field = (name: string, current: string): FieldState => ({
    text: drafts[name] ?? current,
    invalid: false
  })

  const setField = (name: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [name]: value }))
  }

  const save = async (patch: BetterInputSettingsPatch) => {
    setSaveFailed(false)
    const ok = await settingsController.update(patch)
    if (ok) {
      setDrafts((prev) => {
        const next = { ...prev }
        for (const key of Object.keys(patch)) delete next[key]
        return next
      })
    } else {
      setSaveFailed(true)
    }
  }

  const s = settings.view.settings
  const secondsField = field('maxRecordingSeconds', String(s.maxRecordingSeconds))
  const segmentField = field('segmentSeconds', String(s.segmentSeconds))
  const autoStopField = field('autoStopSeconds', String(s.autoStopSeconds))
  const polishPromptField = field('polishPrompt', s.polishPrompt)
  const optimizePromptField = field('optimizePrompt', s.optimizePrompt)
  const contextTurnsField = field('contextTurns', String(s.contextTurns))
  const maxRecordingSeconds = speech.view.available ? speech.view.maxRecordingSeconds : SPEECH_MAX_RECORDING_SECONDS
  // The recognizer `resolve()` will actually pick: the saved selection, or the
  // first registered one when nothing has been chosen yet.
  const provider = speech.view.providers.find((item) => item.id === speech.view.selection?.providerId) ?? speech.view.providers[0]
  const speechReady = provider !== undefined && (provider.preparation === 'ready' || provider.preparation === 'standby')
  const speechNeedsPrepare = provider !== undefined && !speechReady && !isPreparingPhase(provider.preparation)

  return (
    <SectionFrame title={t('settingsTitle')}>
      <p style={hintStyle}>{t('settingsDescription')}</p>

      {saveFailed ? <p style={errorStyle}>{t('saveFailed')}</p> : null}

      <h3 style={sectionTitleStyle}>{t('voiceSectionLabel')}</h3>

      <Field label={t('speechStatusLabel')} hint={speech.status === 'error' ? speech.detail : speech.view.detail}>
        <div style={statusRowStyle}>
          <span style={speechReady ? statusOkStyle : statusWarnStyle}>
            {speech.status === 'loading'
              ? t('loading')
              : speechReady
                ? `${provider?.name ?? ''} · ${t('speechStatusReady')}`
                : speech.view.service && !speech.view.available
                  ? t('speechStatusPreparing')
                  : isPreparingPhase(provider?.preparation ?? '')
                    ? t('speechStatusPreparing')
                    : t('speechStatusUnavailable')}
          </span>
          {provider !== undefined && provider.detail !== '' ? (
            <span style={statusDetailStyle}>{provider.detail}</span>
          ) : null}
          {speechNeedsPrepare ? (
            <button
              type="button"
              style={toggleLinkStyle}
              onClick={() => void settingsController.prepareSpeech(provider?.id ?? '')}
            >
              {t('speechPrepareButton')}
            </button>
          ) : null}
          {speech.preparing ? <span style={statusDetailStyle}>{t('speechPrepareBusy')}</span> : null}
        </div>
      </Field>

      <Field label={t('languageLabel')} hint={t('languageHint')}>
        <select
          value={s.language}
          onChange={(event) => void save({ language: event.target.value })}
          style={inputStyle}
        >
          <option value="">{t('languageAuto')}</option>
          {SPEECH_LANGUAGE_HINTS.map((hint) => (
            <option key={hint} value={hint}>
              {speechLanguageLabel(hint, t)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('recordingLimitLabel')} hint={t('recordingLimitHint')}>
        <input
          type="number"
          min={1}
          max={maxRecordingSeconds}
          value={secondsField.text}
          onChange={(event) => setField('maxRecordingSeconds', event.target.value)}
          onBlur={() => {
            const parsed = Number(secondsField.text)
            if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maxRecordingSeconds) return
            void save({ maxRecordingSeconds: parsed })
          }}
          style={inputStyle}
        />
      </Field>

      <Field label={t('streamingPreviewLabel')} hint={t('streamingPreviewHint')}>
        <label style={switchStyle}>
          <input
            type="checkbox"
            checked={s.streamingPreview}
            onChange={(event) => void save({ streamingPreview: event.target.checked })}
          />
          <span>{s.streamingPreview ? t('on') : t('off')}</span>
        </label>
      </Field>

      {s.streamingPreview ? (
        <Field label={t('segmentSecondsLabel')} hint={t('segmentSecondsHint')}>
          <input
            type="number"
            min={MIN_SEGMENT_SECONDS}
            max={MAX_SEGMENT_SECONDS}
            value={segmentField.text}
            onChange={(event) => setField('segmentSeconds', event.target.value)}
            onBlur={() => {
              const parsed = Number(segmentField.text)
              if (!Number.isSafeInteger(parsed) || parsed < MIN_SEGMENT_SECONDS || parsed > MAX_SEGMENT_SECONDS) return
              void save({ segmentSeconds: parsed })
            }}
            style={inputStyle}
          />
        </Field>
      ) : null}

      <Field label={t('autoStopLabel')} hint={t('autoStopHint')}>
        <input
          type="number"
          min={0}
          max={MAX_AUTO_STOP_SECONDS}
          value={autoStopField.text}
          onChange={(event) => setField('autoStopSeconds', event.target.value)}
          onBlur={() => {
            const parsed = Number(autoStopField.text)
            // `0` means "off"; anything else must be a usable window, so a
            // value in 1–2 is rejected rather than stored and repaired later.
            if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_AUTO_STOP_SECONDS) return
            if (parsed !== 0 && parsed < MIN_AUTO_STOP_SECONDS) return
            void save({ autoStopSeconds: parsed })
          }}
          style={inputStyle}
        />
      </Field>

      <h3 style={sectionTitleStyle}>{t('polishSectionLabel')}</h3>

      <Field label={t('polishLabel')} hint={t('polishHint')}>
        <label style={switchStyle}>
          <input
            type="checkbox"
            checked={s.polishingEnabled}
            onChange={(event) => void save({ polishingEnabled: event.target.checked })}
          />
          <span>{s.polishingEnabled ? t('on') : t('off')}</span>
        </label>
      </Field>

      {s.polishingEnabled ? (
        <>
          <Field label={t('polishFollowLabel')} hint={t('polishFollowHint')}>
            <label style={switchStyle}>
              <input
                type="checkbox"
                checked={s.polishFollowInputModel}
                onChange={(event) => void save({ polishFollowInputModel: event.target.checked })}
              />
              <span>{s.polishFollowInputModel ? t('on') : t('off')}</span>
            </label>
          </Field>

          <Field label={t('polishModelLabel')} hint={t('polishModelHint')}>
            {s.polishFollowInputModel ? (
              // Following the input box: show the model the composer is actually
              // on, instead of the stored fallback. At a glance the user can
              // confirm switching the composer model took effect here too.
              <div style={followRowStyle}>
                <span style={followValueStyle}>
                  {composerModel === null
                    ? t('followModelUnknown')
                    : `${composerModel.provider} / ${composerModel.model}`}
                </span>
                <span style={followBadgeStyle}>{t('followModelBadge')}</span>
              </div>
            ) : (
              <select
                value={drafts.polishProvider !== undefined || drafts.polishModel !== undefined
                  ? `${drafts.polishProvider ?? s.polishProvider}\u0000${drafts.polishModel ?? s.polishModel}`
                  : `${s.polishProvider}\u0000${s.polishModel}`}
                onChange={(event) => {
                  const [provider, model] = event.target.value.split('\u0000')
                  void save({ polishProvider: provider ?? '', polishModel: model ?? '' })
                }}
                style={inputStyle}
                disabled={routes.status !== 'ready' || routes.routes.length === 0}
              >
                <option value={'\u0000'}>{t('polishModelNone')}</option>
                {routes.status === 'ready' && routes.routes.map((route) => (
                  <option key={`${route.provider}\u0000${route.model}`} value={`${route.provider}\u0000${route.model}`}>
                    {route.providerName} / {route.modelName}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {(() => {
            // The effort row is shown whether or not the model follows the input
            // box — the two are independent settings. When following, the tiers
            // must be enumerated from the model that will actually run (the
            // composer's), because that is the model whose `efforts` list the
            // Host validates the stored tier against.
            const effortRoute = s.polishFollowInputModel
              ? { provider: composerModel?.provider ?? '', model: composerModel?.model ?? '' }
              : { provider: s.polishProvider, model: s.polishModel }
            return (
              <Field label={t('polishEffortLabel')} hint={t('polishEffortHint')}>
                <ReasoningEffortSelect
                  settingsController={settingsController}
                  provider={effortRoute.provider}
                  model={effortRoute.model}
                  storedEffort={s.polishReasoningEffort}
                  onChange={(effortId) => void save({ polishReasoningEffort: effortId })}
                  t={t}
                />
              </Field>
            )
          })()}

          <Field label={t('polishPromptLabel')} hint={t('polishPromptHint')}>
            <textarea
              value={polishPromptField.text}
              rows={5}
              placeholder={t('polishPromptPlaceholder')}
              onChange={(event) => setField('polishPrompt', event.target.value)}
              onBlur={() => void save({ polishPrompt: polishPromptField.text })}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
            />
            {settings.view.defaultPolishPrompt !== '' ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDefaultPrompt((prev) => !prev)}
                  style={toggleLinkStyle}
                >
                  {showDefaultPrompt ? t('hideDefaultPrompt') : t('showDefaultPrompt')}
                </button>
                {showDefaultPrompt ? (
                  <pre
                    style={{
                      margin: '6px 0 0',
                      padding: 8,
                      maxHeight: 220,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 11,
                      lineHeight: 1.5,
                      background: 'var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))',
                      border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))',
                      borderRadius: 6,
                      fontFamily: 'monospace'
                    }}
                  >
                    {settings.view.defaultPolishPrompt}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </Field>
        </>
      ) : null}

      <h3 style={{ margin: '16px 0 0', fontSize: 14 }}>{t('optimizeSectionLabel')}</h3>

      <Field label={t('optimizeFollowLabel')} hint={t('optimizeFollowHint')}>
        <label style={switchStyle}>
          <input
            type="checkbox"
            checked={s.optimizeFollowInputModel}
            onChange={(event) => void save({ optimizeFollowInputModel: event.target.checked })}
          />
          <span>{s.optimizeFollowInputModel ? t('on') : t('off')}</span>
        </label>
      </Field>

      <Field label={t('optimizeModelLabel')} hint={t('optimizeModelHint')}>
            {s.optimizeFollowInputModel ? (
              <div style={followRowStyle}>
                <span style={followValueStyle}>
                  {composerModel === null
                    ? t('followModelUnknown')
                    : `${composerModel.provider} / ${composerModel.model}`}
                </span>
                <span style={followBadgeStyle}>{t('followModelBadge')}</span>
              </div>
            ) : (
              <select
                value={drafts.optimizeProvider !== undefined || drafts.optimizeModel !== undefined
                  ? `${drafts.optimizeProvider ?? s.optimizeProvider}\u0000${drafts.optimizeModel ?? s.optimizeModel}`
                  : `${s.optimizeProvider}\u0000${s.optimizeModel}`}
                onChange={(event) => {
                  const [provider, model] = event.target.value.split('\u0000')
                  void save({ optimizeProvider: provider ?? '', optimizeModel: model ?? '' })
                }}
                style={inputStyle}
                disabled={routes.status !== 'ready' || routes.routes.length === 0}
              >
                <option value={'\u0000'}>{t('polishModelNone')}</option>
                {routes.status === 'ready' && routes.routes.map((route) => (
                  <option key={`${route.provider}\u0000${route.model}`} value={`${route.provider}\u0000${route.model}`}>
                    {route.providerName} / {route.modelName}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {(() => {
            // See the polish effort row above: the tier is its own setting and
            // stays visible while the model follows the composer.
            const effortRoute = s.optimizeFollowInputModel
              ? { provider: composerModel?.provider ?? '', model: composerModel?.model ?? '' }
              : { provider: s.optimizeProvider, model: s.optimizeModel }
            return (
              <Field label={t('optimizeEffortLabel')} hint={t('optimizeEffortHint')}>
                <ReasoningEffortSelect
                  settingsController={settingsController}
                  provider={effortRoute.provider}
                  model={effortRoute.model}
                  storedEffort={s.optimizeReasoningEffort}
                  onChange={(effortId) => void save({ optimizeReasoningEffort: effortId })}
                  t={t}
                />
              </Field>
            )
          })()}

          <Field label={t('optimizePromptLabel')} hint={t('optimizePromptHint')}>
            <textarea
              value={optimizePromptField.text}
              rows={5}
              placeholder={t('optimizePromptPlaceholder')}
              onChange={(event) => setField('optimizePrompt', event.target.value)}
              onBlur={() => void save({ optimizePrompt: optimizePromptField.text })}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
            />
            {settings.view.defaultOptimizePrompt !== '' ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowDefaultOptimizePrompt((prev) => !prev)}
                  style={toggleLinkStyle}
                >
                  {showDefaultOptimizePrompt ? t('hideDefaultPrompt') : t('showDefaultPrompt')}
                </button>
                {showDefaultOptimizePrompt ? (
                  <pre
                    style={{
                      margin: '6px 0 0',
                      padding: 8,
                      maxHeight: 220,
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 11,
                      lineHeight: 1.5,
                      background: 'var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))',
                      border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))',
                      borderRadius: 6,
                      fontFamily: 'monospace'
                    }}
                  >
                    {settings.view.defaultOptimizePrompt}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </Field>

          <Field label={t('contextTurnsLabel')} hint={t('contextTurnsHint')}>
            <input
              type="number"
              min={0}
              max={20}
              value={contextTurnsField.text}
              onChange={(event) => setField('contextTurns', event.target.value)}
              onBlur={() => {
                const parsed = Number(contextTurnsField.text)
                if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 20) return
                void save({ contextTurns: parsed })
              }}
              style={inputStyle}
            />
          </Field>

      <p style={hintStyle}>
        {t('routesStatus')}: {routes.status === 'ready' ? `${routes.routes.length}` : routes.detail || t('routesUnavailable')}
      </p>

      <hr style={dividerStyle} />

      <AboutUpdateSection
        aboutStatus={about.status}
        version={about.about.version}
        repository={about.about.repository}
        license={about.about.license}
        update={update}
        t={t}
        onCheckUpdate={() => void settingsController.checkForUpdate()}
      />
    </SectionFrame>
  )
}

function AboutUpdateSection(props: {
  aboutStatus: string
  version: string
  repository: string
  license: string
  update: UpdateSnapshot
  t: Translate
  onCheckUpdate: () => void
}) {
  const { aboutStatus, version, repository, license, update, t, onCheckUpdate } = props
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14 }}>{t('aboutTitle')}</h3>
      {aboutStatus === 'ready' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13, opacity: 0.85 }}>
          <span>{t('aboutVersionLabel')}: {version || '—'}</span>
          <span>{t('aboutLicenseLabel')}: {license || '—'}</span>
          {repository !== '' ? (
            <a
              href={repository}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--dsw-alias-state-business-primary, #4f8cff)' }}
            >
              {t('aboutRepositoryLabel')}: {repository}
            </a>
          ) : null}
          {repository !== '' ? (
            <a
              href={`${repository.replace(/\/+$/, '')}/blob/main/CHANGELOG.md`}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--dsw-alias-state-business-primary, #4f8cff)' }}
            >
              {t('aboutChangelogLabel')}
            </a>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          onClick={onCheckUpdate}
          disabled={update.status === 'loading'}
          style={{
            width: 'fit-content',
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))',
            background: 'var(--dsh-color-surface, transparent)',
            color: 'var(--dsw-alias-label-primary, inherit)',
            fontSize: 13,
            cursor: update.status === 'loading' ? 'default' : 'pointer'
          }}
        >
          {update.status === 'loading' ? t('checkingUpdate') : t('checkUpdateButton')}
        </button>
        {update.status === 'ready' && update.update !== null ? (
          (() => {
            const status = update.update.status
            if (status === 'up-to-date') {
              return <p style={hintStyle}>{t('updateUpToDate')}</p>
            }
            if (status === 'unpublished') {
              return <p style={hintStyle}>{t('updateUnpublished')}</p>
            }
            if (status === 'update-available') {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ ...hintStyle, color: 'var(--dsw-alias-state-error-primary, #e5484d)' }}>
                    {t('updateAvailable')}: {update.update.installed} → {update.update.latest}
                  </p>
                  <span style={hintStyle}>{t('updateCommandLabel')}:</span>
                  <code style={codeStyle}>{update.update.updateCommand}</code>
                  <span style={hintStyle}>{t('updateCommandNpxLabel')}:</span>
                  <code style={codeStyle}>{update.update.updateCommandNpx}</code>
                  <span style={hintStyle}>{t('updateCommandPick')}:</span>
                </div>
              )
            }
            return <p style={errorStyle}>{t('updateCheckFailed')}</p>
          })()
        ) : null}
        {update.status === 'error' ? (
          <p style={errorStyle}>{t('updateCheckFailed')}: {update.detail}</p>
        ) : null}
      </div>
    </div>
  )
}

function SectionFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {children}
      <span style={hintStyle}>{hint}</span>
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))',
  background: 'var(--dsw-alias-bg-layer-1, #f9f9f9)',
  color: 'var(--dsw-alias-label-primary, inherit)',
  fontSize: 13
}

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  opacity: 0.7
}

/** The read-only stand-in shown while a model row follows the composer. */
const followRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px dashed var(--dsw-alias-border-l2, rgba(128,128,128,0.4))',
  background: 'var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))',
  fontSize: 13
}

const followValueStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'monospace'
}

const followBadgeStyle: React.CSSProperties = {
  flex: 'none',
  padding: '1px 6px',
  borderRadius: 999,
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.4))',
  fontSize: 11,
  opacity: 0.8
}

const errorStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: 'var(--dsw-alias-state-error-primary, #e5484d)'
}

const statusRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
  fontSize: 13
}

const statusOkStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-state-success-primary, #2f9e44)'
}

const statusWarnStyle: React.CSSProperties = {
  color: 'var(--dsw-alias-state-warning-primary, #b8860b)'
}

const statusDetailStyle: React.CSSProperties = {
  opacity: 0.7,
  fontSize: 12
}

const switchStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13
}

const toggleLinkStyle: React.CSSProperties = {
  marginTop: 6,
  padding: 0,
  border: 'none',
  background: 'none',
  color: 'var(--dsw-alias-state-business-primary, #4f8cff)',
  fontSize: 12,
  cursor: 'pointer',
  textDecoration: 'underline'
}

const dividerStyle: React.CSSProperties = {
  margin: '8px 0',
  border: 'none',
  borderTop: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))'
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '16px 0 0',
  fontSize: 14
}

const codeStyle: React.CSSProperties = {
  padding: '6px 8px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  fontSize: 12,
  fontFamily: 'monospace',
  background: 'var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.03))',
  border: '1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.3))',
  borderRadius: 6
}