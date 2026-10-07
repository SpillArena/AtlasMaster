import type { MouseEvent, ReactNode } from 'react'
import { openConsentDialog, setConsent, useConsent } from '../account'

const copy = {
  en: { lobby: 'Back to lobby', settings: 'Settings', storage: 'Cookies & storage', accepted: 'Storage is on. Your results and settings are remembered on this device.', declined: 'Storage is off. Results and settings stay in this tab only.', undecided: 'Nothing new is saved until you choose.', accept: 'Accept', decline: 'Decline', manage: 'Manage storage choice', credit: 'Made by' },
  no: { lobby: 'Tilbake til lobbyen', settings: 'Innstillinger', storage: 'Informasjonskapsler og lagring', accepted: 'Lagring er på. Resultatene og innstillingene dine huskes på denne enheten.', declined: 'Lagring er av. Resultater og innstillinger beholdes bare i denne fanen.', undecided: 'Ingenting nytt lagres før du velger.', accept: 'Godta', decline: 'Avslå', manage: 'Endre lagringsvalg', credit: 'Laget av' },
}
const labels = (language: string) => copy[language.startsWith('no') || language.startsWith('nb') ? 'no' : 'en']

export function SiteHeader({ name, logo, mark, language = 'en', onHome, center, children }: {
  name: string; logo?: string; mark?: ReactNode; language?: string
  onHome?: (event: MouseEvent<HTMLAnchorElement>) => void; center?: ReactNode; children: ReactNode
}) {
  return <header className="arena-header">
    <div className={`arena-container arena-header-row${center ? ' arena-header-row--centered' : ''}`}>
      <a className="arena-brand" href={import.meta.env.BASE_URL} onClick={onHome} aria-label={name}>
        {logo ? <img src={logo} alt="" className="arena-brand-mark" /> : <span className="arena-brand-mark" aria-hidden="true">{mark}</span>}
        <span className="arena-brand-name">{name}</span>
      </a>
      {center && <div className="arena-header-center">{center}</div>}
      <nav className="arena-header-actions" aria-label={labels(language).settings}>{children}</nav>
    </div>
  </header>
}

export function LobbyLink({ language = 'en', onClick }: { language?: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const text = labels(language).lobby
  return <a className="arena-lobby-link" href="https://spillarena.no/" aria-label={text} title={text} onClick={onClick}>
    <span aria-hidden="true">←</span><span className="arena-lobby-label">{text}</span>
  </a>
}

export function StorageSettings({ language = 'en', onManage }: { language?: string; onManage?: () => void }) {
  const t = labels(language)
  const consent = useConsent()
  return <section className="arena-storage" aria-label={t.storage}>
    <h3>{t.storage}</h3>
    <p role="status">{consent === 'accepted' ? t.accepted : consent === 'declined' ? t.declined : t.undecided}</p>
    {consent === null ? <div className="arena-storage-actions">
      <button type="button" onClick={() => setConsent('accepted')}>{t.accept}</button>
      <button type="button" onClick={() => setConsent('declined')}>{t.decline}</button>
    </div> : <button type="button" className="arena-text-link" onClick={() => { onManage?.(); openConsentDialog() }}>{t.manage}</button>}
  </section>
}

export function SiteFooter({ game, language = 'en', children, note }: { game: string; language?: string; children?: ReactNode; note?: ReactNode }) {
  const t = labels(language)
  return <footer className="arena-footer">
    <div className="arena-container">
      <div className="arena-footer-row">
        <span>{t.credit} <a href="https://github.com/EmilB04" target="_blank" rel="noreferrer">Emil Berglund</a></span>
        <div className="arena-footer-links">
          {children}
          <button type="button" onClick={openConsentDialog}>{t.storage}</button>
          <a href={`https://github.com/SpillArena/${game}`} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
        </div>
      </div>
      {note}
    </div>
  </footer>
}
