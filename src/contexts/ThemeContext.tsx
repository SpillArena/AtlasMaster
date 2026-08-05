import { useEffect, useState } from 'react'
import { ThemeContext, type CurrentTheme, type Theme } from './theme-context'
import { readPreference, writePreference } from '../lib/cookieConsent'

function getSystemTheme(): CurrentTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): Theme {
  const stored = readPreference('theme')
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState<CurrentTheme>(getSystemTheme)

  const currentTheme: CurrentTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('dark', currentTheme === 'dark')
    html.classList.toggle('light', currentTheme !== 'dark')
    writePreference('theme', theme)
  }, [currentTheme, theme])

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
