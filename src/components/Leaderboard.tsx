import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { categories, getCategory } from '../game/categories'
import { getEntries } from '../game/leaderboard'
import { Icon } from './Icon'

interface Props {
  onBack: () => void
}

function fmtTime(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const RANK_COLOR = ['text-amber-500', 'text-gray-400', 'text-orange-700']

export function Leaderboard({ onBack }: Props) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<string>('all')
  // les én gang ved montering (sortert synkende på score i storage)
  const entries = useMemo(() => getEntries(), [])

  const filtered =
    filter === 'all' ? entries : entries.filter((e) => e.categoryId === filter)

  return (
    <div className="mx-auto max-w-2xl px-4 py-4">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          ← {t('mode.back')}
        </button>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <Icon name="trophy" className="h-6 w-6 text-amber-500" />
          {t('leaderboard.title')}
        </h1>
      </div>

      {/* kategori-filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('leaderboard.all')}
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
            {t(c.labelKey)}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-gray-500 dark:text-gray-400">
          {t('leaderboard.empty')}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {filtered.map((e, i) => {
            const cat = getCategory(e.categoryId)
            const pct = e.total ? Math.round((e.correctCount / e.total) * 100) : 0
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/80 p-3 dark:border-gray-800 dark:bg-gray-900/80"
              >
                <span
                  className={`w-7 shrink-0 text-center text-lg font-black tabular-nums ${
                    RANK_COLOR[i] ?? 'text-gray-400'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {cat && <Icon name={cat.icon} className="h-3.5 w-3.5" />}
                    <span>{cat ? t(cat.labelKey) : e.categoryId}</span>
                    <span>·</span>
                    <span>{t(`mode.${e.mode}.title`)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-black tabular-nums text-amber-600 dark:text-amber-400">
                    {e.score}
                  </div>
                  <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {pct}% · {fmtTime(e.elapsedMs)}
                  </div>
                </div>
              </motion.li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
          : 'border border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  )
}
