import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { FeatureCollection } from 'geojson'
import { makePath, makeProjection } from '../../game/projection'
import type { GeomKind, QuizFeature } from '../../game/types'
import { Icon, type IconName } from '../Icon'

const W = 700
const H = 900

interface Props {
  /** datasett projeksjonen tilpasses til (base for punkter, data for polygoner) */
  fitData: FeatureCollection
  /** valgfritt bakgrunns-omriss (ikke-interaktivt) */
  baseData?: FeatureCollection
  features: QuizFeature[]
  geom: GeomKind
  status: Record<string, 'correct' | 'revealed'>
  /** sist feilklikkede id (rød) */
  flashId: string | null
  flashN: number
  /** mål som skal markeres (choice/type) — pulserer */
  highlightId?: string | null
  /** kan features klikkes? (false i choice/type) */
  interactive?: boolean
  onPick: (id: string) => void
  disabled?: boolean
}

export function MapCanvas({
  fitData,
  baseData,
  features,
  geom,
  status,
  flashId,
  flashN,
  highlightId,
  interactive = true,
  onPick,
  disabled,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [transform, setTransform] = useState(() => zoomIdentity)
  // myk overgang kun for programmatisk zoom (auto-zoom), ikke manuell gest
  const [smooth, setSmooth] = useState(false)

  const { paths, points, basePaths } = useMemo(() => {
    const projection = makeProjection(fitData, W, H)
    const path = makePath(projection)
    const basePaths = baseData
      ? baseData.features.map((f, i) => ({ id: `base-${i}`, d: path(f.geometry) ?? '' }))
      : []
    if (geom === 'point') {
      const points = features.map((f) => {
        const c = (f.geometry as GeoJSON.Point).coordinates
        const xy = projection([c[0], c[1]])
        return { id: f.id, x: xy?.[0] ?? -99, y: xy?.[1] ?? -99 }
      })
      return { paths: [], points, basePaths }
    }
    const paths = features.map((f) => ({ id: f.id, d: path(f.geometry) ?? '' }))
    return { paths, points: [], basePaths }
  }, [fitData, baseData, features, geom])

  // d3-zoom: hjul, pinch og dra-panorering
  useEffect(() => {
    if (!svgRef.current) return
    const sel = select(svgRef.current)
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .extent([
        [0, 0],
        [W, H],
      ])
      .on('zoom', (e) => {
        // sourceEvent finnes for bruker-gest; null for programmatisk .transform
        setSmooth(!e.sourceEvent)
        setTransform(e.transform)
      })
    zoomRef.current = z
    sel.call(z)
    return () => {
      sel.on('.zoom', null)
    }
  }, [])

  // auto-zoom inn på markert by (punkt) så den er lett å se i choice/type
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    if (geom !== 'point' || !highlightId) return
    const p = points.find((pp) => pp.id === highlightId)
    if (!p) return
    const k = 3
    const t = zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-p.x, -p.y)
    select(svgRef.current).call(zoomRef.current.transform, t)
  }, [highlightId, geom, points])

  const zoomBy = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).call(zoomRef.current.scaleBy, factor)
  }
  const resetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
  }

  // skala-kompensasjon så strek/prikker ikke vokser ekstremt ved innzooming
  const k = transform.k

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        role="img"
      >
        <g
          transform={transform.toString()}
          style={{ transition: smooth ? 'transform 0.4s ease' : 'none' }}
        >
          {/* bakgrunns-omriss */}
          {basePaths.map(({ id, d }) => (
            <path
              key={id}
              d={d}
              vectorEffect="non-scaling-stroke"
              className="fill-gray-100 stroke-gray-300 stroke-[0.6] dark:fill-gray-800/40 dark:stroke-gray-700"
            />
          ))}

          {/* polygon-features */}
          {paths.map(({ id, d }) => {
            const st = status[id]
            const correct = st === 'correct'
            const revealed = st === 'revealed'
            const wrong = flashId === id && !st
            const hl = highlightId === id
            return (
              <motion.path
                key={wrong ? `${id}-${flashN}` : id}
                d={d}
                onClick={() => interactive && !disabled && onPick(id)}
                vectorEffect="non-scaling-stroke"
                animate={wrong ? { x: [-2, 2, -2, 2, 0] } : { x: 0 }}
                transition={{ duration: 0.3 }}
                className={[
                  'stroke-white stroke-[0.8] outline-none transition-colors',
                  interactive && !disabled ? 'cursor-pointer' : 'pointer-events-none',
                  correct
                    ? 'fill-emerald-500 dark:fill-emerald-600'
                    : revealed
                      ? 'fill-indigo-400 dark:fill-indigo-500'
                      : wrong
                        ? 'fill-red-500 dark:fill-red-600'
                        : hl
                          ? 'fill-amber-400 dark:fill-amber-500'
                          : interactive
                            ? 'fill-gray-300 hover:fill-sky-300 dark:fill-gray-700 dark:hover:fill-sky-600'
                            : 'fill-gray-300 dark:fill-gray-700',
                ].join(' ')}
              />
            )
          })}

          {/* punkt-features (byer) — radius kompenseres for zoom */}
          {points.map(({ id, x, y }) => {
            const st = status[id]
            const correct = st === 'correct'
            const revealed = st === 'revealed'
            const wrong = flashId === id && !st
            const hl = highlightId === id
            const r = (hl ? 6 : 5) / k
            return (
              <g key={wrong ? `${id}-${flashN}` : id}>
                {hl && (
                  <motion.circle
                    cx={x}
                    cy={y}
                    className="fill-none stroke-amber-400"
                    style={{ strokeWidth: 2 / k }}
                    animate={{ r: [6 / k, 14 / k, 6 / k], opacity: [1, 0, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                )}
                <motion.circle
                  cx={x}
                  cy={y}
                  r={r}
                  onClick={() => interactive && !disabled && onPick(id)}
                  vectorEffect="non-scaling-stroke"
                  animate={wrong ? { x: [-2, 2, -2, 2, 0] } : { x: 0 }}
                  transition={{ duration: 0.3 }}
                  className={[
                    'stroke-white stroke-[1] outline-none transition-colors',
                    interactive && !disabled ? 'cursor-pointer' : 'pointer-events-none',
                    correct
                      ? 'fill-emerald-500'
                      : revealed
                        ? 'fill-indigo-400'
                        : wrong
                          ? 'fill-red-500'
                          : hl
                            ? 'fill-amber-400'
                            : 'fill-sky-500 hover:fill-sky-400',
                  ].join(' ')}
                />
              </g>
            )
          })}
        </g>
      </svg>

      {/* zoom-kontroller */}
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <ZoomBtn icon="plus" onClick={() => zoomBy(1.6)} />
        <ZoomBtn icon="minus" onClick={() => zoomBy(1 / 1.6)} />
        <ZoomBtn icon="reset" onClick={resetZoom} />
      </div>
    </div>
  )
}

function ZoomBtn({ icon, onClick }: { icon: IconName; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white/90 shadow-sm backdrop-blur hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/90 dark:hover:bg-gray-800"
    >
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}
