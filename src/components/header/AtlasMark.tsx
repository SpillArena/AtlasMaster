interface Props {
  className?: string
}

/**
 * Merket: ein globus med meridian og to breiddegrader. Erstattar det norske
 * flagget som stod her då spelet berre dekte Noreg — eit flagg kan ikkje
 * representere eit spel som skal ta eit kontinent om gangen.
 *
 * Teikna i `currentColor` og aksentfarge, så det følgjer tema og aksentval
 * i staden for å låse seg til eit fast fargesett.
 */
export function AtlasMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="AtlasMaster"
      fill="none"
    >
      <circle cx="12" cy="12" r="9.25" stroke="var(--accent)" strokeWidth="1.6" />
      {/* meridian — ellipsa som gjer sirkelen til ein klode */}
      <ellipse cx="12" cy="12" rx="4.1" ry="9.25" stroke="currentColor" strokeWidth="1.3" opacity="0.75" />
      {/* to breiddegrader, litt bøygde slik at kloden får djupn */}
      <path d="M3.4 8.6h17.2" stroke="currentColor" strokeWidth="1.3" opacity="0.75" strokeLinecap="round" />
      <path d="M3.4 15.4h17.2" stroke="currentColor" strokeWidth="1.3" opacity="0.75" strokeLinecap="round" />
      {/* nåla — spelet handlar om å treffe éin stad */}
      <circle cx="15.1" cy="8.6" r="2.05" fill="var(--accent)" stroke="none" />
    </svg>
  )
}
