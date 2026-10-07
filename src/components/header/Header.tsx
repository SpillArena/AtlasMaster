import { useTranslation } from 'react-i18next'
import { LobbyLink, SiteHeader } from '../../ui/SiteShell'
import SettingsMenu from './SettingsMenu'
import { BackToArena } from './BackToArena'
import { AtlasMark } from './AtlasMark'

interface Props {
  atRoot: boolean; inGame: boolean; onGiveUp: () => void; onBack: () => void
  onHome: () => void; onEditName: () => void; profileVersion: number; trail?: string[]
}
export function Header({ atRoot, inGame, onBack, onGiveUp, onHome, onEditName, profileVersion, trail = [] }: Props) {
  const { i18n } = useTranslation()
  return <SiteHeader name="AtlasMaster" mark={<AtlasMark />} language={i18n.language}
    center={trail.length > 0 ? <span className="atlas-header-trail">{trail.join(' / ')}</span> : undefined}
    onHome={(event) => { event.preventDefault(); if (inGame) onGiveUp(); else onHome() }}>
    {!atRoot && <span className="atlas-round-back"><BackToArena atRoot={false} inGame={inGame} onBack={onBack} onGiveUp={onGiveUp} /></span>}
    <LobbyLink language={i18n.language} onClick={(event) => { if (inGame && !window.confirm(i18n.language.startsWith('no') ? 'Forlate runden og gå til lobbyen?' : 'Leave this round and return to the lobby?')) event.preventDefault() }} />
    <SettingsMenu onProfile={onEditName} profileVersion={profileVersion} />
  </SiteHeader>
}
