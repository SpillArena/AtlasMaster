import { useTranslation } from 'react-i18next'
import logo from '../../assets/logo.png'
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

const pillClass =
  'group flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 font-extrabold tracking-tight text-white shadow-[0_12px_30px_rgba(171,72,196,0.32)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_16px_36px_rgba(226,76,181,0.38)]'

const pillStyle = {
  background: 'linear-gradient(135deg, #9B40D6 0%, #C94DBD 52%, #E24CB5 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)',
}

/** Rødt for «gi opp» — knappen kaster runden, og skal ikke se ut som navigasjon. */
const dangerStyle = {
  background: 'linear-gradient(135deg, #d4143a 0%, #ba0c2f 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)',
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
        {/* width/height held av plassen før fila er lasta — elles hoppar headeren */}
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          width={96}
          height={96}
          className="h-4 w-auto object-contain"
        />
        <span className="hidden text-sm sm:inline">Spillarena</span>
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
