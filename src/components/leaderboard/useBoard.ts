import { useEffect, useMemo, useState } from 'react'
import { getEntries, type Entry } from '../../game/leaderboard'
import { fetchGlobalEntries } from '../../game/scoreApi'

export type BoardScope = 'global' | 'local'

export interface BoardState {
  entries: Entry[]
  loading: boolean
  /** true når den globale tavla ikke svarte og vi viser de lokale i stedet */
  offline: boolean
  /** true når tavla svarte, men med en feil — se kommentaren under */
  failed: boolean
}

export interface BoardQuery {
  regionId: string
  categoryId: string
  /** 'all' eller én spillmodus */
  mode: string
  /** 'all' eller ett tempo */
  pace: string
  limit?: number
}

interface Fetched {
  /** hvilket søk svaret hører til, så gamle svar ikke vises på nytt filter */
  key: string
  entries: Entry[] | null
  failed: boolean
}

/**
 * Én rad per spiller — den beste.
 *
 * Den globale tavla dedupliserer i SQL; den lokale gjorde det ikke. På egen
 * enhet var reserven derfor ikke en tavle over spillere, men over ens egne ti
 * beste runder — en helt annen liste enn den den stod i stedet for, under
 * samme overskrift. Nå betyr en rad det samme uansett hvor den kom fra.
 *
 * Øvelsen er den samme nøkkelen som serveren partisjonerer på: spiller,
 * region, kategori, modus og tempo.
 */
function bestPerPlayer(entries: Entry[]): Entry[] {
  const best = new Map<string, Entry>()
  for (const e of entries) {
    // navn er ikke skiftesensitive på tavla — se COLLATE NOCASE i migrasjonen
    const key = `${e.name.trim().toLowerCase()}:${e.regionId}:${e.categoryId}:${e.mode}:${e.pace ?? ''}`
    const seen = best.get(key)
    if (!seen || e.score > seen.score) best.set(key, e)
  }
  return [...best.values()].sort((a, b) => b.score - a.score || b.date - a.date)
}

/**
 * Henter tavla for valgt omfang. Den globale hentes fra D1; svarer den ikke,
 * faller vi tilbake på enhetens egne resultater og sier fra om det.
 *
 * `offline` og `failed` er ikke det samme, og var det før: begge endte som
 * «ingen resultater enda — spill en runde». En femhundre fra D1 ble presentert
 * som en tom tavle, altså som at ingen hadde spilt. Nå sier den ene at vi ikke
 * fikk sett etter, og den andre at det faktisk ikke er noe der.
 */
export function useBoard(scope: BoardScope, query: BoardQuery): BoardState {
  const [fetched, setFetched] = useState<Fetched | null>(null)
  const { regionId, categoryId, mode, pace, limit } = query
  const key = `${regionId}:${categoryId}:${mode}:${pace}:${limit ?? 'all'}`

  const local = useMemo(() => {
    const filtered = getEntries().filter(
      (e) =>
        (regionId === 'all' || e.regionId === regionId) &&
        (categoryId === 'all' || e.categoryId === categoryId) &&
        (mode === 'all' || e.mode === mode) &&
        (pace === 'all' || e.pace === pace),
    )
    const ranked = bestPerPlayer(filtered)
    return limit ? ranked.slice(0, limit) : ranked
  }, [regionId, categoryId, mode, pace, limit])

  useEffect(() => {
    if (scope !== 'global') return
    let alive = true
    fetchGlobalEntries({ regionId, categoryId, mode, pace, limit }).then((result) => {
      if (!alive) return
      setFetched({
        key,
        entries: result.ok ? result.data : null,
        // «serveren sa nei» er en feil å vise; «ingen svarte» er å være uten nett
        failed: !result.ok && result.reason === 'rejected',
      })
    })
    return () => {
      alive = false
    }
  }, [scope, regionId, categoryId, mode, pace, limit, key])

  if (scope === 'local') {
    return { entries: local, loading: false, offline: false, failed: false }
  }

  const fresh = fetched?.key === key ? fetched : null
  if (!fresh) return { entries: [], loading: true, offline: false, failed: false }

  if (fresh.entries) return { entries: fresh.entries, loading: false, offline: false, failed: false }
  return { entries: local, loading: false, offline: !fresh.failed, failed: fresh.failed }
}
