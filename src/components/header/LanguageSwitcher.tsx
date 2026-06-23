import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiGlobe } from 'react-icons/fi'
import { SUPPORTED_LANGUAGES } from '../../lib/i18n.ts'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((language) => language.code === i18n.language)?.code ??
    i18n.resolvedLanguage ??
    'no'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
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
    localStorage.setItem('portfolio-lang', code)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('languageSwitcher.choose')}
        onClick={() => setOpen((value) => !value)}
        className={`
                    group relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full
                    border px-3 text-sm font-semibold tracking-[-0.01em]
                    transition-all duration-200 ease-out motion-reduce:transition-none
                    ${open
            ? 'border-[var(--accent)] bg-[var(--surface-card)] text-[var(--text)] shadow-[0_12px_30px_rgba(0,0,0,0.18)] ring-4 ring-[color:color-mix(in_srgb,var(--accent)_16%,transparent)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[0_8px_24px_rgba(0,0,0,0.14)] hover:-translate-y-[1px] hover:border-[var(--border-hover)] hover:bg-[var(--surface-card)] active:translate-y-0 active:scale-[0.985] active:shadow-[0_4px_14px_rgba(0,0,0,0.14)]'
          }
                `}
      >
        <FiGlobe
          aria-hidden="true"
          className={`
                        h-4 w-4 shrink-0
                        transition-colors duration-200 ease-out
                        ${open ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)] group-hover:text-[var(--text)]'}
                    `}
        />

        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className={`
                        h-4 w-4 shrink-0 text-[var(--text-subtle)]
                        transition-all duration-200 ease-out
                        ${open ? 'rotate-180 text-[var(--text)]' : 'group-hover:text-[var(--text)]'}
                    `}
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        className={`
                    absolute left-0 top-[calc(100%+0.6rem)] z-[400] min-w-full overflow-hidden rounded-2xl
                    border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-card)_86%,transparent)]
                    shadow-[0_18px_48px_rgba(0,0,0,0.22)]
                    backdrop-blur-2xl
                    transition-all duration-200 ease-out origin-top motion-reduce:transition-none
                    ${open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0'
          }
                `}
      >
        <div className="p-1.5">
          <div className="px-3 py-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
            {t('languageSwitcher.section')}
          </div>

          <div role="listbox" aria-label={t('languageSwitcher.choose')} className="flex flex-col gap-1">
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
                                        group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left
                                        transition-all duration-200 ease-out motion-reduce:transition-none
                                        ${selected
                      ? 'bg-[color:color-mix(in_srgb,var(--accent)_16%,var(--surface-card))] text-[var(--text)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_30%,transparent)]'
                      : 'text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--text)] active:scale-[0.99]'
                    }
                                    `}
                >
                  <span className="font-medium">{language.label}</span>

                  <span
                    className={`
                                            inline-flex h-5 w-5 items-center justify-center rounded-full
                                            transition-all duration-200
                                            ${selected
                        ? 'bg-[var(--accent)] text-black'
                        : 'bg-transparent text-transparent group-hover:bg-[var(--surface-card)] group-hover:text-[var(--text-subtle)]'
                      }
                                        `}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-3.5 w-3.5"
                    >
                      <path
                        d="M5 10.5l3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}