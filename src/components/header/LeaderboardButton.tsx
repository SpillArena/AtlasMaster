import { useTranslation } from 'react-i18next'
import { Icon } from '../Icon'

interface Props {
  onClick: () => void
}

/** Pille-knapp i headeren som åpner ledertavla. */
export function LeaderboardButton({ onClick }: Props) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      aria-label={t('leaderboard.title')}
      className="flex h-10 items-center justify-center rounded-full border px-3.5 transition-all duration-200 ease-out hover:-translate-y-[1px]"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
      }}
    >
      <Icon name="trophy" className="h-4 w-4" style={{ color: 'var(--accent)' }} />
    </button>
  )
}
