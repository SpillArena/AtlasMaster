interface Props {
  className?: string
}

/**
 * Merket: en kompassrose. Erstatter globusen (og før den det norske flagget)
 * — feltbokas eget tegn. Tegnet i `currentColor` og aksentfarge, så det
 * følger tema og aksentvalg i stedet for å låse seg til et fast fargesett.
 */
export function AtlasMark({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="AtlasMaster" fill="none">
      <circle cx="12" cy="12" r="9.3" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6.6" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
      {/* fire lange armar (N/E/S/W) og fire korte diagonalar */}
      <path
        d="M12 2.4 13.4 12 12 21.6 10.6 12Z"
        fill="var(--accent)"
        stroke="none"
      />
      <path
        d="M2.4 12 12 10.6 21.6 12 12 13.4Z"
        fill="currentColor"
        opacity="0.7"
        stroke="none"
      />
      <path
        d="M5.6 5.6 12 12 5.6 18.4 M18.4 5.6 12 12 18.4 18.4"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.5" fill="var(--accent)" stroke="none" />
    </svg>
  )
}
