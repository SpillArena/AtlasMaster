import { useTranslation } from 'react-i18next'
import { getName } from '../../game/leaderboard'
import { getProgress, levelProgress } from '../../game/progress'
import { Icon } from '../Icon'

interface Props {
  /** åpner navneredigering */
  onEdit: () => void
}

/**
 * Spillerkortet i headeren: initial, navn og nivå med XP-stripe. Dobler som
 * knapp for å endre navn, så navnefeltet ikke stjeler plass i baren.
 */
export function PlayerChip({ onEdit }: Props) {
  const { t } = useTranslation()
  // leses ved montering; Header remonterer kortet etter hver lagrede runde
  const name = getName().trim()
  const { level, pct } = levelProgress(getProgress().xp)
  const initial = name ? name.slice(0, 1).toUpperCase() : null

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={name ? t('nav.editName', { name }) : t('nav.setName')}
      className="group flex h-10 items-center gap-2 rounded-full border pl-1 pr-3 transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[var(--border-hover)]"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <span
        aria-hidden
        className="numeric flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ background: 'var(--accent)' }}
      >
        {initial ?? <Icon name="user" className="h-4 w-4" />}
      </span>

      <span className="flex min-w-0 flex-col items-start leading-none">
        <span
          className="max-w-[7rem] truncate text-sm font-bold sm:max-w-[10rem]"
          style={{ color: name ? 'var(--text)' : 'var(--text-subtle)' }}
        >
          {name || t('nav.setName')}
        </span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="numeric text-[0.625rem] font-bold" style={{ color: 'var(--gold)' }}>
            {t('nav.level', { level })}
          </span>
          <span
            aria-hidden
            className="h-1 w-10 overflow-hidden rounded-full"
            style={{ background: 'var(--map-idle)' }}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: 'var(--gold)' }}
            />
          </span>
        </span>
      </span>
    </button>
  )
}
