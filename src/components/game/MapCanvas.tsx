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
 * Lerretshøyden er fast; bredden følger regionens eget sideforhold, så
 * både det høye Norge og det brede Europa fyller flata.
 */
const H = 900

/**
 * Ønsket treffradius for punkt-features, i CSS-piksler.
 *
 * En by er tegnet med radius 5 i lerretskoordinater. På en telefon der 900
 * lerretsenheter blir presset ned i ~500 px er den prikken under 3 px bred —
 * langt under de 44 px i diameter både Apple og Google setter som minstemål for
 * et trykkmål. Selve prikken skal ikke vokse (kartet blir uleselig), så i
 * stedet ligger det en usynlig treffflate over.
 */
const HIT_PX = 22

/**
 * Hvor mye zoomen må endre seg før React får vite om det.
 *
 * Selve panoreringen og zoomen går utenom React helt — transformen blir
 * skrevet rett på gruppa. Bare punktmarkørene og poengbobla trenger å kjenne
 * skalaen, og de tåler å være et halvt steg bak: 5 % forskjell på radien til
 * en prikk er ikke synlig, men å bygge laget på nytt for hver musbevegelse er
 * det som gjør kartet hakkete.
 */
const K_STEP = 0.05

/**
 * Hvor grov geometrien under sokkelstripa er, i lerretsenheter.
 *
 * Se `coarsen` i game/projection.ts. 2,5 enheter er under tre piksler på en
 * telefon ved full utzooming, og stripa som tegner dem er ni enheter bred.
 */
const SHELF_TOLERANCE = 2.5

/** Hvilken tilstand en feature er i akkurat nå — styrer farge og klikkbarhet. */
type ShapeState = 'idle' | 'correct' | 'revealed' | 'wrong' | 'target'

/**
 * En projisert flate, med det `SmallTargets` trenger for å måle den: midtpunkt
 * og største utstrekning, i lerretsenheter.
 */
interface MeasuredPath {
  id: string
  d: string
  cx: number
  cy: number
  size: number
}

const STATE_COLOR: Record<ShapeState, string> = {
  correct: 'var(--success)',
  revealed: 'var(--info)',
  wrong: 'var(--danger)',
  target: 'var(--gold)',
  // gjennomsiktig, ikke «none»: terrenget skal lese gjennom, men flata må
  // fortsatt ta imot klikk
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
  /** det rette svaret, vist etter et bomskudd (blå) */
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
 * Kartet re-renderer bare når spillet faktisk endrer seg. `GameScreen` tegner
 * seg selv på nytt hver 100 ms for klokka; uten denne grensa ville hele
 * kartet — flere hundre baner — bli avstemt ti ganger i sekundet.
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
  /** gruppa all zoom og panorering blir skrevet på — utenom React */
  const layerRef = useRef<SVGGElement>(null)
  // useId gir ':r1:' — kolon må vekk, ellers blir url(#…) en ugyldig selektor
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
    // sokkelstripa kjører på en grovere kopi — se SHELF_TOLERANCE
    const shelf = makeCoarsePath(projection, SHELF_TOLERANCE)(landGeometry) ?? ''

    /*
     * Lengde- og breddegradsnettet, klippet til regionens eget utsnitt
     * pluss litt luft. Et globalt nett ville blitt projisert langt utenfor
     * gyldig område i en kjegleprojeksjon og lagt seg som viftestreker over
     * hele lerretet. albersUsa er unntatt: de tre innfelte rutene deler
     * ikke ett sammenhengende gradnett, så nettet ville brutt opp der.
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
      // Halve avstanden til nærmeste nabo. Treffflata skal være så stor som
      // mulig, men aldri så stor at den stjeler klikk fra punktet ved siden av —
      // hovedstedene i Benelux ligger tettere enn et fingertupp er bredt.
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

    /*
     * Hvor stor flata blir på lerretet, og halve avstanden til nærmeste nabo.
     * Begge blir målt her fordi de bare endrer seg med projeksjonen — ikke
     * med zoomen. `SmallTargets` bruker de to tallene til å avgjøre hvem som er
     * for liten til å kunne trykkes på; se kommentaren der.
     */
    const measured = features.map((f) => {
      const c = path.centroid(f.geometry) as [number, number]
      centers[f.id] = c
      const [[x0, y0], [x1, y1]] = path.bounds(f.geometry)
      // en tom eller ugyldig geometri får uendelig størrelse: da blir den aldri
      // regnet som for liten, og ingen usynlig flate blir lagt ut for den
      const size = Number.isFinite(x0) ? Math.max(x1 - x0, y1 - y0) : Infinity
      return { id: f.id, d: path(f.geometry) ?? '', cx: c[0], cy: c[1], size }
    })
    return { paths: measured, points: [], basePaths, land, shelf, graticule, centers, W }
  }, [projectionSpec, fitData, baseData, features, geom])

  /**
   * Hvor mange lerretsenheter det går på en CSS-piksel akkurat nå. `viewBox`
   * + `meet` skalerer med den minste av de to faktorene, og det er den samme
   * regningen her. Uten dette målet ville treffflata vært rett på en skjerm og
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
   * Hendingene kommer én per musbevegelse — flere hundre i sekundet på en
   * presisjonspeker. De blir derfor samlet opp og skrevet én gang per
   * bilderamme, rett på DOM-en. React får bare vite om det når selve
   * zoomnivået har flyttet seg et merkbart steg.
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
       * Mens fingeren er nede blir kartet rasterisert på nytt for hver
       * bilderamme. `optimizeSpeed` slår av kantutjevningen så lenge gesten
       * varer: nettleseren slipper å blande farge langs hver eneste kant i
       * en kystlinje på tusenvis av punkt. Forskjellen ser du bare om du
       * fryser bildet — og da står kartet stille, og kanten er myk igjen.
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
    // havet fortsetter utenfor selve viewBox-en, så letterbox-stripene på
    // brede skjermer leser som åpent farvann og ikke som tom appbakgrunn
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

        {/* havet ligger utenfor zoom-gruppa så det alltid dekker hele flata */}
        <rect x={0} y={0} width={W} height={H} fill={`url(#${oceanId})`} pointerEvents="none" />

        {/*
          Transformen på denne gruppa blir satt imperativt av zoom-effekten
          over. Derfor står det ingen `transform`-prop her: hadde React eid
          attributtet, ville hver rendring dratt kartet tilbake til den siste
          verdien React kjenner, midt i en gest.
        */}
        <g ref={layerRef}>
          <BaseMap land={land} shelf={shelf} graticule={graticule} basePaths={basePaths} />

          {/*
            Usynlige trykkmål for de minste landene. Laget ligger *under*
            ShapeLayer med vilje — samme grunn som elvebåndene: et presist trykk
            rett på Italia skal alltid gi Italia, og bare klikk som bommer på
            alle synlige flater faller ned hit.
          */}
          {geom === 'polygon' && (
            <SmallTargets
              paths={paths}
              status={status}
              live={interactive && !disabled}
              k={k}
              unitsPerPx={unitsPerPx}
              onPick={onPick}
            />
          )}

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
 * Knappene ligger oppå kartflata. De hadde `.panel` før, med
 * `backdrop-filter: blur(14px)`: nettleseren måtte da sløre utsnittet bak
 * knappen på nytt for hver bilderamme mens kartet flyttet seg under. En
 * ugjennomsiktig flate koster ingenting og leser like tydelig.
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
  // fasiten kommer før bomskuddet: i skrive- og flervalgsmodus er det samme id-en
  // som både ble svart feil og er det rette svaret, og da er det fasiten som
  // skal lyse
  if (revealId === id) return 'revealed'
  if (flashId === id) return 'wrong'
  if (highlightId === id) return 'target'
  return 'idle'
}

/**
 * Usynlige trykkmål for flater som er for små til å kunne trykkes på.
 *
 * Malta er 0,39 grader bred. På et Europa-kart som spenner 72 grader blir
 * øya tre-fire piksler — tegnet, men i praksis utreffbar, og det er nettopp
 * derfor mikrostatene har vært holdt utenfor datasettene med vilje. En flate
 * som er mindre enn trykkmålet får derfor en usynlig sirkel på størrelse med
 * fingertuppen, akkurat som byene i `PointLayer`.
 *
 * To ting holder sirklene fra å stjele klikk. Laget ligger under de synlige
 * flatene, så et trykk som treffer Italia er Italia — bare bomskudd ned i
 * havet faller hit. Og radien vokser aldri forbi halve avstanden til nærmeste
 * nabo, så to små naboland kan ikke dekke hverandre.
 *
 * Laget er skilt fra `ShapeLayer` fordi det er det eneste som trenger å vite om
 * zoomen. Hadde de vært ett, måtte alle de hundre banene til ShapeLayer
 * blitt avstemt på nytt for hvert zoom-steg.
 */
const SmallTargets = memo(function SmallTargets({
  paths,
  status,
  live,
  k,
  unitsPerPx,
  onPick,
}: {
  paths: MeasuredPath[]
  status: Record<string, 'correct' | 'revealed'>
  live: boolean
  k: number
  unitsPerPx: number
  onPick: (id: string) => void
}) {
  // samme tre skansene som i ShapeLayer — se kommentaren der
  const handleClick = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      const id = (event.target as Element).getAttribute?.('data-id')
      if (id && !status[id]) onPick(id)
    },
    [status, onPick],
  )

  /** fingertuppen målt i lerretsenheter ved gjeldende zoom */
  const reach = (HIT_PX * unitsPerPx) / k

  /*
   * Hvem som trenger hjelp, og hvor stor hjelpa kan bli.
   *
   * Avstanden blir målt bare mot de andre små flatene, ikke mot alle. En
   * sirkel som ligger *under* de synlige banene kan ikke stjele et klikk fra
   * Italia uansett hvor stor den er — Italia tar imot sitt eget klikk først.
   * Det eneste to sirkler kan kollidere med, er hverandre.
   *
   * Målt mot alle ble Vatikanstaten kappet av midtpunktet til Italia, som ligger
   * et par hundre kilometer unna, og satt igjen med en treffflate på fjorten
   * piksler — like liten som landet var fra før.
   */
  const small = live
    ? paths.filter(
        (p) => p.size < 2 * reach && !status[p.id] && Number.isFinite(p.cx) && Number.isFinite(p.cy),
      )
    : []

  if (!small.length) return null

  return (
    <g onClick={handleClick}>
      {small.map((p) => {
        let gap = Infinity
        for (const q of small) {
          if (q === p) continue
          gap = Math.min(gap, Math.hypot(q.cx - p.cx, q.cy - p.cy) / 2)
        }
        return (
          <circle
            key={`hit-${p.id}`}
            data-id={p.id}
            cx={p.cx}
            cy={p.cy}
            r={Math.max(p.size / 2, Math.min(reach, gap))}
            fill="transparent"
            className="cursor-pointer"
          />
        )
      })}
    </g>
  )
})

/**
 * Polygon- og linje-features (fylke, land, elver).
 *
 * Laget tar imot klikk på gruppenivå og leser `data-id` fra det som faktisk
 * ble truffet. Alternativet — en `onClick`-lukking per bane — ville laget
 * hundrevis av nye funksjoner for hver rendring og gjort hver eneste bane
 * ulik seg selv, så `memo` under aldri fikk slå til.
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
  paths: MeasuredPath[]
  isLine: boolean
  status: Record<string, 'correct' | 'revealed'>
  flashId: string | null
  revealId: string | null
  highlightId: string | null
  live: boolean
  onPick: (id: string) => void
}) {
  /*
   * Andre skanse mot klikk på et sted som alt er svart.
   *
   * Første er `pointer-events: none` på bana selv, og den holder for musa. Men
   * hendinga blir fanget her oppe på gruppa, og en `data-id` kan i prinsippet
   * komme fra et element som ble tegnet i mellomtiden. Motoren har den
   * tredje og siste skansen; ingen av dem er dyre, og et løst fylke skal
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
        Usynlige trykkmål for elvene. En elv er tegnet 6 px bred — for smal
        for en finger. Båndene ligger *under* de synlige strekene med vilje:
        der to elver krysser, skal et presist trykk rett på streken alltid
        gi den elva du faktisk siktet på, og bare bomskuddene falle ned på
        båndet. Løste elver får ikke noe bånd — de er ute av spillet.
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
 * Én feature på kartet.
 *
 * Alle props er primitive verdier, så `memo` kan avgjøre på likhet: når
 * ett svar endrer status på ett fylke, er det bare det ene som blir
 * tegnet om. Resten av kartet står urørt.
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
  // et løst sted er ute av spillet: det skal verken ta imot klikk, vise
  // peker eller lyse opp under musa
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
        // 75 ms: raskt nok til å kjennes direkte, men fortsatt en myk
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
  // samme tre skansene som i ShapeLayer — se kommentaren der
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
        // treffflata vokser aldri forbi halve naboavstanden, og krymper med
        // zoomen slik at den holder samme størrelse på skjermen
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
        Ringen rundt det aktive målet puster med ren CSS. Den var en
        framer-motion-animasjon som skrev en ny `r` seksti ganger i
        sekundet gjennom hele runden — en JS-driven animasjonssløyfe som
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
      {/* usynlig treffflate — ligger øverst, så fingeren treffer den først */}
      {clickable && (
        <circle data-id={id} cx={x} cy={y} r={rHit} fill="transparent" className="cursor-pointer" />
      )}
    </g>
  )
})

/**
 * Ringen og «+120» som slår ut der treffet skjedde.
 *
 * Begge var framer-motion-element før. En slik komponent tar med seg en
 * animasjonsmotor som regner ut nye attributtverdier i JavaScript seksti
 * ganger i sekundet — midt oppå det tyngste laget i appen, akkurat i det
 * sekundet spillet skal kjennes raskest. To CSS-keyframes gjør det samme, på
 * kompositeringstråden, og lar hovedtråden fortsette med kartet.
 *
 * Gruppa bærer `scale(1/k)`, motsatt av zoomen på laget over. Ringen og
 * teksten holder derfor samme størrelse på skjermen uansett hvor langt inn
 * spilleren har zoomet, uten at noen regner om radier per ramme.
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
 * Alt som ikke endrer seg mens runden går: sokkel, landmasse, gradnett,
 * kystlinje og bakgrunnsgrenser.
 *
 * Laget er skilt ut og memoisert med vilje. Klokka i HUD-en tikker ti ganger
 * i sekundet; uten denne grensa ville React måtte sammenligne flere hundre
 * `d`-strenger på hver av dem. Props her er alle utledet fra én `useMemo`,
 * så referansene holder seg stabile helt til projeksjonen eller datasettet
 * faktisk byttes.
 *
 * Hele laget er `pointer-events: none`. Kartet gjør treff-test mot hver
 * eneste synlige bane for hver musbevegelse, og landmassen er den mest
 * detaljerte bana som finnes — å ta den ut av treff-testingen er gratis, for
 * den skal aldri kunne klikkes uansett.
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
        Landmassen er den dyreste bana på kartet — Norge alene er tusenvis av
        punkt fjordkyst — og den lå her fire ganger: to sokkelstriper, en
        fylling og en kystlinje. Nettleseren rasteriserte da den samme
        geometrien fire ganger for hver bilderamme under en zoom. Nå er det
        to passeringer, og den bredeste av dem går på en grovere kopi.
      */}

      {/* kontinentalsokkelen — en bred, myk stripe langs kysten */}
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

      {/* gradnett — svakt, over landflata som i et trykt atlas */}
      {graticule && (
        <path
          d={graticule}
          fill="none"
          stroke="var(--graticule)"
          strokeWidth={0.8}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* bakgrunns-omriss — grensene rundt features som ikke er i spill */}
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
