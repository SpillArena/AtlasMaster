import { useTranslation } from 'react-i18next'
import { LobbyLink, SiteHeader } from '../../ui/SiteShell'
import SettingsMenu from './SettingsMenu'
import { GiveUpButton } from './BackToArena'
import { AtlasMark } from './AtlasMark'

interface Props {
  inGame: boolean; onGiveUp: () => void
  onHome: () => void; onEditName: () => void; profileVersion: number; trail?: string[]
}
export function Header({ inGame, onGiveUp, onHome, onEditName, profileVersion, trail = [] }: Props) {
  const { i18n } = useTranslation()
  return <SiteHeader name="AtlasMaster" mark={<AtlasMark />} language={i18n.language}
    center={trail.length > 0 ? <span className="atlas-header-trail">{trail.join(' / ')}</span> : undefined}
    onHome={(event) => { event.preventDefault(); if (inGame) onGiveUp(); else onHome() }}>
    {inGame && <span className="atlas-round-back"><GiveUpButton onGiveUp={onGiveUp} /></span>}
    <LobbyLink language={i18n.language} onClick={(event) => { if (inGame && !window.confirm(i18n.language.startsWith('no') ? 'Forlate runden og gå til lobbyen?' : 'Leave this round and return to the lobby?')) event.preventDefault() }} />
    <SettingsMenu onProfile={onEditName} profileVersion={profileVersion} />
  </SiteHeader>
}
