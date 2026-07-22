import { NorwayFlag } from './NorwayFlag'
import { useTranslation } from 'react-i18next'

interface Props {
  onClick: () => void
  size?: 'small' | 'large'
}

/** Klikkbar logo — tar deg tilbake til hovedmenyen. */
export function Logo({ onClick, size = 'small' }: Props) {
  const isLarge = size === 'large'
  const { t } = useTranslation()

  if (!isLarge) {
    return (
      <button
        onClick={onClick}
        className="group flex items-center gap-2 transition-transform duration-200 ease-out hover:-translate-y-[1px]"
      >
        <NorwayFlag className="h-5 w-[1.5rem] rounded-[2px]" />
        <span className="font-display text-lg font-extrabold tracking-tight text-white">
          {t('menu.title')}
        </span>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="group mx-auto flex flex-col items-center gap-4 outline-none transition-transform duration-300 ease-out hover:scale-105 focus-visible:scale-105"
    >
      <div className="relative">
        <div className="absolute inset-0 scale-[2.5] rounded-full bg-red-600/15 blur-2xl transition-all duration-300 group-hover:bg-red-600/25" />
        <NorwayFlag className="relative h-12 w-16 rounded-md shadow-[0_8px_20px_rgba(0,0,0,0.35)] sm:h-14 sm:w-20" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-display text-3xl font-black tracking-tighter text-white drop-shadow-md sm:text-5xl">
          {t('menu.title')}
        </span>
        <span className="text-xs font-medium text-slate-400 sm:text-sm">
          {t('menu.description')}
        </span>
      </div>
    </button>
  )
}
