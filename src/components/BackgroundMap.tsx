import { useEffect, useState } from 'react'
import { makePath, makeProjection, naturalAspect } from '../game/projection'
import { getRegion } from '../game/regions'

const H = 900

interface Props {
  /** regionen som skal ligge under skjermen */
  regionId: string
}

/**
 * Arenaens bakvegg: nordlys som ligger og driver, med den valgte regionens
 * omriss tegnet over. Samme projeksjon som spillkartet, men dempet og uten
 * interaksjon — så «her er du» ligger under hver skjerm.
 */
export function BackgroundMap({ regionId }: Props) {
  const [map, setMap] = useState<{ d: string; w: number } | null>(null)

  useEffect(() => {
    let alive = true
    const region = getRegion(regionId)
    if (!region) return
    region.outline().then((data) => {
      if (!alive) return
      const w = Math.round(H * naturalAspect(region.projection, data))
      const projection = makeProjection(region.projection, data, w, H, 4)
      const path = makePath(projection)
      setMap({ d: data.features.map((f) => path(f.geometry) ?? '').join(' '), w })
    })
    return () => {
      alive = false
    }
  }, [regionId])

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

      {map && (
        <svg
          viewBox={`0 0 ${map.w} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full opacity-[0.06] dark:opacity-[0.09]"
        >
          <path d={map.d} fill="none" stroke="var(--text)" strokeWidth={1.4} />
        </svg>
      )}
    </div>
  )
}
