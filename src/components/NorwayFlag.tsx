// Norsk flagg i offisielle proporsjoner 22:16.
// Bånd horisontalt: rød 6 · hvit 1 · blå 2 · hvit 1 · rød 12
// Bånd vertikalt:   rød 6 · hvit 1 · blå 2 · hvit 1 · rød 6
const RED = '#BA0C2F'
const BLUE = '#00205B'

interface Props {
  className?: string
}

export function NorwayFlag({ className }: Props) {
  return (
    <svg viewBox="0 0 22 16" className={className} aria-label="Norsk flagg" role="img">
      {/* rødt felt */}
      <rect width="22" height="16" fill={RED} />
      {/* hvitt kors */}
      <rect x="6" width="4" height="16" fill="#fff" />
      <rect y="6" width="22" height="4" fill="#fff" />
      {/* blått kors */}
      <rect x="7" width="2" height="16" fill={BLUE} />
      <rect y="7" width="22" height="2" fill={BLUE} />
    </svg>
  )
}
