import { NorwayFlag } from './NorwayFlag'

interface Props {
  onClick: () => void
}

/** Klikkbar logo i headeren — tar deg tilbake til hovedmenyen. */
export function Logo({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="group flex h-10 shrink-0 items-center gap-2 rounded-full px-3 font-extrabold tracking-tight text-white transition-all duration-200 ease-out hover:-translate-y-[1px]"
      style={{
        backgroundColor: '#BA0C2F',
        boxShadow:
          '0 8px 24px rgba(186,12,47,0.35), inset 0 0 0 1px rgba(255,255,255,0.12)',
      }}
    >
      <NorwayFlag className="h-4 w-[1.375rem] rounded-[2px] ring-1 ring-white/40" />
      <span className="hidden text-base sm:inline">NorgesMester</span>
    </button>
  )
}
