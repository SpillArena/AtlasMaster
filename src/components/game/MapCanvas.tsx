import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import type { FeatureCollection } from 'geojson'
import { makePath, makeProjection, naturalAspect } from '../../game/projection'
import type { GeomKind, ProjectionSpec, QuizFeature } from '../../game/types'
import type { Award } from '../../game/useQuizEngine'
import { Icon, type IconName } from '../Icon'

/**
 * Lerretshøgda er fast; breidda følgjer regionen sitt eige sideforhold, så
 * både det høge Noreg og det breie Europa fyller flata.
 */
const H = 900

interface Props {
  /** regionens projeksjon */
  projectionSpec: ProjectionSpec
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
  /** siste poengutdeling — gir ring og «+120» der treffet skjedde */
  award?: Award | null
  /** kan features klikkes? (false i choice/type) */
  interactive?: boolean
  onPick: (id: string) => void
  disabled?: boolean
}

export function MapCanvas({
  projectionSpec,
  fitData,
  baseData,
  features,
  geom,
  status,
  flashId,
  flashN,
  highlightId,
  award,
  interactive = true,
  onPick,
  disabled,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [transform, setTransform] = useState(() => zoomIdentity)
  // myk overgang kun for programmatisk zoom (auto-zoom), ikke manuell gest
  const [smooth, setSmooth] = useState(false)

  const { paths, points, basePaths, centers, W } = useMemo(() => {
    const W = Math.round(H * naturalAspect(projectionSpec, fitData))
    const projection = makeProjection(projectionSpec, fitData, W, H)
    const path = makePath(projection)
    const basePaths = baseData
      ? baseData.features.map((f, i) => ({ id: `base-${i}`, d: path(f.geometry) ?? '' }))
      : []
    // sentrum per feature — brukes til å plassere poeng-popup og treffring
    const centers: Record<string, [number, number]> = {}

    if (geom === 'point') {
      const points = features.map((f) => {
        const c = (f.geometry as GeoJSON.Point).coordinates
        const xy = projection([c[0], c[1]])
        const p = { id: f.id, x: xy?.[0] ?? -99, y: xy?.[1] ?? -99 }
        centers[f.id] = [p.x, p.y]
        return p
      })
      return { paths: [], points, basePaths, centers, W }
    }

    const paths = features.map((f) => {
      centers[f.id] = path.centroid(f.geometry) as [number, number]
      return { id: f.id, d: path(f.geometry) ?? '' }
    })
    return { paths, points: [], basePaths, centers, W }
  }, [projectionSpec, fitData, baseData, features, geom])

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
  }, [W])

  // auto-zoom inn på markert by (punkt) så den er lett å se i choice/type
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    if (geom !== 'point' || !highlightId) return
    const p = points.find((pp) => pp.id === highlightId)
    if (!p) return
    const k = 3
    const t = zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-p.x, -p.y)
    select(svgRef.current).call(zoomRef.current.transform, t)
  }, [highlightId, geom, points, W])

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
  const awardCenter = award ? centers[award.id] : undefined

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
              fill="var(--map-idle)"
              stroke="var(--border)"
              strokeWidth={0.6}
            />
          ))}

          {/* polygon- og linje-features (fylker / elver) */}
          {paths.map(({ id, d }) => {
            const st = status[id]
            const correct = st === 'correct'
            const revealed = st === 'revealed'
            const wrong = flashId === id && !st
            const hl = highlightId === id
            const isLine = geom === 'line'
            const color = correct
              ? 'var(--success)'
              : revealed
                ? 'var(--info)'
                : wrong
                  ? 'var(--danger)'
                  : hl
                    ? 'var(--gold)'
                    : isLine
                      ? 'var(--text-subtle)'
                      : 'var(--map-idle)'
            return (
              <motion.path
                key={wrong ? `${id}-${flashN}` : id}
                d={d}
                onClick={() => interactive && !disabled && onPick(id)}
                vectorEffect="non-scaling-stroke"
                animate={wrong ? { x: [-2, 2, -2, 2, 0] } : { x: 0 }}
                transition={{ duration: 0.3 }}
                fill={isLine ? 'none' : color}
                stroke={isLine ? color : undefined}
                strokeWidth={isLine ? 6 : undefined}
                strokeLinecap={isLine ? 'round' : undefined}
                strokeLinejoin={isLine ? 'round' : undefined}
                className={[
                  'outline-none transition-colors',
                  isLine ? '' : 'stroke-white stroke-[0.8]',
                  hl ? 'animate-breathe' : '',
                  interactive && !disabled
                    ? isLine
                      ? 'cursor-pointer hover:stroke-[var(--accent)]'
                      : 'cursor-pointer hover:fill-[var(--map-idle-hover)]'
                    : 'pointer-events-none',
                ].join(' ')}
              />
            )
          })}

          {/* punkt-features (byer, fjelltopper) — radius kompenseres for zoom */}
          {points.map(({ id, x, y }) => {
            const st = status[id]
            const correct = st === 'correct'
            const revealed = st === 'revealed'
            const wrong = flashId === id && !st
            const hl = highlightId === id
            const r = (hl ? 6 : 5) / k
            const fill = correct
              ? 'var(--success)'
              : revealed
                ? 'var(--info)'
                : wrong
                  ? 'var(--danger)'
                  : hl
                    ? 'var(--gold)'
                    : 'var(--accent)'
            return (
              <g key={wrong ? `${id}-${flashN}` : id}>
                {hl && (
                  <motion.circle
                    cx={x}
                    cy={y}
                    fill="none"
                    stroke="var(--gold)"
                    style={{ strokeWidth: 2 / k }}
                    // r må ha en startverdi, ellers rendres attributtet som «undefined»
                    initial={{ r: 6 / k }}
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
                  fill={fill}
                  className={[
                    'stroke-white stroke-[1] outline-none transition-colors',
                    interactive && !disabled ? 'cursor-pointer' : 'pointer-events-none',
                  ].join(' ')}
                />
              </g>
            )
          })}

          {/* treffmarkering: ring som slår ut, og poengene som stiger */}
          {award && awardCenter && (
            <g key={`award-${award.n}`} pointerEvents="none">
              <motion.circle
                cx={awardCenter[0]}
                cy={awardCenter[1]}
                fill="none"
                stroke="var(--success)"
                initial={{ r: 4 / k, opacity: 0.9 }}
                animate={{ r: 44 / k, opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ strokeWidth: 3 / k }}
              />
              <motion.text
                x={awardCenter[0]}
                y={awardCenter[1]}
                textAnchor="middle"
                initial={{ opacity: 0, y: awardCenter[1] }}
                animate={{ opacity: [0, 1, 1, 0], y: awardCenter[1] - 46 / k }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                fill="var(--success)"
                stroke="var(--bg)"
                strokeWidth={3 / k}
                paintOrder="stroke"
                className="numeric font-bold"
                style={{ fontSize: `${22 / k}px` }}
              >
                +{award.points}
              </motion.text>
            </g>
          )}
        </g>
      </svg>

      {/* zoom-kontroller */}
      <div className="absolute right-2 top-2 flex flex-col gap-1.5 sm:right-3 sm:top-3">
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
      className="panel flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-[var(--surface-card)]"
      style={{ color: 'var(--text)' }}
    >
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}
