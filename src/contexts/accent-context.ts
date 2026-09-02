import { createContext } from 'react'

export type AccentColor =
  | 'brass'
  | 'atlasblue'
  | 'atlasmaster'
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

/**
 * `brass` er feltbok-standarden etter redesignet — messing på alda papir.
 * Resten er retuna til å sitje i same verda (litt dempa, jordnære), så
 * fargeveljaren held seg heil. Ein lagra eldre verdi (`norsk`, `atlas`,
 * `atlasblue`) fell berre tilbake til standarden.
 */
export const ACCENT_PRESETS: Record<AccentColor, AccentDefinition> = {
  brass: { label: 'Messing', light: '#a9772f', dark: '#ce9e52' },
  atlasblue: { label: 'Kompassblå', light: '#365c7a', dark: '#7fa8c4' },
  atlasmaster: { label: 'Signalraud', light: '#ae3b2c', dark: '#cf5b4c' },
  indigo: { label: 'Blekk', light: '#3f3a63', dark: '#8985b8' },
  blue: { label: 'Djuphav', light: '#2e5c74', dark: '#5f9fbd' },
  sky: { label: 'Himmel', light: '#3d7a94', dark: '#79c0d8' },
  cyan: { label: 'Lagune', light: '#2f7d7a', dark: '#57c3bd' },
  teal: { label: 'Grønsjø', light: '#3a6f63', dark: '#63b39f' },
  emerald: { label: 'Feltgrøn', light: '#4f7a4a', dark: '#6fa968' },
  lime: { label: 'Mose', light: '#6a7d2f', dark: '#a6b955' },
  amber: { label: 'Rav', light: '#b07a1f', dark: '#e0aa4c' },
  orange: { label: 'Lakksegl', light: '#c06b2e', dark: '#d98e4b' },
  rose: { label: 'Terrakotta', light: '#b0503f', dark: '#d47c6a' },
  pink: { label: 'Korall', light: '#bf5566', dark: '#e08a97' },
  fuchsia: { label: 'Vin', light: '#8a3f5c', dark: '#bd7893' },
  violet: { label: 'Plomme', light: '#6d4a7a', dark: '#a586b3' },
}

export const DEFAULT_ACCENT: AccentColor = 'brass'

export interface AccentContextValue {
  accent: AccentColor
  setAccent: (accent: AccentColor) => void
}

export const AccentContext = createContext<AccentContextValue | null>(null)
