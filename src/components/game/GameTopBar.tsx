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
    <header
      className="shrink-0 border-b px-3 py-2 backdrop-blur sm:px-4"
      style={{ borderColor: 'var(--border)', background: 'var(--nav-bg)' }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5">
        <dl className="flex items-center justify-between text-xs font-semibold sm:text-sm">
          <div className="flex gap-1" style={{ color: 'var(--success)' }}>
            <dt>{t('hud.correct')}</dt>
            <dd className="tabular-nums">
              {correctCount}/{total}
            </dd>
          </div>
          <div className="flex gap-1" style={{ color: 'var(--text-subtle)' }}>
            <dt className="capitalize">{t('hud.done')}</dt>
            <dd className="tabular-nums">{pct}%</dd>
          </div>
          <div className="flex gap-1" style={{ color: 'var(--danger)' }}>
            <dt>{t('hud.mistakesLabel')}</dt>
            <dd className="tabular-nums">{mistakes}</dd>
          </div>
        </dl>
        <div
          className="h-2 overflow-hidden rounded-full sm:h-2.5"
          style={{ background: 'var(--map-idle)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('hud.done')}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--info))',
            }}
          />
        </div>
      </div>
    </header>
  )
}
