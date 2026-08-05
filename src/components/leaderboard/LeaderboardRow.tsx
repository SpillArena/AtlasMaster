import { useTranslation } from 'react-i18next'
import { getCategory } from '../../game/categories'
import type { Entry } from '../../game/leaderboard'
import { hitRate } from '../../game/rank'
import { Icon } from '../Icon'

/** Farge på plasseringen — gull, sølv, bronse, så dempet. */
const RANK_TONE = ['var(--gold)', '#c0c6d4', '#c47b3d']

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  entry: Entry
  /** 0-indeksert plassering */
  place: number
  /** 'compact' brukes på dashbordet, der plassen er trangere */
  variant?: 'full' | 'compact'
}

/** Én rad på ledertavla — samme rad på dashbordet og på full tavle. */
export function LeaderboardRow({ entry, place, variant = 'full' }: Props) {
  const { t } = useTranslation()
  const cat = getCategory(entry.categoryId)
  const pct = Math.round(hitRate(entry.correctCount, entry.mistakes) * 100)
  const tone = RANK_TONE[place]
  const compact = variant === 'compact'

  return (
    <div
      className={`flex items-center gap-3 ${compact ? 'px-1 py-1.5' : 'panel rounded-xl p-3'}`}
      style={
        !compact && tone
          ? { borderColor: `color-mix(in srgb, ${tone} 45%, transparent)` }
          : undefined
      }
    >
      <span
        className="numeric w-6 shrink-0 text-center font-bold"
        style={{ color: tone ?? 'var(--text-subtle)' }}
      >
        {place + 1}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{entry.name}</div>
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
          style={{ color: 'var(--text-subtle)' }}
        >
          {cat && <Icon name={cat.icon} className="h-3.5 w-3.5" />}
          <span>{cat ? t(cat.labelKey) : entry.categoryId}</span>
          {!compact && (
            <>
              <span aria-hidden>·</span>
              <span>{t(`mode.${entry.mode}.title`)}</span>
              {entry.pace && (
                <>
                  <span aria-hidden>·</span>
                  <span>{t(`pace.${entry.pace}`)}</span>
                </>
              )}
              {entry.bestStreak != null && entry.bestStreak > 1 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="numeric" style={{ color: 'var(--accent)' }}>
                    {t('hud.streak', { count: entry.bestStreak })}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="numeric font-bold" style={{ color: 'var(--gold)' }}>
          {entry.score}
        </div>
        <div className="numeric text-xs" style={{ color: 'var(--text-subtle)' }}>
          {pct}% · {fmtTime(entry.elapsedMs)}
        </div>
      </div>
    </div>
  )
}
