import { useTranslation } from 'react-i18next'
import { comboMultiplier } from '../../game/scoring'

interface Props {
  streak: number
}

/** Full lading etter ti riktige på rad — da står multiplikatoren på ×2. */
const FULL_AT = 10

/**
 * Comboen er spillets belønningsløkke: rekka lader stripa, stripa hever
 * multiplikatoren, og ett feilsvar tømmer alt.
 */
export function ComboMeter({ streak }: Props) {
  const { t } = useTranslation()
  const charge = Math.min(streak, FULL_AT) / FULL_AT
  const multiplier = comboMultiplier(streak)
  const hot = streak >= 5
  const color = streak === 0 ? 'var(--text-subtle)' : hot ? 'var(--gold)' : 'var(--accent)'

  return (
    <div className="flex items-center gap-2" aria-label={t('hud.combo')}>
      <span
        // nøkkelen gjør at pop-animasjonen kjører på nytt for hver ny rekke
        key={streak}
        className={`numeric text-sm font-bold ${streak > 0 ? 'animate-combo-pop' : ''}`}
        style={{ color }}
      >
        ×{multiplier.toFixed(1)}
      </span>
      <span
        aria-hidden
        className="h-1.5 w-14 overflow-hidden rounded-full sm:w-20"
        style={{ background: 'var(--map-idle)' }}
      >
        <span
          className="block h-full rounded-full transition-[width,background] duration-300"
          style={{
            width: `${charge * 100}%`,
            background: hot
              ? 'linear-gradient(90deg, var(--accent), var(--gold))'
              : 'var(--accent)',
          }}
        />
      </span>
      {streak > 1 && (
        <span className="numeric text-xs font-bold" style={{ color }}>
          {t('hud.streak', { count: streak })}
        </span>
      )}
    </div>
  )
}
