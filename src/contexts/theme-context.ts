import { createContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type CurrentTheme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: Theme
  currentTheme: CurrentTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
