import { useEffect, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import { makePath, makeProjection } from '../game/projection'

const W = 700
const H = 900

/**
 * Arenaens bakvegg: nordlys som ligger og driver, med Norges omriss tegnet
 * over. Samme projeksjon og data som spillkartet, men dempet og uten
 * interaksjon — så «dette er Norge» ligger under hver skjerm.
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

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* nordlys — to drivende felter, aksentfarget så temaet slår igjennom */}
      <div
        className="absolute -left-1/4 -top-1/3 h-[80vh] w-[80vw] rounded-full blur-3xl animate-breathe"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[70vh] w-[70vw] rounded-full blur-3xl animate-breathe"
        style={{
          animationDelay: '1.2s',
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--info) 20%, transparent), transparent 70%)',
        }}
      />

      {d && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full opacity-[0.06] dark:opacity-[0.09]"
        >
          <path d={d} fill="none" stroke="var(--text)" strokeWidth={1.4} />
        </svg>
      )}
    </div>
  )
}
