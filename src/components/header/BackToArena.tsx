import { useTranslation } from 'react-i18next'
import { Icon } from '../Icon'

interface Props {
  /** true på toppnivå (ingen kategori/modus/ledertavle valgt) */
  atRoot: boolean
  /** true mens en runde spilles — da er knappen «Gi opp» */
  inGame: boolean
  /** går ett steg tilbake i appen — brukes når ikke på toppnivå */
  onBack: () => void
  /** ber om bekreftelse før runden forlates */
  onGiveUp: () => void
}

/* Bagasjelapp i messing: navigasjon ut av feltboka. */
const pillClass =
  'group flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-bold tracking-tight text-[var(--color-surface)] transition-all duration-200 ease-out hover:-translate-y-[1px]'

const pillStyle = {
  background: 'var(--brass)',
  borderColor: 'color-mix(in srgb, var(--ink) 30%, transparent)',
  boxShadow:
    'inset 0 0 0 1.5px color-mix(in srgb, var(--color-surface) 30%, transparent), 0 2px 0 color-mix(in srgb, var(--ink) 40%, transparent)',
}

/** Rødt for «gi opp» — knappen kaster runden, og skal ikke se ut som navigasjon. */
const dangerStyle = {
  background: 'var(--color-error)',
  borderColor: 'color-mix(in srgb, var(--ink) 30%, transparent)',
  boxShadow:
    'inset 0 0 0 1.5px color-mix(in srgb, var(--color-surface) 28%, transparent), 0 2px 0 color-mix(in srgb, var(--ink) 40%, transparent)',
}

const Arrow = () => (
  <span
    aria-hidden
    className="text-base leading-none transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
  >
    ←
  </span>
)

/**
 * Knappen øverst til venstre har tre jobber, én om gangen: ut til Spillarena
 * på toppnivå, ett steg tilbake i menyene, og «Gi opp» mens en runde går —
 * der et uforvarende tilbake-trykk ville kastet poengene dine.
 */
export function BackToArena({ atRoot, inGame, onBack, onGiveUp }: Props) {
  const { t } = useTranslation()

  if (inGame) {
    return (
      <button
        onClick={onGiveUp}
        aria-label={t('giveUp.action')}
        className={pillClass}
        style={dangerStyle}
      >
        <Icon name="x" className="h-4 w-4" />
        <span className="text-sm">{t('giveUp.action')}</span>
      </button>
    )
  }

  if (atRoot) {
    return (
      <a
        href="https://spillarena.no"
        aria-label={t('nav.backToArena')}
        className={pillClass}
        style={pillStyle}
      >
        <Arrow />
        {/*
          Merket til Spillarena stod her som et bilde — en lilla-magenta
          spillkontroll på en messingpille. Det var den ene mettede fargen i
          hele appen, og den satt i det øverste venstre hjørnet der blikket
          lander først. Navnet gjør samme jobben og gjør den i temaets egen
          skrift; det er ordet folk leter etter, ikke ikonet. Bildet var også
          en forespørsel og en mulig layout-hopp mindre i headeren.
        */}
        <span className="font-display text-sm font-semibold tracking-tight sm:text-base">
          Spillarena
        </span>
      </a>
    )
  }

  return (
    <button
      onClick={onBack}
      aria-label={t('mode.back')}
      className="group flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-bold tracking-tight transition-all duration-200 ease-out hover:-translate-y-[1px] hover:border-[var(--border-hover)]"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
    >
      <Arrow />
      <span className="text-sm">{t('mode.back')}</span>
    </button>
  )
}
