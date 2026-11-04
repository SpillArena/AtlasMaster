import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { LeaderboardRow } from './LeaderboardRow'
import { useBoard } from './useBoard'
import { getName } from '../../game/leaderboard'
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
  const { entries, loading, offline, failed } = useBoard('global', {
    regionId,
    categoryId: 'all',
    mode: 'all',
    pace: 'all',
    limit,
  })
  const me = getName().trim().toLowerCase()

  return (
    <motion.section
      aria-label={t('leaderboard.title')}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 120 }}
      className="w-full rounded-[28px] border border-[var(--border)] bg-[var(--color-surface-elevated)] px-5 py-5 sm:px-7"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-[-0.02em]">
          <Icon name="trophy" className="h-5 w-5 text-[var(--color-primary)]" />
          {t('leaderboard.title')}
          <span className="hud-label">
            {offline ? t('leaderboard.local') : t('leaderboard.global')}
          </span>
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="numeric min-h-11 text-sm font-bold text-[var(--color-primary)] hover:underline hover:underline-offset-4"
        >
          {t('leaderboard.seeAll')} →
        </button>
      </div>

      {loading ? (
        <p role="status" className="py-4 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
          {t('leaderboard.loading')}
        </p>
      ) : failed ? (
        <p role="alert" className="py-4 text-center text-sm" style={{ color: 'var(--danger)' }}>
          {t('leaderboard.error')}
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
              <LeaderboardRow
                entry={entry}
                place={i}
                variant="compact"
                isMe={Boolean(me) && entry.name.trim().toLowerCase() === me}
              />
            </li>
          ))}
        </ol>
      )}
    </motion.section>
  )
}
