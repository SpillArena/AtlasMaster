import { useEffect, useState } from 'react'
import { useTheme } from './useTheme'
import { AccentContext, ACCENT_PRESETS, DEFAULT_ACCENT, type AccentColor } from './accent-context'
import { readPreference, writePreference } from '../lib/cookieConsent'

const STORAGE_KEY = 'accent'

function readStoredAccent(): AccentColor {
  const stored = readPreference(STORAGE_KEY)
  return stored && stored in ACCENT_PRESETS ? (stored as AccentColor) : DEFAULT_ACCENT
}

export function AccentProvider({ children }: { children: React.ReactNode }) {
  const { currentTheme } = useTheme()
  const [accent, setAccent] = useState<AccentColor>(readStoredAccent)

  useEffect(() => {
    const preset = ACCENT_PRESETS[accent] ?? ACCENT_PRESETS[DEFAULT_ACCENT]
    document.documentElement.style.setProperty(
      '--accent',
      currentTheme === 'dark' ? preset.dark : preset.light,
    )
    writePreference(STORAGE_KEY, accent)
  }, [accent, currentTheme])

  return <AccentContext.Provider value={{ accent, setAccent }}>{children}</AccentContext.Provider>
}
