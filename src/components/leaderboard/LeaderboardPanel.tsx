import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { LeaderboardRow } from './LeaderboardRow'
import { useBoard } from './useBoard'
import { Icon } from '../Icon'

interface Props {
  /** regionen dashbordet viser tavla for */
  regionId: string
  /** åpner full ledertavle */
  onSeeAll: () => void
  /** hvor mange plasseringer som får plass på dashbordet */
  limit?: number
}

/**
 * Toppen av den globale tavla, rett på dashbordet. Poengsummer er hele
 * poenget med å spille en runde til — de skal stå framme, ikke bak en knapp.
 */
export function LeaderboardPanel({ regionId, onSeeAll, limit = 5 }: Props) {
  const { t } = useTranslation()
  const { entries, loading, offline } = useBoard('global', regionId, 'all', 'all', limit)

  return (
    <motion.section
      aria-label={t('leaderboard.title')}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 120 }}
      className="panel mx-auto w-full max-w-6xl rounded-2xl p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display flex items-center gap-2 text-lg font-extrabold tracking-[-0.02em]">
          <Icon name="trophy" className="h-5 w-5" style={{ color: 'var(--gold)' }} />
          {t('leaderboard.title')}
          <span className="stat-label">
            {offline ? t('leaderboard.local') : t('leaderboard.global')}
          </span>
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-sm font-bold underline underline-offset-2 transition-colors hover:text-[var(--text)]"
          style={{ color: 'var(--text-subtle)' }}
        >
          {t('leaderboard.seeAll')}
        </button>
      </div>

      {loading ? (
        <p role="status" className="py-4 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
          {t('leaderboard.loading')}
        </p>
      ) : entries.length === 0 ? (
        <p className="py-4 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
          {t('leaderboard.empty')}
        </p>
      ) : (
        <ol>
          {entries.map((entry, i) => (
            <li
              key={entry.id}
              className="border-t first:border-t-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <LeaderboardRow entry={entry} place={i} variant="compact" />
            </li>
          ))}
        </ol>
      )}
    </motion.section>
  )
}
