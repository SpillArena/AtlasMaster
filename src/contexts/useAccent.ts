import { useContext } from 'react'
import { AccentContext } from './accent-context'

export function useAccent() {
  const ctx = useContext(AccentContext)
  if (!ctx) throw new Error('useAccent must be used within AccentProvider')
  return ctx
}
