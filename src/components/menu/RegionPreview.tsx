import { useEffect, useState } from 'react'
import { makePath, makeProjection } from '../../game/projection'
import type { Region } from '../../game/types'

const W = 800
const H = 500

interface Props {
  region: Region
}

/** Regionens omriss i dens egen projeksjon — statisk og ikke-interaktivt. */
export function RegionPreview({ region }: Props) {
  const [paths, setPaths] = useState<string[] | null>(null)

  useEffect(() => {
    let alive = true
    region.outline().then((data) => {
      if (!alive) return
      const projection = makeProjection(region.projection, data, W, H, 18)
      const path = makePath(projection)
      setPaths(data.features.map((f) => path(f.geometry) ?? ''))
    })
    return () => {
      alive = false
    }
  }, [region])

  if (!paths) return null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="#ffffff"
          fillOpacity={0.16 + (i % 5) * 0.05}
          stroke="#ffffff"
          strokeOpacity={0.45}
          strokeWidth={0.7}
        />
      ))}
    </svg>
  )
}
