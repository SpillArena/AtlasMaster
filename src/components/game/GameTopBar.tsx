import { useTranslation } from 'react-i18next'
import { ScoreTicker } from './ScoreTicker'
import { ComboMeter } from './ComboMeter'
import { TimerBar } from './TimerBar'
import { Icon } from '../Icon'

interface Props {
  /** samlet poengsum så langt */
  points: number
  /** riktige på rad akkurat nå */
  streak: number
  /** antall faktisk riktige (oppgitt teller ikke) */
  correctCount: number
  /** antall fullførte mål (inkl. oppgitt) — styrer fremdrift */
  done: number
  total: number
  mistakes: number
  /** millisekunder igjen på spørsmålet; 0 når runden spilles uten klokke */
  remainingMs: number
  /** hele tidsrammen per spørsmål; 0 = ingen klokke */
  questionMs: number
}

/**
 * Resultattavla. Poengsummen står øverst og størst fordi den er det du jager;
 * combo, treff og feil ligger på linja under som støttetall.
 */
export function GameTopBar({
  points,
  streak,
  correctCount,
  done,
  total,
  mistakes,
  remainingMs,
  questionMs,
}: Props) {
  const { t } = useTranslation()
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <header className="shrink-0 px-2.5 pt-2 sm:px-4">
      <div className="panel mx-auto max-w-6xl rounded-2xl px-3 py-2.5 sm:px-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="stat-label">{t('result.score')}</span>
            <ScoreTicker
              value={points}
              className="numeric text-2xl font-bold leading-none sm:text-3xl"
            />
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <ComboMeter streak={streak} />
            <dl className="flex items-center gap-3 text-xs font-bold">
              <div className="flex items-center gap-1" style={{ color: 'var(--success)' }}>
                <Icon name="check" className="h-3.5 w-3.5" />
                <dt className="sr-only">{t('hud.correct')}</dt>
                <dd className="numeric">
                  {correctCount}/{total}
                </dd>
              </div>
              <div className="flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                <Icon name="x" className="h-3.5 w-3.5" />
                <dt className="sr-only">{t('hud.mistakesLabel')}</dt>
                <dd className="numeric">{mistakes}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: 'var(--map-idle)' }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('hud.done')}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--accent), var(--gold))',
              }}
            />
          </div>

          {questionMs > 0 && (
            <div className="w-28 shrink-0 sm:w-40">
              <TimerBar remainingMs={remainingMs} totalMs={questionMs} />
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
