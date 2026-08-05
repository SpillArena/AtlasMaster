import { useContext } from 'react'
import { GameSettingsContext } from './game-settings-context'

export function useGameSettings() {
  const ctx = useContext(GameSettingsContext)
  if (!ctx) throw new Error('useGameSettings must be used within GameSettingsProvider')
  return ctx
}
