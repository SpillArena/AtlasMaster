import { useTranslation } from 'react-i18next'
import logo from '../../assets/logo.png'

/** Lenke tilbake til hovedportalen spillarena.no. */
export function BackToArena() {
  const { t } = useTranslation()

  return (
    <a
      href="https://spillarena.no"
      aria-label={t('nav.backToArena')}
      className="group flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/15 px-4 font-extrabold tracking-tight text-white shadow-[0_12px_30px_rgba(171,72,196,0.32)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-[0_16px_36px_rgba(226,76,181,0.38)]"
      style={{
        background: 'linear-gradient(135deg, #9B40D6 0%, #C94DBD 52%, #E24CB5 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)',
      }}
    >
      <span
        aria-hidden
        className="text-base leading-none transition-transform duration-200 ease-out group-hover:-translate-x-0.5"
      >
        ←
      </span>
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        className="h-4 w-auto object-contain"
      />
      <span className="hidden text-sm sm:inline">Spillarena</span>
    </a>
  )
}
