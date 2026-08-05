import { useTranslation } from 'react-i18next'
import { FiGithub } from 'react-icons/fi'

// Måned er 0-indeksert, som i Date
const LAST_UPDATED_MONTH_INDEX = 7
const LAST_UPDATED_YEAR = 2026

export function FooterSection() {
  const { t, i18n } = useTranslation()
  const lastUpdated = new Date(LAST_UPDATED_YEAR, LAST_UPDATED_MONTH_INDEX, 1)
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long' }).format(lastUpdated)

  return (
    <footer
      aria-label={t('footer.label')}
      className="panel mx-auto w-full max-w-6xl rounded-2xl px-5 py-4 text-center"
    >
      <p className="mb-3 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('footer.tagline')}
      </p>

      <a
        href="https://github.com/EmilB04"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hover)] hover:text-[var(--accent)]"
        style={{ color: 'var(--text)', borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <FiGithub aria-hidden="true" size={16} />
        <span>{t('footer.github')}</span>
      </a>

      <p className="m-0 text-sm" style={{ color: 'var(--text-muted)' }}>
        {t('footer.madeBy')}{' '}
        <a
          href="https://emilb.no"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline underline-offset-2 hover:text-[var(--accent)]"
          style={{ color: 'var(--text)' }}
        >
          Emil Berglund
        </a>
        <span className="mx-2" style={{ color: 'var(--text-subtle)' }} aria-hidden="true">
          •
        </span>
        <span>{t('footer.updated', { month: monthName, year: LAST_UPDATED_YEAR })}</span>
      </p>
    </footer>
  )
}
