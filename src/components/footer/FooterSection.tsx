import { useTranslation } from 'react-i18next'
import { FiGithub } from 'react-icons/fi'
import { Icon } from '../Icon'

// Måned er 0-indeksert, som i Date
const LAST_UPDATED_MONTH_INDEX = 7
const LAST_UPDATED_YEAR = 2026

/**
 * Kolofonen: siste siden i feltboka. En tynn messinglinje, kompasset, og hvem
 * som tegnet kartet — som i et trykt atlas.
 */
export function FooterSection() {
  const { t, i18n } = useTranslation()
  const lastUpdated = new Date(LAST_UPDATED_YEAR, LAST_UPDATED_MONTH_INDEX, 1)
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(lastUpdated)

  return (
    <footer
      aria-label={t('footer.label')}
      className="mx-auto w-full max-w-6xl px-5 py-6 text-center"
    >
      <div
        className="mx-auto mb-4 flex items-center justify-center gap-3"
        style={{ color: 'var(--text-subtle)' }}
      >
        <span className="h-px flex-1" style={{ background: 'color-mix(in srgb, var(--brass) 45%, transparent)' }} />
        <Icon name="compass" className="h-4 w-4" style={{ color: 'var(--brass)' }} />
        <span className="h-px flex-1" style={{ background: 'color-mix(in srgb, var(--brass) 45%, transparent)' }} />
      </div>

      <p className="eyebrow mb-3">{t('footer.tagline')}</p>

      <p className="m-0 text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('footer.madeBy')}{' '}
        <a
          href="https://emilb.no"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2 hover:text-[var(--accent)]"
          style={{ color: 'var(--text)' }}
        >
          Emil Berglund
        </a>
        <span className="mx-2" style={{ color: 'var(--text-subtle)' }} aria-hidden="true">
          ·
        </span>
        <span>{t('footer.updated', { month: monthName, year: LAST_UPDATED_YEAR })}</span>
      </p>

      <a
        href="https://github.com/EmilB04"
        target="_blank"
        rel="noopener noreferrer"
        className="tag mx-auto mt-4 inline-flex h-9 items-center text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hover)] hover:text-[var(--accent)]"
        style={{ color: 'var(--text)' }}
      >
        <FiGithub aria-hidden="true" size={14} />
        <span>{t('footer.github')}</span>
      </a>
    </footer>
  )
}
