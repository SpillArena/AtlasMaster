import { useTranslation } from 'react-i18next'

interface Props {
  /** antall faktisk riktige (oppgitt teller ikke) */
  correctCount: number
  /** antall fullførte mål (inkl. oppgitt) — styrer fremdrift */
  done: number
  total: number
  mistakes: number
}

export function GameTopBar({ correctCount, done, total, mistakes }: Props) {
  const { t } = useTranslation()
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="border-b border-gray-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
            {t('hud.correct')} {correctCount}/{total}
          </span>
          <span className="tabular-nums text-gray-500 dark:text-gray-400">
            {pct}% {t('hud.done')}
          </span>
          <span className="tabular-nums text-red-500">
            {t('hud.mistakesLabel')} {mistakes}
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
