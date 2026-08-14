import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { geoBounds, geoGraticule } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { FeatureCollection } from 'geojson'
import { makeCoarsePath, makePath, makeProjection, naturalAspect } from '../../game/projection'
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

/**
 * Kor mykje zoomen må endre seg før React får vite om det.
 *
 * Sjølve panoreringa og zoomen går utanom React heilt — transformen blir
 * skriven rett på gruppa. Berre punktmarkørane og poengbobla treng å kjenne
 * skalaen, og dei toler å vere eit halvt steg bak: 5 % skilnad på radien til
 * ein prikk er ikkje synleg, men å byggje laget på nytt for kvar musrørsle er
 * det som gjer kartet hakkete.
 */
const K_STEP = 0.05

/**
 * Kor grov geometrien under sokkelstripa er, i lerretseiningar.
 *
 * Sjå `coarsen` i game/projection.ts. 2,5 einingar er under tre piksler på ein
 * telefon ved full utzooming, og stripa som teiknar dei er ni einingar brei.
 */
const SHELF_TOLERANCE = 2.5

/** Kva tilstand ei feature er i akkurat no — styrer farge og klikkbarheit. */
type ShapeState = 'idle' | 'correct' | 'revealed' | 'wrong' | 'target'

const STATE_COLOR: Record<ShapeState, string> = {
  correct: 'var(--success)',
  revealed: 'var(--info)',
  wrong: 'var(--danger)',
  target: 'var(--gold)',
  // gjennomsiktig, ikkje «none»: terrenget skal lese gjennom, men flata må
  // framleis ta imot klikk
  idle: 'transparent',
}

const POINT_COLOR: Record<ShapeState, string> = {
  ...STATE_COLOR,
  idle: 'var(--accent)',
}

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
  /** det rette svaret, vist etter eit bomskot (blå) */
  revealId?: string | null
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
  revealId,
  highlightId,
  award,
  interactive = true,
  onPick,
  disabled,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  /** gruppa all zoom og panorering blir skriven på — utanom React */
  const layerRef = useRef<SVGGElement>(null)
  // useId gjev ':r1:' — kolon må vekk, elles blir url(#…) ein ugyldig selektor
  const uid = useId().replace(/:/g, '')
  const oceanId = `ocean${uid}`
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  /** grovkorna zoomnivå — sjå K_STEP */
  const [k, setK] = useState(1)

  const { paths, points, basePaths, land, shelf, graticule, centers, W } = useMemo(() => {
    const W = Math.round(H * naturalAspect(projectionSpec, fitData))
    const projection = makeProjection(projectionSpec, fitData, W, H)
    const path = makePath(projection)
    const basePaths = baseData
      ? baseData.features.map((f, i) => ({ id: `base-${i}`, d: path(f.geometry) ?? '' }))
      : []

    /*
     * Heile landmassen som éin bane — grunnfarge og kystlinje deler denne
     * geometrien.
     */
    const landGeometry: GeoJSON.GeometryCollection = {
      type: 'GeometryCollection',
      geometries: fitData.features.map((f) => f.geometry),
    }
    const land = path(landGeometry) ?? ''
    // sokkelstripa køyrer på ein grovare kopi — sjå SHELF_TOLERANCE
    const shelf = makeCoarsePath(projection, SHELF_TOLERANCE)(landGeometry) ?? ''

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
      return { paths: [], points, basePaths, land, shelf, graticule, centers, W }
    }

    const paths = features.map((f) => {
      centers[f.id] = path.centroid(f.geometry) as [number, number]
      return { id: f.id, d: path(f.geometry) ?? '' }
    })
    return { paths, points: [], basePaths, land, shelf, graticule, centers, W }
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

  /*
   * d3-zoom: hjul, pinch og dra-panorering.
   *
   * Hendingane kjem ei per musrørsle — fleire hundre i sekundet på ein
   * presisjonspeikar. Dei blir difor samla opp og skrivne éin gong per
   * biletramme, rett på DOM-en. React får berre vite om det når sjølve
   * zoomnivået har flytta seg eit merkbart steg.
   */
  useEffect(() => {
    if (!svgRef.current) return
    const sel = select(svgRef.current)
    let frame = 0
    let pending: ZoomTransform | null = null
    // myk overgang kun for programmatisk zoom (auto-zoom), ikke manuell gest
    let smooth = false
    let lastK = 1

    const flush = () => {
      frame = 0
      const t = pending
      const layer = layerRef.current
      if (!t || !layer) return
      layer.style.transition = smooth ? 'transform 0.4s ease' : 'none'
      layer.setAttribute('transform', t.toString())
      const stepped = Math.max(1, Math.round(t.k / K_STEP) * K_STEP)
      if (stepped !== lastK) {
        lastK = stepped
        setK(stepped)
      }
    }

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
      /*
       * Medan fingeren er nede blir kartet rasterisert på nytt for kvar
       * biletramme. `optimizeSpeed` slår av kantutjamninga så lenge gesten
       * varer: nettlesaren slepp å blande farge langs kvar einaste kant i
       * ei kystlinje på tusenvis av punkt. Skilnaden ser du berre om du
       * frys biletet — og då står kartet stille, og kanten er mjuk igjen.
       */
      .on('start', () => {
        layerRef.current?.setAttribute('shape-rendering', 'optimizeSpeed')
      })
      .on('zoom', (e) => {
        pending = e.transform
        // sourceEvent finnes for bruker-gest; null for programmatisk .transform
        smooth = !e.sourceEvent
        if (!frame) frame = requestAnimationFrame(flush)
      })
      .on('end', () => {
        layerRef.current?.setAttribute('shape-rendering', 'auto')
      })
    zoomRef.current = z
    sel.call(z)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      sel.on('.zoom', null)
    }
  }, [W])

  // auto-zoom inn på markert by (punkt) så den er lett å se i choice/type
  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    if (geom !== 'point' || !highlightId) return
    const p = points.find((pp) => pp.id === highlightId)
    if (!p) return
    const scale = 3
    const t = zoomIdentity.translate(W / 2, H / 2).scale(scale).translate(-p.x, -p.y)
    select(svgRef.current).call(zoomRef.current.transform, t)
  }, [highlightId, geom, points, W])

  const zoomBy = useCallback((factor: number) => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).call(zoomRef.current.scaleBy, factor)
  }, [])
  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
  }, [])

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
        </defs>

        {/* havet ligg utanfor zoom-gruppa så det alltid dekkjer heile flata */}
        <rect x={0} y={0} width={W} height={H} fill={`url(#${oceanId})`} pointerEvents="none" />

        {/*
          Transformen på denne gruppa blir sett imperativt av zoom-effekten
          over. Difor står det ingen `transform`-prop her: hadde React eigd
          attributtet, ville kvar rendring dratt kartet tilbake til den siste
          verdien React kjenner, midt i ein gest.
        */}
        <g ref={layerRef}>
          <BaseMap land={land} shelf={shelf} graticule={graticule} basePaths={basePaths} />

          {geom !== 'point' && (
            <ShapeLayer
              paths={paths}
              isLine={geom === 'line'}
              status={status}
              flashId={flashId}
              revealId={revealId ?? null}
              highlightId={highlightId ?? null}
              live={interactive && !disabled}
              onPick={onPick}
            />
          )}

          {geom === 'point' && (
            <PointLayer
              points={points}
              status={status}
              flashId={flashId}
              revealId={revealId ?? null}
              highlightId={highlightId ?? null}
              live={interactive && !disabled}
              k={k}
              unitsPerPx={unitsPerPx}
              onPick={onPick}
            />
          )}

          {/* treffmarkering: ring som slår ut, og poengene som stiger */}
          {award && awardCenter && (
            <AwardBurst
              key={`award-${award.n}`}
              x={awardCenter[0]}
              y={awardCenter[1]}
              points={award.points}
              k={k}
            />
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

/**
 * Knappane ligg oppå kartflata. Dei hadde `.panel` før, med
 * `backdrop-filter: blur(14px)`: nettlesaren måtte då sløre utsnittet bak
 * knappen på nytt for kvar biletramme medan kartet flytta seg under. Ei
 * ugjennomsiktig flate kostar ingenting og les like tydeleg.
 */
function ZoomBtn({ icon, onClick }: { icon: IconName; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-xl border transition-colors hover:bg-[var(--surface-card)]"
      style={{
        color: 'var(--text)',
        background: 'var(--surface-card)',
        borderColor: 'var(--border)',
      }}
    >
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}

function stateOf(
  id: string,
  status: Record<string, 'correct' | 'revealed'>,
  flashId: string | null,
  revealId: string | null,
  highlightId: string | null,
): ShapeState {
  const resolved = status[id]
  if (resolved) return resolved
  // fasiten kjem før bomskotet: i skrive- og flervalgsmodus er det same id-en
  // som både blei svart feil og er det rette svaret, og då er det fasiten som
  // skal lyse
  if (revealId === id) return 'revealed'
  if (flashId === id) return 'wrong'
  if (highlightId === id) return 'target'
  return 'idle'
}

/**
 * Polygon- og linje-features (fylke, land, elver).
 *
 * Laget tek imot klikk på gruppenivå og les `data-id` frå det som faktisk
 * blei treft. Alternativet — ein `onClick`-lukking per bane — ville laga
 * hundrevis av nye funksjonar for kvar rendring og gjort kvar einaste bane
 * ulik seg sjølv, så `memo` under aldri fekk slå til.
 */
const ShapeLayer = memo(function ShapeLayer({
  paths,
  isLine,
  status,
  flashId,
  revealId,
  highlightId,
  live,
  onPick,
}: {
  paths: { id: string; d: string }[]
  isLine: boolean
  status: Record<string, 'correct' | 'revealed'>
  flashId: string | null
  revealId: string | null
  highlightId: string | null
  live: boolean
  onPick: (id: string) => void
}) {
  /*
   * Andre skanse mot klikk på eit sted som alt er svart.
   *
   * Første er `pointer-events: none` på bana sjølv, og den held for musa. Men
   * hendinga blir fanga her oppe på gruppa, og eit `data-id` kan i prinsippet
   * kome frå eit element som blei teikna i mellomtida. Motoren har den
   * tredje og siste skansen; ingen av dei er dyre, og eit løyst fylke skal
   * aldri kunne koste poeng.
   */
  const handleClick = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      const id = (event.target as Element).getAttribute?.('data-id')
      if (id && !status[id]) onPick(id)
    },
    [status, onPick],
  )

  return (
    <g onClick={live ? handleClick : undefined}>
      {/*
        Usynlege trykkmål for elvene. Ei elv er teikna 6 px brei — for smal
        for ein finger. Banda ligg *under* dei synlege strekane med vilje:
        der to elver kryssar, skal eit presist trykk rett på streken alltid
        gje den elva du faktisk sikta på, og berre bomskota falle ned på
        bandet. Løyste elver får ikkje noko band — dei er ute av spelet.
      */}
      {isLine &&
        live &&
        paths.map(({ id, d }) =>
          status[id] ? null : (
            <path
              key={`hit-${id}`}
              data-id={id}
              d={d}
              vectorEffect="non-scaling-stroke"
              fill="none"
              stroke="transparent"
              strokeWidth={HIT_PX}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="cursor-pointer"
            />
          ),
        )}

      {paths.map(({ id, d }) => (
        <FeatureShape
          key={id}
          id={id}
          d={d}
          isLine={isLine}
          state={stateOf(id, status, flashId, revealId, highlightId)}
          live={live}
        />
      ))}
    </g>
  )
})

/**
 * Éi feature på kartet.
 *
 * Alle props er primitive verdiar, så `memo` kan avgjere på likskap: når
 * eitt svar endrar status på eitt fylke, er det berre det eine som blir
 * teikna om. Resten av kartet står urørt.
 */
const FeatureShape = memo(function FeatureShape({
  id,
  d,
  isLine,
  state,
  live,
}: {
  id: string
  d: string
  isLine: boolean
  state: ShapeState
  live: boolean
}) {
  // eit løyst sted er ute av spelet: det skal korkje ta imot klikk, vise
  // peikar eller lyse opp under musa
  const clickable = live && state !== 'correct' && state !== 'revealed'
  const color = isLine && state === 'idle' ? 'var(--text-subtle)' : STATE_COLOR[state]

  return (
    <path
      data-id={clickable ? id : undefined}
      d={d}
      vectorEffect="non-scaling-stroke"
      fill={isLine ? 'none' : color}
      stroke={isLine ? color : 'var(--map-border)'}
      strokeWidth={isLine ? 6 : 0.9}
      strokeLinecap={isLine ? 'round' : undefined}
      strokeLinejoin={isLine ? 'round' : undefined}
      className={[
        // 75 ms: raskt nok til å kjennast direkte, men framleis ei mjuk
        // overgang når status skifter til rett/avslørt
        'outline-none transition-colors duration-75',
        state === 'target' ? 'animate-breathe' : '',
        clickable
          ? isLine
            ? 'cursor-pointer hover:stroke-[var(--accent)]'
            : 'cursor-pointer hover:fill-[var(--map-idle-hover)]'
          : 'pointer-events-none',
      ].join(' ')}
    />
  )
})

/** Punkt-features (byer, fjelltopper) — radius kompenseres for zoom. */
const PointLayer = memo(function PointLayer({
  points,
  status,
  flashId,
  revealId,
  highlightId,
  live,
  k,
  unitsPerPx,
  onPick,
}: {
  points: { id: string; x: number; y: number; gap: number }[]
  status: Record<string, 'correct' | 'revealed'>
  flashId: string | null
  revealId: string | null
  highlightId: string | null
  live: boolean
  k: number
  unitsPerPx: number
  onPick: (id: string) => void
}) {
  // same tre skansane som i ShapeLayer — sjå kommentaren der
  const handleClick = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      const id = (event.target as Element).getAttribute?.('data-id')
      if (id && !status[id]) onPick(id)
    },
    [status, onPick],
  )

  return (
    <g onClick={live ? handleClick : undefined}>
      {points.map(({ id, x, y, gap }) => {
        const state = stateOf(id, status, flashId, revealId, highlightId)
        const r = (state === 'target' ? 6 : 5) / k
        // treffflata veks aldri forbi halve naboavstanden, og krympar med
        // zoomen slik at ho held same storleik på skjermen
        const rHit = Math.max(r, Math.min((HIT_PX * unitsPerPx) / k, gap))
        return (
          <PointMark
            key={id}
            id={id}
            x={x}
            y={y}
            r={r}
            rHit={rHit}
            state={state}
            live={live}
            k={k}
          />
        )
      })}
    </g>
  )
})

const PointMark = memo(function PointMark({
  id,
  x,
  y,
  r,
  rHit,
  state,
  live,
  k,
}: {
  id: string
  x: number
  y: number
  r: number
  rHit: number
  state: ShapeState
  live: boolean
  k: number
}) {
  const clickable = live && state !== 'correct' && state !== 'revealed'

  return (
    <g>
      {/*
        Ringen rundt det aktive målet pustar med rein CSS. Han var ei
        framer-motion-animasjon som skreiv ein ny `r` seksti gonger i
        sekundet gjennom heile runden — ein JS-driven animasjonssløyfe som
        aldri stod stille, midt oppå det tyngste laget i appen.
      */}
      {state === 'target' && (
        <circle
          cx={x}
          cy={y}
          r={11 / k}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={2 / k}
          pointerEvents="none"
          className="animate-breathe"
        />
      )}
      <circle
        cx={x}
        cy={y}
        r={r}
        vectorEffect="non-scaling-stroke"
        fill={POINT_COLOR[state]}
        className="pointer-events-none stroke-white stroke-[1] outline-none transition-colors duration-75"
      />
      {/* usynleg treffflate — ligg øvst, så fingeren treffer ho først */}
      {clickable && (
        <circle data-id={id} cx={x} cy={y} r={rHit} fill="transparent" className="cursor-pointer" />
      )}
    </g>
  )
})

/**
 * Ringen og «+120» som slår ut der treffet skjedde.
 *
 * Begge var framer-motion-element før. Ein slik komponent tek med seg ein
 * animasjonsmotor som reknar ut nye attributtverdiar i JavaScript seksti
 * gonger i sekundet — midt oppå det tyngste laget i appen, akkurat i det
 * sekundet spelet skal kjennast raskast. To CSS-keyframes gjer det same, på
 * kompositeringstråden, og let hovudtråden halde fram med kartet.
 *
 * Gruppa ber `scale(1/k)`, motsett av zoomen på laget over. Ringen og
 * teksten held difor same storleik på skjermen uansett kor langt inn spelaren
 * har zooma, utan at nokon reknar om radiar per ramme.
 */
const AwardBurst = memo(function AwardBurst({
  x,
  y,
  points,
  k,
}: {
  x: number
  y: number
  points: number
  k: number
}) {
  return (
    <g pointerEvents="none" transform={`translate(${x},${y}) scale(${1 / k})`}>
      <circle
        className="award-ring"
        r={4}
        fill="none"
        stroke="var(--success)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <text
        className="award-points numeric font-bold"
        textAnchor="middle"
        fill="var(--success)"
        stroke="var(--bg)"
        strokeWidth={3}
        paintOrder="stroke"
        fontSize={22}
      >
        +{points}
      </text>
    </g>
  )
})

/**
 * Alt som ikkje endrar seg medan runden går: sokkel, landmasse, gradnett,
 * kystlinje og bakgrunnsgrenser.
 *
 * Laget er skilt ut og memoisert med vilje. Klokka i HUD-en tikkar ti gonger
 * i sekundet; utan denne grensa ville React måtte samanlikne fleire hundre
 * `d`-strengar på kvar av dei. Props her er alle utleidde frå éin `useMemo`,
 * så referansane held seg stabile heilt til projeksjonen eller datasettet
 * faktisk byter.
 *
 * Heile laget er `pointer-events: none`. Kartet gjer treff-test mot kvar
 * einaste synlege bane for kvar musrørsle, og landmassen er den mest
 * detaljerte bana som finst — å ta han ut av treff-testinga er gratis, for
 * han skal aldri kunne klikkast uansett.
 */
const BaseMap = memo(function BaseMap({
  land,
  shelf,
  graticule,
  basePaths,
}: {
  land: string
  shelf: string
  graticule: string
  basePaths: { id: string; d: string }[]
}) {
  return (
    <g pointerEvents="none">
      {/*
        Landmassen er den dyraste bana på kartet — Noreg åleine er tusenvis av
        punkt fjordkyst — og han låg her fire gonger: to sokkelstriper, ei
        fylling og ei kystlinje. Nettlesaren rasteriserte då den same
        geometrien fire gonger for kvar biletramme under ein zoom. No er det
        to passeringar, og den breiaste av dei går på ein grovare kopi.
      */}

      {/* kontinentalsokkelen — ei brei, mjuk stripe langs kysten */}
      <path
        d={shelf}
        fill="none"
        stroke="var(--shelf-3)"
        strokeWidth={9}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* landmassen, med kystlinja som si eiga strek i same passering */}
      <path
        d={land}
        fill="var(--map-land)"
        stroke="var(--coast)"
        strokeWidth={1.1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* gradnett — svakt, over landflata som i eit trykt atlas */}
      {graticule && (
        <path
          d={graticule}
          fill="none"
          stroke="var(--graticule)"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      )}

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
    </g>
  )
})
