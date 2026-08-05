import { createContext } from 'react'

export type AccentColor =
  | 'norsk'
  | 'indigo'
  | 'blue'
  | 'sky'
  | 'cyan'
  | 'teal'
  | 'emerald'
  | 'lime'
  | 'amber'
  | 'orange'
  | 'rose'
  | 'pink'
  | 'fuchsia'
  | 'violet'

export interface AccentDefinition {
  label: string
  light: string
  dark: string
}

/** `norsk` er spillets egen farge; resten er standardpaletten fra malen. */
export const ACCENT_PRESETS: Record<AccentColor, AccentDefinition> = {
  norsk: { label: 'Norsk', light: '#f1376e', dark: '#ff4f86' },
  indigo: { label: 'Indigo', light: '#6366f1', dark: '#818cf8' },
  blue: { label: 'Blue', light: '#2563eb', dark: '#60a5fa' },
  sky: { label: 'Sky', light: '#0284c7', dark: '#38bdf8' },
  cyan: { label: 'Cyan', light: '#0891b2', dark: '#22d3ee' },
  teal: { label: 'Teal', light: '#0d9488', dark: '#2dd4bf' },
  emerald: { label: 'Emerald', light: '#059669', dark: '#34d399' },
  lime: { label: 'Lime', light: '#65a30d', dark: '#a3e635' },
  amber: { label: 'Amber', light: '#d97706', dark: '#fbbf24' },
  orange: { label: 'Orange', light: '#ea580c', dark: '#fb923c' },
  rose: { label: 'Rose', light: '#e11d48', dark: '#fb7185' },
  pink: { label: 'Pink', light: '#db2777', dark: '#f472b6' },
  fuchsia: { label: 'Fuchsia', light: '#c026d3', dark: '#e879f9' },
  violet: { label: 'Violet', light: '#7c3aed', dark: '#a78bfa' },
}

export const DEFAULT_ACCENT: AccentColor = 'norsk'

export interface AccentContextValue {
  accent: AccentColor
  setAccent: (accent: AccentColor) => void
}

export const AccentContext = createContext<AccentContextValue | null>(null)
