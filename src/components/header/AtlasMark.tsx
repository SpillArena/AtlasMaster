interface Props {
  className?: string
}

/**
 * Merket: app-ikonet, det samme som public/favicon.svg.
 *
 * Headeren og tittelen tegnet en egen kompassrose i `currentColor` og
 * primærfarge, mens fanen, hjemskjermen og manifestet viste app-ikonet — to
 * merker for samme app. Nå er det ett. Tegningen står inline og ikke som
 * `<img src="favicon.svg">`: det er en halv kilobyte, og da kommer merket med
 * første maling i stedet for etter en egen forespørsel.
 *
 * Fargene er ikonets egne og følger ikke tema. Det er poenget —
 * et app-ikon ser likt ut overalt. Endres favicon.svg, endres dette også.
 */
export function AtlasMark({ className }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="AtlasMaster">
      <rect width="64" height="64" rx="16" fill="#0b1424" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#c8ff3c" strokeWidth="2.6" opacity=".45" />
      <path d="M32 6v6M58 32h-6M32 58v-6M6 32h6" stroke="#c8ff3c" strokeWidth="3" strokeLinecap="round" />
      <path d="m32 13 7 19H25Z" fill="#c8ff3c" />
      <path d="m32 51 7-19H25Z" fill="#8a9bb8" />
      <circle cx="32" cy="32" r="3.2" fill="#0b1424" stroke="#c8ff3c" strokeWidth="2" />
    </svg>
  )
}
