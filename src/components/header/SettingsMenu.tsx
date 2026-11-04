import { StorageSettings } from '../../ui/SiteShell'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiCheck, FiMonitor, FiMoon, FiSettings, FiSun } from 'react-icons/fi'
import './settings.css'
import { SUPPORTED_LANGUAGES } from '../../lib/i18n'
import { writePreference } from '../../lib/cookieConsent'
import { type Theme } from '../../contexts/theme-context'
import { useTheme } from '../../contexts/useTheme'
import { useGameSettings } from '../../contexts/useGameSettings'
import { playSfx } from '../../game/sfx'

const THEME_OPTIONS = [
  { value: 'dark', labelKey: 'theme.dark', Icon: FiMoon },
  { value: 'system', labelKey: 'theme.system', Icon: FiMonitor },
  { value: 'light', labelKey: 'theme.light', Icon: FiSun },
] satisfies { value: Theme; labelKey: string; Icon: typeof FiSun }[]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <h3 className="settings-label">{title}</h3>
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
      aria-label={label}
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
        style={{ background: checked ? 'var(--color-primary)' : 'var(--map-idle)' }}
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
  const { theme, setTheme } = useTheme()
  const { sound, motion, setSound, setMotion } = useGameSettings()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((language) => language.code === i18n.language)?.code ??
    i18n.resolvedLanguage ??
    'no'

  useEffect(() => {
    if (!open) return

    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        triggerRef.current?.focus()
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleLanguageSelect(code: string) {
    await i18n.changeLanguage(code)
    writePreference('lang', code)
    playSfx('ui')
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('settingsMenu.settings')}
        title={t('settingsMenu.settings')}
        onClick={() => setOpen((value) => !value)}
        className="settings-trigger"
      >
        <FiSettings aria-hidden="true" size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('settingsMenu.settings')}
          className="settings-panel"
        >
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
                    className="settings-language"
                  >
                    <span className="font-medium">{language.label}</span>
                    {selected && (
                      <FiCheck size={14} aria-hidden="true" />
                    )}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title={t('settingsMenu.appearance')}>
            <div className="settings-themes">
              {THEME_OPTIONS.map(({ value, labelKey, Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                >
                  <Icon size={14} aria-hidden="true" />
                  {t(labelKey)}
                </button>
              ))}
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

          <StorageSettings language={i18n.language} onManage={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
