import { useEffect, useMemo, useState } from 'react'
import { getEntries, type Entry } from '../../game/leaderboard'
import { fetchGlobalEntries } from '../../game/scoreApi'

export type BoardScope = 'global' | 'local'

export interface BoardState {
  entries: Entry[]
  loading: boolean
  /** true når den globale tavla ikke svarte og vi viser de lokale i stedet */
  offline: boolean
}

interface Fetched {
  /** hvilket søk svaret hører til, så gamle svar ikke vises på nytt filter */
  key: string
  /** null = tavla svarte ikke */
  entries: Entry[] | null
}

/**
 * Henter tavla for valgt omfang. Den globale hentes fra D1; svarer den ikke,
 * faller vi tilbake på enhetens egne resultater og sier fra om det.
 */
export function useBoard(
  scope: BoardScope,
  regionId: string,
  categoryId: string,
  limit?: number,
): BoardState {
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const key = `${regionId}:${categoryId}:${limit ?? 'all'}`

  const local = useMemo(() => {
    const all = getEntries()
    const filtered = all.filter(
      (e) =>
        (regionId === 'all' || e.regionId === regionId) &&
        (categoryId === 'all' || e.categoryId === categoryId),
    )
    return limit ? filtered.slice(0, limit) : filtered
  }, [regionId, categoryId, limit])

  useEffect(() => {
    if (scope !== 'global') return
    let alive = true
    fetchGlobalEntries(regionId, categoryId, limit).then((entries) => {
      if (alive) setFetched({ key, entries })
    })
    return () => {
      alive = false
    }
  }, [scope, regionId, categoryId, limit, key])

  if (scope === 'local') return { entries: local, loading: false, offline: false }

  const fresh = fetched?.key === key ? fetched : null
  if (!fresh) return { entries: [], loading: true, offline: false }

  return fresh.entries
    ? { entries: fresh.entries, loading: false, offline: false }
    : { entries: local, loading: false, offline: true }
}
