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
