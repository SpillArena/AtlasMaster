import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { CookieConsentProvider } from './contexts/CookieConsentProvider'
import { ThemeProvider } from './contexts/ThemeContext'
import { AccentProvider } from './contexts/AccentContext'
import { GameSettingsProvider } from './contexts/GameSettingsProvider'
import CookieConsentBanner from './components/CookieConsentBanner'
import { initAuth } from './game/auth'

/*
 * Kontoen er felles for hele SpillArena, og økten ligger alt i nettleseren når
 * spilleren kommer hit fra forsiden. Dette kobler den til spillet — samtykke,
 * den gamle 'auth'-nøkkelen, og navnet tavla bruker. Må skje før noe leser
 * økten. Se game/auth.ts.
 */
initAuth()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* samtykke ytterst: alt under leser og skriver gjennom det */}
    <CookieConsentProvider>
      <ThemeProvider>
        <AccentProvider>
          <GameSettingsProvider>
            <App />
            <CookieConsentBanner />
          </GameSettingsProvider>
        </AccentProvider>
      </ThemeProvider>
    </CookieConsentProvider>
  </StrictMode>,
)
