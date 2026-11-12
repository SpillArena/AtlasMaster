// VENDORED: the same file sits in every SpillArena game (src/ui/SiteFooter.tsx, with site-footer.css next to it), so the
// footer is the same everywhere. Canonical copy: SpillArena/docs/footer/. See docs/OPERATIONS.md, "Game footer".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { openConsentDialog } from '../account'
import spillArenaLogo from './spillarena-logo.svg'
import './site-footer.css'

const copy = {
  en: { affiliation: 'Part of SpillArena', nav: 'Footer navigation', howTo: 'How to play', storage: 'Cookies & storage', close: 'Close' },
  no: { affiliation: 'En del av SpillArena', nav: 'Bunntekstlenker', howTo: 'Slik spiller du', storage: 'Informasjonskapsler og lagring', close: 'Lukk' },
}

/** The rules text is plain HTML in index.html, readable before any script runs (SpillArena's
 * scripts/sync-game-information.mjs writes it). Once the footer is on screen it adopts that section into its "How to
 * play" window, so the text is a dialog instead of a block under the page. The node goes back to the page if the
 * footer unmounts. */
const SECTION = 'section.spillarena-game-information'

export function SiteFooter({ game, language = 'en', children, note }: { game: string; language?: string; children?: ReactNode; note?: ReactNode }) {
  const lang = language.startsWith('no') || language.startsWith('nb') ? 'no' : 'en'
  const t = copy[lang]
  const dialog = useRef<HTMLDialogElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState<string | null>(null)
  const guide = `https://spillarena.no/games/${game.toLowerCase()}/`

  useEffect(() => {
    const element = host.current
    const section = document.querySelector<HTMLElement>(SECTION)
    if (!element || !section) return
    element.appendChild(section)
    // The text has no fold of its own in a window: every <details> stays open, and its summary is hidden by the CSS.
    section.querySelectorAll('details').forEach(details => { details.open = true })
    return () => { document.body.appendChild(section); setTitle(null) }
  }, [])

  // The window's heading is the game's title from the rules text, in the language the game is set to.
  useEffect(() => {
    const summary = host.current?.querySelector(`[data-game-info-language="${lang}"] summary`)
    setTitle(summary?.textContent?.trim() || null)
  }, [lang])

  const hasInfo = title !== null
  // "HangBot: find the hidden word" -> the name is the heading, the rest is the line under it
  const split = (title ?? game).indexOf(': ')
  const name = split > 0 ? (title ?? game).slice(0, split) : (title ?? game)
  const tagline = split > 0 ? (title ?? game).slice(split + 2) : null
  const close = () => dialog.current?.close()

  return <footer className="arena-footer">
    <div className="arena-container">
      <div className="arena-footer-row">
        <a className="arena-footer-affiliation" href="https://spillarena.no/">
          <img className="arena-footer-logo" src={spillArenaLogo} alt="" width={20} height={20} />
          <span>{t.affiliation}</span>
        </a>
        <nav className="arena-footer-links" aria-label={t.nav}>
          {hasInfo
            ? <button type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>{t.howTo}</button>
            : <a href={guide} target="_blank" rel="noreferrer">{t.howTo}</a>}
          {children}
          <button type="button" onClick={openConsentDialog}>{t.storage}</button>
        </nav>
      </div>
      {note}
    </div>
    <dialog ref={dialog} className="arena-howto" aria-labelledby="arena-howto-title" onClick={event => { if (event.target === dialog.current) close() }}>
      <div className="arena-howto-head">
        <div className="arena-howto-heading">
          <h2 id="arena-howto-title" className="arena-howto-title">{name}</h2>
          {tagline && <p className="arena-howto-tagline">{tagline}</p>}
        </div>
        <button type="button" className="arena-howto-close" aria-label={t.close} onClick={close}>×</button>
      </div>
      <div className="arena-howto-body" data-language={lang} ref={host} />
    </dialog>
  </footer>
}
