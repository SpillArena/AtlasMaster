import { useEffect, useState } from 'react'
import { makePath, makeProjection, naturalAspect } from '../game/projection'
import { getRegion } from '../game/regions'

const H = 900

interface Props {
  /** regionen som skal ligge under skjermen */
  regionId: string
}

/**
 * Arenaens bakvegg er et levende kartblad fra feltboka.
 *
 * Nederst: papirkorn og to rolige felt i atlasets toner. Over det et
 * lengde-/breddenett. Så den valgte regionens kyst, tegnet med blekk som
 * strekker seg opp hver gang regionen skifter. I et hjørne ligger en
 * kompassrose som driver umerkelig rundt, med rhumb-linjer ut fra senteret
 * slik portolan-kart hadde dem. Samme projeksjon som spillkartet, men dempet
 * og uten interaksjon — «her er du» ligger under hver skjerm uten å slåss med
 * innholdet.
 *
 * All bevegelse går via CSS og er slått av under «mindre bevegelse».
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
      {/* papirkorn på hele flaten */}
      <div className="grain absolute inset-0 opacity-[0.5]" />

      {/* to drivende felt: aksenten og havet, så temaet slår igjennom */}
      <div
        className="paper-drift absolute -left-1/4 -top-1/3 h-[80vh] w-[80vw] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)',
        }}
      />
      <div
        className="paper-drift absolute -bottom-1/3 -right-1/4 h-[70vh] w-[70vw] rounded-full blur-3xl"
        style={{
          animationDelay: '3s',
          background:
            'radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--color-water) 66%, transparent), transparent 70%)',
        }}
      />

      {/* lengde-/breddenett + rhumb-linjer */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
        <defs>
          <pattern id="graticule" width="12.5" height="12.5" patternUnits="userSpaceOnUse">
            <path d="M12.5 0V12.5M0 12.5H12.5" fill="none" stroke="var(--graticule)" strokeWidth="0.15" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#graticule)" opacity="0.7" />
        {/* rhumb-linjer ut fra kompasset nederst til høyre */}
        <g stroke="var(--coast)" strokeWidth="0.12" opacity="0.16">
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2
            return <line key={i} x1={82} y1={82} x2={82 + Math.cos(a) * 160} y2={82 + Math.sin(a) * 160} />
          })}
        </g>
      </svg>

      {map && (
        <svg
          viewBox={`0 0 ${map.w} ${H}`}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full opacity-[0.16] dark:opacity-[0.2]"
        >
          <path
            key={regionId}
            className="draw-on"
            style={{ ['--draw-len' as string]: '6000' }}
            d={map.d}
            fill="none"
            stroke="var(--coast)"
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* kompassrose i hjørnet */}
      <svg
        viewBox="0 0 100 100"
        className="absolute bottom-[3vh] right-[4vw] h-24 w-24 opacity-[0.22] sm:h-40 sm:w-40"
        style={{ color: 'var(--coast)' }}
      >
        <g className="compass-spin">
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="0.6" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180
            const long = deg % 90 === 0
            const r1 = long ? 6 : 20
            const r2 = 46
            return (
              <line
                key={deg}
                x1={50 + Math.sin(a) * r1}
                y1={50 - Math.cos(a) * r1}
                x2={50 + Math.sin(a) * r2}
                y2={50 - Math.cos(a) * r2}
                stroke="currentColor"
                strokeWidth={long ? 1.1 : 0.5}
              />
            )
          })}
          <path d="M50 6 L56 50 L50 46 L44 50 Z" fill="var(--accent)" stroke="none" />
        </g>
      </svg>
    </div>
  )
}
