import { useEffect, useState } from 'react'
import type { FeatureCollection, Point } from 'geojson'
import { makePath, makeProjection } from '../../game/projection'
import type { Category, ProjectionSpec } from '../../game/types'

const W = 700
const H = 900

interface Props {
  category: Category
  /** regionens projeksjon — flisa må vise samme kartform som spillet */
  projection: ProjectionSpec
}

interface Rendered {
  basePaths: string[]
  featurePaths: string[]
  points: { x: number; y: number }[]
}

/** Statisk, ikke-interaktivt regionkart med kategoriens plasseringer uthevet. */
export function MapPreview({ category, projection: spec }: Props) {
  const [r, setR] = useState<Rendered | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      category.load(),
      category.base?.() ?? Promise.resolve<FeatureCollection | undefined>(undefined),
    ]).then(([data, base]) => {
      if (!alive) return
      // tilpass projeksjon til omrisset når det finnes, ellers til dataene selv
      const fit = base ?? data
      const projection = makeProjection(spec, fit, W, H)
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
  }, [category, spec])

  if (!r) return null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden
    >
      {/* dempet bakgrunns-omriss — blekk på platen */}
      {r.basePaths.map((d, i) => (
        <path
          key={`b-${i}`}
          d={d}
          fill="var(--coast)"
          fillOpacity={0.1}
          stroke="var(--coast)"
          strokeOpacity={0.4}
          strokeWidth={0.7}
        />
      ))}

      {/* uthevede linjer (elver/rivers) */}
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

      {/* uthevede polygoner (fylker/land) */}
      {category.geom === 'polygon' &&
        r.featurePaths.map((d, i) => (
          <path
            key={`f-${i}`}
            d={d}
            fill={category.color}
            fillOpacity={0.5 + (i % 4) * 0.1}
            stroke="var(--color-surface-elevated)"
            strokeWidth={0.8}
          />
        ))}

      {/* uthevede punkter (byer/topper) — nålestikk */}
      {r.points.map((p, i) => (
        <g key={`p-${i}`}>
          <circle cx={p.x} cy={p.y} r={14} fill={category.color} fillOpacity={0.22} />
          <circle
            cx={p.x}
            cy={p.y}
            r={6}
            fill={category.color}
            stroke="var(--color-surface-elevated)"
            strokeWidth={1.5}
          />
        </g>
      ))}
    </svg>
  )
}
