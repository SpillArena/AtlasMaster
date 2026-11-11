// VENDORED: the same file sits in every SpillArena game (src/ui/SiteFooter.tsx, with site-footer.css next to it), so the
// footer is the same everywhere. Canonical copy: SpillArena/docs/footer/. See docs/OPERATIONS.md, "Game footer".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { openConsentDialog } from '../account'
import spillArenaLogo from './spillarena-logo.svg'
import './site-footer.css'

const copy = {
  en: { affiliation: 'Part of SpillArena', nav: 'Footer navigation', howTo: 'How to play', faq: 'FAQ', storage: 'Cookies & storage' },
  no: { affiliation: 'En del av SpillArena', nav: 'Bunntekstlenker', howTo: 'Slik spiller du', faq: 'Vanlige spørsmål', storage: 'Informasjonskapsler og lagring' },
}

/** The rules text is plain HTML in index.html, readable before any script runs (SpillArena's
 * scripts/sync-game-information.mjs writes it). Once the footer is on screen it adopts that section, so the text sits in
 * the footer, not under it. The node goes back to the page if the footer unmounts. */
const SECTION = 'section.spillarena-game-information'

export function SiteFooter({ game, language = 'en', children, note }: { game: string; language?: string; children?: ReactNode; note?: ReactNode }) {
  const lang = language.startsWith('no') || language.startsWith('nb') ? 'no' : 'en'
  const t = copy[lang]
  const host = useRef<HTMLDivElement>(null)
  const [hasInfo, setHasInfo] = useState(false)
  const guide = `https://spillarena.no/games/${game.toLowerCase()}/`

  useEffect(() => {
    const element = host.current
    const section = document.querySelector<HTMLElement>(SECTION)
    if (!element || !section) return
    element.appendChild(section)
    setHasInfo(true)
    return () => { document.body.appendChild(section); setHasInfo(false) }
  }, [])

  // Both languages are in the section; site-footer.css shows the one the game is set to. Open that one.
  const showHowTo = () => {
    const shown = [...(host.current?.querySelectorAll<HTMLDetailsElement>('details') ?? [])].find(details => details.getClientRects().length > 0)
    if (!shown) return
    shown.open = true
    shown.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  return <footer className="arena-footer">
    <div className="arena-container">
      <div className="arena-footer-row">
        <a className="arena-footer-affiliation" href="https://spillarena.no/">
          <img className="arena-footer-logo" src={spillArenaLogo} alt="" width={20} height={20} />
          <span>{t.affiliation}</span>
        </a>
        <nav className="arena-footer-links" aria-label={t.nav}>
          {hasInfo
            ? <button type="button" onClick={showHowTo}>{t.howTo}</button>
            : <a href={guide} target="_blank" rel="noreferrer">{t.howTo}</a>}
          <a href={guide} target="_blank" rel="noreferrer">{t.faq}</a>
          {children}
          <button type="button" onClick={openConsentDialog}>{t.storage}</button>
          <a href={`https://github.com/SpillArena/${game}`} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
      <div className="arena-footer-info" data-language={lang} ref={host} />
      {note}
    </div>
  </footer>
}
