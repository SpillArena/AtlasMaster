import { useEffect, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import { makePath, makeProjection } from '../../game/projection'
import type { Category } from '../../game/types'

const W = 700
const H = 900

interface Props {
  category: Category
}

interface Rendered {
  basePaths: string[]
  featurePaths: string[]
  points: { x: number; y: number }[]
}

/** Statisk, ikke-interaktivt Norge-kart med kategoriens plasseringer uthevet. */
export function MapPreview({ category }: Props) {
  const [r, setR] = useState<Rendered | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      category.load(),
      category.base?.() ?? Promise.resolve<FeatureCollection | undefined>(undefined),
    ]).then(([data, base]) => {
      if (!alive) return
      // tilpass projeksjon til fylke-omrisset når det finnes, ellers til dataene selv
      const fit = base ?? data
      const projection = makeProjection(fit, W, H)
      const path = makePath(projection)
      const basePaths = base
        ? base.features.map((f) => path(f.geometry) ?? '')
        : []
      if (category.geom === 'point') {
        const points = data.features.map((f) => {
          const c = (f.geometry as Point).coordinates
          const xy = projection([c[0], c[1]])
          return { x: xy?.[0] ?? -99, y: xy?.[1] ?? -99 }
        })
        setR({ basePaths, featurePaths: [], points })
      } else {
        const featurePaths = data.features.map((f) => path(f.geometry) ?? '')
        setR({ basePaths, featurePaths, points: [] })
      }
    })
    return () => {
      alive = false
    }
  }, [category])

  if (!r) return null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      {/* dempet bakgrunns-omriss */}
      {r.basePaths.map((d, i) => (
        <path key={`b-${i}`} d={d} fill="#ffffff" fillOpacity={0.18} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={0.6} />
      ))}

      {/* uthevede linjer (elver) */}
      {category.geom === 'line' &&
        r.featurePaths.map((d, i) => (
          <path
            key={`f-${i}`}
            d={d}
            fill="none"
            stroke={category.color}
            strokeOpacity={0.9}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

      {/* uthevede polygoner (fylker) */}
      {category.geom === 'polygon' &&
        r.featurePaths.map((d, i) => (
          <path
            key={`f-${i}`}
            d={d}
            fill={category.color}
            fillOpacity={0.55 + (i % 4) * 0.1}
            stroke="#ffffff"
            strokeWidth={0.8}
          />
        ))}

      {/* uthevede punkter (byer) — glødende prikker */}
      {r.points.map((p, i) => (
        <g key={`p-${i}`}>
          <circle cx={p.x} cy={p.y} r={14} fill={category.color} fillOpacity={0.25} />
          <circle cx={p.x} cy={p.y} r={6} fill={category.color} stroke="#ffffff" strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  )
}
