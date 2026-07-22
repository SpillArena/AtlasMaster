import { useEffect, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import { makePath, makeProjection } from '../game/projection'

const W = 700
const H = 900

/**
 * Svakt Norge-omriss i bakgrunnen — appens signaturelement. Samme
 * projeksjon/data som spillkartet, men helt dempet og ikke-interaktivt,
 * så identiteten "dette er Norge" er til stede selv på meny/resultat-skjermer.
 */
export function BackgroundMap() {
  const [d, setD] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    import('../data/fylker.json').then((mod) => {
      if (!alive) return
      const data = mod.default as unknown as FeatureCollection
      const projection = makeProjection(data, W, H, 4)
      const path = makePath(projection)
      const merged = data.features.map((f) => path(f.geometry) ?? '').join(' ')
      setD(merged)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!d) return null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.05] dark:opacity-[0.07]"
    >
      <path d={d} fill="none" stroke="var(--text)" strokeWidth={1.4} />
    </svg>
  )
}
