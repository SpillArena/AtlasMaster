interface Props {
  className?: string
}

/**
 * Merket: app-ikonet, det samme som public/favicon.svg.
 *
 * Headeren og tittelen tegnet en egen kompassrose i `currentColor` og
 * aksentfarge, mens fanen, hjemskjermen og manifestet viste app-ikonet — to
 * merker for samme app. Nå er det ett. Tegningen står inline og ikke som
 * `<img src="favicon.svg">`: det er en halv kilobyte, og da kommer merket med
 * første maling i stedet for etter en egen forespørsel.
 *
 * Fargene er ikonets egne og følger ikke tema eller aksent. Det er poenget —
 * et app-ikon ser likt ut overalt. Endres favicon.svg, endres dette også.
 */
export function AtlasMark({ className }: Props) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="AtlasMaster">
      <rect width="64" height="64" rx="16" fill="#29382f" />
      <g stroke="#d9b864" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="32" cy="32" r="23" opacity=".6" />
        <path d="M32 6v5M58 32h-5M32 58v-5M6 32h5" />
        <path d="m32 14 6 18-6 18-6-18Z" fill="#ead9a7" />
        <path d="m14 32 18-6 18 6-18 6Z" opacity=".6" />
        <circle cx="32" cy="32" r="3" fill="#29382f" />
      </g>
    </svg>
  )
}
