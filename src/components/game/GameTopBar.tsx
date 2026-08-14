import { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { playSfx } from '../../game/sfx'
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
  /** hvor mange steder som fortsatt står igjen i køen */
  remaining: number
  mistakes: number
  /** når nåværende spørsmål ble vist — klokka regner ut resten selv */
  questionStartedAt: number
  /** hele tidsrammen per spørsmål; 0 = ingen klokke */
  questionMs: number
  /** klokka går bare mens runden faktisk spilles */
  running: boolean
  onTimeout: () => void
}

/**
 * Resultattavla. Poengsummen står øverst og størst fordi den er det du jager;
 * combo, treff og feil ligger på linja under som støttetall.
 */
export const GameTopBar = memo(function GameTopBar({
  points,
  streak,
  correctCount,
  done,
  total,
  remaining,
  mistakes,
  questionStartedAt,
  questionMs,
  running,
  onTimeout,
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
          {/* «7 igjen» — Seterra sitt tydelegaste enkeltgrep: du veit alltid
              kor langt det er att, ikkje berre kor langt du har komme */}
          <span className="numeric shrink-0 text-xs font-bold" style={{ color: 'var(--text-subtle)' }}>
            {t('hud.remaining', { left: remaining, total })}
          </span>

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
            <div className="w-24 shrink-0 sm:w-40">
              <QuestionClock
                questionStartedAt={questionStartedAt}
                questionMs={questionMs}
                running={running}
                onTimeout={onTimeout}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  )
})

/**
 * Klokka for eitt spørsmål.
 *
 * Ho ligg her, og ikkje i `GameScreen`, fordi ho tikkar ti gonger i sekundet.
 * Frå spelskjermen ville kvart tikk ha gjeve ei ny rendring av heile
 * spelegreina — toppbjelke, HUD og kartprops — berre for å flytte ei stripe
 * nokre piksler. No er det denne komponenten åleine som blir rendra på nytt,
 * og resten av spelet står stille til noko faktisk skjer.
 */
function QuestionClock({
  questionStartedAt,
  questionMs,
  running,
  onTimeout,
}: {
  questionStartedAt: number
  questionMs: number
  running: boolean
  onTimeout: () => void
}) {
  const [remainingMs, setRemainingMs] = useState(questionMs)

  useEffect(() => {
    if (!questionMs || !running) return
    const deadline = questionStartedAt + questionMs
    let warned = false

    const tick = () => {
      const left = Math.max(0, deadline - Date.now())
      setRemainingMs(left)
      if (left <= 3000 && left > 0 && !warned) {
        warned = true
        playSfx('tick')
      }
      if (left === 0) onTimeout()
    }

    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [questionStartedAt, questionMs, running, onTimeout])

  return <TimerBar remainingMs={remainingMs} totalMs={questionMs} />
}
