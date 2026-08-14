import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiSettings } from 'react-icons/fi'
import { SUPPORTED_LANGUAGES } from '../../lib/i18n'
import { writePreference } from '../../lib/cookieConsent'
import { ACCENT_PRESETS, type AccentColor } from '../../contexts/accent-context'
import { useAccent } from '../../contexts/useAccent'
import { type Theme } from '../../contexts/theme-context'
import { useTheme } from '../../contexts/useTheme'
import { useGameSettings } from '../../contexts/useGameSettings'
import { useCookieConsent } from '../../contexts/useCookieConsent'
import { forgetProgress } from '../../game/progress'
import { forgetLeaderboard } from '../../game/leaderboard'
import { playSfx } from '../../game/sfx'

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={12 + 6.5 * Math.cos((a * Math.PI) / 180)}
          y1={12 + 6.5 * Math.sin((a * Math.PI) / 180)}
          x2={12 + 9.5 * Math.cos((a * Math.PI) / 180)}
          y2={12 + 9.5 * Math.sin((a * Math.PI) / 180)}
        />
      ))}
    </svg>
  )
}

const THEME_OPTIONS: {
  value: Theme
  labelKey: string
  Icon: () => React.JSX.Element
  activeColor: string
}[] = [
  { value: 'dark', labelKey: 'theme.dark', Icon: MoonIcon, activeColor: '#a5b4fc' },
  { value: 'system', labelKey: 'theme.system', Icon: SystemIcon, activeColor: 'var(--text)' },
  { value: 'light', labelKey: 'theme.light', Icon: SunIcon, activeColor: '#fbbf24' },
]

const INDICATOR_BG: Record<string, string> = {
  dark: 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.5))',
  system: 'linear-gradient(135deg, rgba(156,163,175,0.3), rgba(107,114,128,0.4))',
  light: 'linear-gradient(135deg, rgba(251,191,36,0.4), rgba(249,115,22,0.45))',
}

const INDICATOR_TRANSLATE: Record<string, string> = {
  dark: 'translateX(4px)',
  system: 'translateX(calc(100% + 4px))',
  light: 'translateX(calc(200% + 4px))',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <h3 className="stat-label mb-2 px-1">{title}</h3>
      {children}
    </section>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface)]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {label}
        </span>
        {hint && (
          <span className="block text-xs" style={{ color: 'var(--text-subtle)' }}>
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200"
        style={{ background: checked ? 'var(--accent)' : 'var(--map-idle)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </span>
    </button>
  )
}

export default function SettingsMenu() {
  const { i18n, t } = useTranslation()
  const { theme, currentTheme, setTheme } = useTheme()
  const { accent, setAccent } = useAccent()
  const { sound, motion, setSound, setMotion } = useGameSettings()
  const { consent, accept, decline, showBanner, clearStoredData } = useCookieConsent()
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((language) => language.code === i18n.language)?.code ??
    i18n.resolvedLanguage ??
    'no'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setConfirmClear(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setConfirmClear(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function handleLanguageSelect(code: string) {
    await i18n.changeLanguage(code)
    writePreference('lang', code)
    playSfx('ui')
  }

  function handleClearData() {
    clearStoredData()
    forgetProgress()
    forgetLeaderboard()
    // last på nytt så headeren, ledertavla og nivået starter fra blanke ark
    window.location.reload()
  }

  const consentStatusKey =
    consent === 'accepted'
      ? 'cookieConsent.statusAccepted'
      : consent === 'declined'
        ? 'cookieConsent.statusDeclined'
        : 'cookieConsent.statusUndecided'

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('settingsMenu.settings')}
        onClick={() => setOpen((value) => !value)}
        className={`
          group relative inline-flex h-10 w-10 items-center justify-center rounded-full border
          transition-all duration-200 ease-out motion-reduce:transition-none
          ${
            open
              ? 'border-[var(--accent)] bg-[var(--surface-card)] text-[var(--text)] ring-4 ring-[color:color-mix(in_srgb,var(--accent)_16%,transparent)]'
              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:-translate-y-[1px] hover:border-[var(--border-hover)] hover:bg-[var(--surface-card)] active:translate-y-0 active:scale-[0.985]'
          }
        `}
      >
        <FiSettings
          aria-hidden="true"
          className={`
            h-4 w-4 shrink-0 transition-transform duration-300 ease-out
            ${open ? 'rotate-45 text-[var(--accent)]' : 'text-[var(--text-subtle)] group-hover:text-[var(--text)]'}
          `}
        />
      </button>

      <div
        role="dialog"
        aria-label={t('settingsMenu.settings')}
        // lukket panel er fortsatt i DOM for animasjonen — hold det ute av
        // tab-rekkefølgen og skjermleseren så lenge det er skjult
        aria-hidden={!open}
        inert={!open}
        className={`
          panel absolute right-0 top-[calc(100%+0.6rem)] z-[400] w-[19rem] max-w-[calc(100vw-1.5rem)]
          max-h-[75vh] overflow-y-auto rounded-2xl
          transition-all duration-200 ease-out origin-top-right motion-reduce:transition-none
          ${
            open
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
          }
        `}
      >
        <div className="flex flex-col gap-4 p-4">
          <Section title={t('languageSwitcher.section')}>
            <div
              role="listbox"
              aria-label={t('languageSwitcher.choose')}
              className="flex flex-col gap-1"
            >
              {SUPPORTED_LANGUAGES.map((language) => {
                const selected = language.code === currentLanguage
                return (
                  <button
                    key={language.code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => void handleLanguageSelect(language.code)}
                    className={`
                      flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left
                      transition-all duration-200 ease-out motion-reduce:transition-none
                      ${
                        selected
                          ? 'bg-[color:color-mix(in_srgb,var(--accent)_16%,var(--surface-card))] text-[var(--text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]'
                          : 'text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--text)] active:scale-[0.99]'
                      }
                    `}
                  >
                    <span className="font-medium">{language.label}</span>
                    {selected && (
                      <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t('settingsMenu.appearance')}>
            <div
              className="relative grid grid-cols-3 gap-1 rounded-xl p-1"
              style={{ background: 'var(--map-idle)' }}
            >
              <span
                className="pointer-events-none absolute inset-y-1 rounded-lg transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  width: 'calc(33.333% - 3px)',
                  transform: INDICATOR_TRANSLATE[theme],
                  background: INDICATOR_BG[theme],
                }}
              />
              {THEME_OPTIONS.map(({ value, labelKey, Icon, activeColor }) => {
                const selected = theme === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={t(labelKey)}
                    aria-pressed={selected}
                    onClick={() => setTheme(value)}
                    style={{ color: selected ? activeColor : 'var(--text-subtle)' }}
                    className="relative z-10 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors duration-200 hover:text-[var(--text)]"
                  >
                    <Icon />
                    {t(labelKey)}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t('settingsMenu.accentColor')}>
            <div
              role="listbox"
              aria-label={t('settingsMenu.chooseAccent')}
              className="flex flex-wrap gap-2 px-1"
            >
              {(Object.keys(ACCENT_PRESETS) as AccentColor[]).map((color) => {
                const preset = ACCENT_PRESETS[color]
                const selected = color === accent
                return (
                  <button
                    key={color}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-label={preset.label}
                    title={preset.label}
                    onClick={() => setAccent(color)}
                    className={`
                      flex h-9 w-9 items-center justify-center rounded-full border-2
                      transition-all duration-200 ease-out
                      ${selected ? 'scale-110 border-[var(--accent)]' : 'border-transparent hover:scale-105'}
                    `}
                  >
                    <span
                      aria-hidden="true"
                      className="h-6 w-6 rounded-full ring-1 ring-black/10"
                      style={{ background: preset[currentTheme] }}
                    />
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t('settingsMenu.gameplay')}>
            <Toggle label={t('settingsMenu.sound')} checked={sound} onChange={setSound} />
            <Toggle
              label={t('settingsMenu.reduceMotion')}
              hint={t('settingsMenu.reduceMotionHint')}
              checked={motion === 'reduced'}
              onChange={(value) => setMotion(value ? 'reduced' : 'full')}
            />
          </Section>

          <Section title={t('cookieConsent.section')}>
            <p className="mb-2 px-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
              {t(consentStatusKey)}
            </p>

            {consent === null ? (
              <div className="flex gap-2 px-1">
                <button
                  type="button"
                  onClick={accept}
                  className="flex-1 rounded-xl px-3 py-2 text-xs font-bold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'var(--accent)' }}
                >
                  {t('cookieConsent.accept')}
                </button>
                <button
                  type="button"
                  onClick={decline}
                  className="flex-1 rounded-xl border px-3 py-2 text-xs font-bold transition-colors duration-200 hover:text-[var(--text)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}
                >
                  {t('cookieConsent.decline')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  showBanner()
                  setOpen(false)
                }}
                className="w-full px-1 text-left text-xs font-semibold underline underline-offset-2 hover:text-[var(--text)]"
                style={{ color: 'var(--text-subtle)' }}
              >
                {t('cookieConsent.manage')}
              </button>
            )}

            {confirmClear ? (
              <div className="mt-3 px-1">
                <p className="mb-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {t('cookieConsent.clearConfirm')}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClearData}
                    className="flex-1 rounded-xl px-3 py-2 text-xs font-bold text-white"
                    style={{ background: 'var(--danger)' }}
                  >
                    {t('cookieConsent.clearYes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="flex-1 rounded-xl border px-3 py-2 text-xs font-bold"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}
                  >
                    {t('namePrompt.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="mt-3 w-full px-1 text-left text-xs font-semibold underline underline-offset-2"
                style={{ color: 'var(--danger)' }}
              >
                {t('cookieConsent.clear')}
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
