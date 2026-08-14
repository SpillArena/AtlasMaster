import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { geoBounds, geoGraticule } from 'd3-geo'
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

/**
 * Ønskt treffradius for punkt-features, i CSS-pikslar.
 *
 * Ein by er teikna med radius 5 i lerretskoordinatar. På ein telefon der 900
 * lerretseiningar blir pressa ned i ~500 px er den prikken under 3 px brei —
 * langt under dei 44 px i diameter både Apple og Google set som minstemål for
 * eit trykkmål. Sjølve prikken skal ikkje vekse (kartet blir uleseleg), så i
 * staden ligg det ei usynleg treffflate over.
 */
const HIT_PX = 22

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
  /** mål som skal markeres (choice/type) — pulserer */
  highlightId?: string | null
  /** siste poengutdeling — gir ring og «+120» der treffet skjedde */
  award?: Award | null
  /** kan features klikkes? (false i choice/type) */
  interactive?: boolean
  onPick: (id: string) => void
  disabled?: boolean
}

/**
 * Kartet re-renderer berre når spelet faktisk endrar seg. `GameScreen` teiknar
 * seg sjølv på nytt kvar 100 ms for klokka; utan denne grensa ville heile
 * kartet — fleire hundre baner — bli avstemt ti gonger i sekundet.
 */
export const MapCanvas = memo(function MapCanvas({
  projectionSpec,
  fitData,
  baseData,
  features,
  geom,
  status,
  flashId,
  highlightId,
  award,
  interactive = true,
  onPick,
  disabled,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  // useId gjev ':r1:' — kolon må vekk, elles blir url(#…) ein ugyldig selektor
  const uid = useId().replace(/:/g, '')
  const oceanId = `ocean${uid}`
  const landShapeId = `land${uid}`
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [transform, setTransform] = useState(() => zoomIdentity)
  // myk overgang kun for programmatisk zoom (auto-zoom), ikke manuell gest
  const [smooth, setSmooth] = useState(false)

  const { paths, points, basePaths, land, graticule, centers, W } = useMemo(() => {
    const W = Math.round(H * naturalAspect(projectionSpec, fitData))
    const projection = makeProjection(projectionSpec, fitData, W, H)
    const path = makePath(projection)
    const basePaths = baseData
      ? baseData.features.map((f, i) => ({ id: `base-${i}`, d: path(f.geometry) ?? '' }))
      : []

    /*
     * Heile landmassen som éin bane — grunnfarge, kystlinje og sokkelstriper
     * deler denne geometrien.
     */
    const land = path({
      type: 'GeometryCollection',
      geometries: fitData.features.map((f) => f.geometry),
    }) ?? ''

    /*
     * Lengde- og breiddegradsnettet, klipt til regionen sitt eige utsnitt
     * pluss litt luft. Eit globalt nett ville blitt projisert langt utanfor
     * gyldig område i ei kjegleprojeksjon og lagt seg som viftestrekar over
     * heile lerretet. albersUsa er unnateke: dei tre innfelte rutene deler
     * ikkje eitt samanhengande gradnett, så nettet ville brote opp der.
     */
    let graticule = ''
    if (projectionSpec.kind !== 'albersUsa') {
      const [[lon0, lat0], [lon1, lat1]] = geoBounds(fitData)
      const g = geoGraticule()
        .step([10, 10])
        .extent([
          [Math.max(-180, lon0 - 10), Math.max(-85, lat0 - 10)],
          [Math.min(180, lon1 + 10), Math.min(85, lat1 + 10)],
        ])
      graticule = path(g()) ?? ''
    }
    // sentrum per feature — brukes til å plassere poeng-popup og treffring
    const centers: Record<string, [number, number]> = {}

    if (geom === 'point') {
      const placed = features.map((f) => {
        const c = (f.geometry as GeoJSON.Point).coordinates
        const xy = projection([c[0], c[1]])
        const p = { id: f.id, x: xy?.[0] ?? -99, y: xy?.[1] ?? -99 }
        centers[f.id] = [p.x, p.y]
        return p
      })
      // Halve avstanden til næraste nabo. Treffflata skal vere så stor som
      // råd, men aldri så stor at ho stel klikk frå punktet ved sida av —
      // hovudstadane i Benelux ligg tettare enn eit fingertupp er breitt.
      const points = placed.map((p) => {
        let gap = Infinity
        for (const q of placed) {
          if (q === p) continue
          gap = Math.min(gap, Math.hypot(q.x - p.x, q.y - p.y) / 2)
        }
        return { ...p, gap }
      })
      return { paths: [], points, basePaths, land, graticule, centers, W }
    }

    const paths = features.map((f) => {
      centers[f.id] = path.centroid(f.geometry) as [number, number]
      return { id: f.id, d: path(f.geometry) ?? '' }
    })
    return { paths, points: [], basePaths, land, graticule, centers, W }
  }, [projectionSpec, fitData, baseData, features, geom])

  /**
   * Kor mange lerretseiningar det går på ein CSS-piksel akkurat no. `viewBox`
   * + `meet` skalerer med den minste av dei to faktorane, og det er den same
   * rekninga her. Utan dette målet ville treffflata vore rett på ein skjerm og
   * feil på alle andre.
   */
  const [unitsPerPx, setUnitsPerPx] = useState(1)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      const scale = Math.min(width / W, height / H)
      if (scale > 0) setUnitsPerPx(1 / scale)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [W])

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
    // havet held fram utanfor sjølve viewBox-en, så letterbox-stripene på
    // breie skjermar les som opent farvatn og ikkje som tom appbakgrunn
    <div className="relative h-full w-full" style={{ background: 'var(--ocean-deep)' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        role="img"
      >
        <defs>
          <radialGradient id={oceanId} cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor="var(--ocean)" />
            <stop offset="100%" stopColor="var(--ocean-deep)" />
          </radialGradient>
          {/* terrenget skal stoppe i fjøresteinane, ikkje renne ut i havet */}
        </defs>

        {/* havet ligg utanfor zoom-gruppa så det alltid dekkjer heile flata */}
        <rect x={0} y={0} width={W} height={H} fill={`url(#${oceanId})`} />

        <g
          transform={transform.toString()}
          style={{ transition: smooth ? 'transform 0.4s ease' : 'none' }}
        >
          <BaseMap
            land={land}
            graticule={graticule}
            basePaths={basePaths}
            shapeId={landShapeId}
          />

          {/*
            Usynlege trykkmål for elvene. Ei elv er teikna 6 px brei — for
            smal for ein finger. Banda ligg *under* dei synlege strekane med
            vilje: der to elver kryssar, skal eit presist trykk rett på streken
            alltid gje den elva du faktisk sikta på, og berre bomskota falle
            ned på bandet.
          */}
          {geom === 'line' &&
            interactive &&
            !disabled &&
            paths.map(({ id, d }) => (
              <path
                key={`hit-${id}`}
                d={d}
                onClick={() => onPick(id)}
                vectorEffect="non-scaling-stroke"
                fill="none"
                stroke="transparent"
                strokeWidth={HIT_PX}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="cursor-pointer"
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
                      : // gjennomsiktig, ikkje «none»: terrenget skal lese
                        // gjennom, men flata må framleis ta imot klikk
                        'transparent'
            return (
              <g key={id}>
                <path
                  d={d}
                  onClick={() => interactive && !disabled && onPick(id)}
                  vectorEffect="non-scaling-stroke"
                  fill={isLine ? 'none' : color}
                  stroke={isLine ? color : 'var(--map-border)'}
                  strokeWidth={isLine ? 6 : 0.9}
                  strokeLinecap={isLine ? 'round' : undefined}
                  strokeLinejoin={isLine ? 'round' : undefined}
                  className={[
                    // 75 ms: raskt nok til å kjennast direkte, men framleis
                    // ei mjuk overgang når status skifter til rett/avslørt
                    'outline-none transition-colors duration-75',
                    hl ? 'animate-breathe' : '',
                    interactive && !disabled
                      ? isLine
                        ? 'cursor-pointer hover:stroke-[var(--accent)]'
                        : 'cursor-pointer hover:fill-[var(--map-idle-hover)]'
                      : 'pointer-events-none',
                  ].join(' ')}
                />
              </g>
            )
          })}

          {/* punkt-features (byer, fjelltopper) — radius kompenseres for zoom */}
          {points.map(({ id, x, y, gap }) => {
            const st = status[id]
            const correct = st === 'correct'
            const revealed = st === 'revealed'
            const wrong = flashId === id && !st
            const hl = highlightId === id
            const r = (hl ? 6 : 5) / k
            // treffflata veks aldri forbi halve naboavstanden, og krympar med
            // zoomen slik at ho held same storleik på skjermen
            const rHit = Math.max(r, Math.min((HIT_PX * unitsPerPx) / k, gap))
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
              <g key={id}>
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
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  vectorEffect="non-scaling-stroke"
                  fill={fill}
                  className="pointer-events-none stroke-white stroke-[1] outline-none transition-colors duration-75"
                />
                {/* usynleg treffflate — ligg øvst, så fingeren treffer ho først */}
                <circle
                  cx={x}
                  cy={y}
                  r={rHit}
                  fill="transparent"
                  onClick={() => interactive && !disabled && onPick(id)}
                  className={
                    interactive && !disabled ? 'cursor-pointer' : 'pointer-events-none'
                  }
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
})

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

/**
 * Alt som ikkje endrar seg medan runden går: sokkel, landmasse, gradnett,
 * kystlinje og bakgrunnsgrenser.
 *
 * Laget er skilt ut og memoisert med vilje. Klokka i HUD-en tikkar ti gonger
 * i sekundet og kvar zoom-gest sender ein straum av oppdateringar; utan denne
 * grensa ville React måtte samanlikne fleire hundre `d`-strengar på kvar av
 * dei. Props her er alle utleidde frå éin `useMemo`, så referansane held seg
 * stabile heilt til projeksjonen eller datasettet faktisk byter.
 */
const BaseMap = memo(function BaseMap({
  land,
  graticule,
  basePaths,
  shapeId,
}: {
  land: string
  graticule: string
  basePaths: { id: string; d: string }[]
  shapeId: string
}) {
  return (
    <>
            {/*
              Landmassen er den dyraste bana på kartet — Noreg åleine er 600 kB
              fjordkyst — og blir brukt fire gonger. Han ligg difor éin gong i
              <defs>, og resten er <use>: nettlesaren held på éi geometri i
              staden for fire, og zoom-gestar blir merkbart billegare.
            */}
            <defs>
              <path id={shapeId} d={land} />
            </defs>

            {/*
              Kontinentalsokkelen: to striper langs kysten, frå djupt til
              grunt. Strekene skalerer ikkje med zoomen, så sokkelen held same
              breidd på skjermen uansett kor langt du er inne.
            */}
            {(
              [
                ['shelf-3', 11],
                ['shelf-1', 4.5],
              ] as const
            ).map(([token, width]) => (
              <use
                key={token}
                href={`#${shapeId}`}
                fill="none"
                stroke={`var(--${token})`}
                strokeWidth={width}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ))}

            {/* landmassen */}
            <use href={`#${shapeId}`} fill="var(--map-land)" pointerEvents="none" />

            {/* gradnett — svakt, over landflata som i eit trykt atlas */}
            {graticule && (
              <path
                d={graticule}
                fill="none"
                stroke="var(--graticule)"
                strokeWidth={0.8}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}

            {/* kystlinja: ei samanhengande strek som skil land frå hav */}
            <use
              href={`#${shapeId}`}
              fill="none"
              stroke="var(--coast)"
              strokeWidth={1.1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />

            {/* bakgrunns-omriss — grensene rundt features som ikkje er i spel */}
            {basePaths.map(({ id, d }) => (
              <path
                key={id}
                d={d}
                vectorEffect="non-scaling-stroke"
                fill="none"
                stroke="var(--map-border)"
                strokeWidth={0.9}
              />
            ))}
    </>
  )
})
