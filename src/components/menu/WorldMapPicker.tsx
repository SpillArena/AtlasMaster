import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import type { FeatureCollection, Feature } from "geojson";
import { makePath, makeProjection, naturalAspect } from "../../game/projection";
import { childRegions, getRegion, regions } from "../../game/regions";
import { bestForRegion } from "../../game/progress";
import { playSfx } from "../../game/sfx";
import type { ProjectionSpec } from "../../game/types";
import { Icon } from "../Icon";
import { REGION_COLOR } from "./skins";

interface Props {
  onPick: (regionId: string) => void;
}

const W = 960;
/**
 * Hvor popoveren for «Verden» står. Verden har ingen flekk og derfor ingen
 * etikett å henge den på; midt i Stillehavet er det plass.
 */
const WORLD_ANCHOR: [number, number] = [-150, -8];

/** Verdenskartet tegnes alltid i Natural Earth, uansett hvilken region du ender i. */
const WORLD_PROJECTION: ProjectionSpec = { kind: "naturalEarth" };

/**
 * M49-landkodene hver spillbare region dekker. Rekkefølgen betyr noe: et land
 * som er med i to lister (Norge ligger også i Europa, Russland i både Asia og
 * Europa) havner i den første som treffer.
 */
const EUROPE_IDS = new Set([
  8, 40, 56, 70, 100, 112, 191, 196, 203, 208, 233, 246, 250, 276, 300, 348,
  352, 372, 380, 428, 440, 442, 470, 498, 499, 528, 578, 616, 620, 642, 643,
  688, 703, 705, 724, 752, 756, 804, 807, 826,
]);
const ASIA_IDS = new Set([
  4, 31, 50, 51, 64, 96, 104, 116, 144, 156, 158, 268, 356, 360, 364, 368, 376,
  392, 398, 400, 408, 410, 414, 417, 418, 422, 458, 496, 512, 524, 586, 608,
  626, 634, 643, 682, 704, 760, 762, 764, 784, 792, 795, 860, 887,
]);

/*
 * Afrika, med Vest-Sahara (732) på slutten.
 *
 * 732 er ikke et svar i noen kategori — området har ingen ubestridt stat å
 * gjette på, og build-africa.mjs lar det stå utenfor datasettet. På
 * landingssida er spørsmålet et annet: alt som ikke blir klassifisert her
 * havner i «Verden» og får verdensfargen, og da hadde det ligget et gråblekt
 * hull midt i Sahara mellom Marokko og Mauritania. Her er det altså kulisse,
 * ikke svar — samme skille som `playable` gjør i verdensdatasettet.
 */
const AFRICA_IDS = new Set([
  12, 24, 72, 108, 120, 132, 140, 148, 174, 178, 180, 204, 226, 231, 232, 262,
  266, 270, 288, 324, 384, 404, 426, 430, 434, 450, 454, 466, 478, 480, 504,
  508, 516, 562, 566, 624, 646, 678, 686, 690, 694, 706, 710, 716, 728, 729,
  748, 768, 788, 800, 818, 834, 854, 894,
  732,
]);
const SOUTH_AMERICA_IDS = new Set([
  32, 68, 76, 152, 170, 218, 328, 600, 604, 740, 858, 862,
]);
const NORTH_AMERICA_IDS = new Set([
  28, 44, 52, 84, 124, 188, 192, 212, 214, 222, 308, 320, 332, 340, 388, 484,
  558, 591, 659, 662, 670, 780, 840, 304, 660, 533, 60, 92, 136, 531, 500,
  630, 652, 663, 666, 534, 796, 850,
]);
const OCEANIA_IDS = new Set([
  36, 242, 296, 520, 554, 583, 584, 585, 598, 882, 90, 776, 798, 548,
  16, 184, 316, 540, 570, 580, 574, 258, 612, 772, 876,
]);

interface RegionSkin {
  id: string;
  labelKey: string;
  color: string;
  match: (code: number) => boolean;
  /**
   * Hvor etiketten skal stå, i lengde-/breddegrad.
   *
   * Den ble regnet ut av midtpunktet i regionens samlede omslutningsboks før,
   * med tre håndsatte piksel-dytt for å rette opp etterpå. Det holder ikke:
   * USA-boksen strekker seg fra Aleutene til Maine, altså nesten hele kartet,
   * og midtpunktet havner ute i Atlanterhavet. Russland gjør det samme med
   * Europa. Et punkt på kloden er ikke bare stabilt — det er lesbart, og det
   * flytter seg ikke når datasettet får et land til.
   */
  anchor: [number, number];
}

/**
 * USA har ingen egen flekk: landet er en del av Nord-Amerika, og delstatene
 * er et valg inne i Nord-Amerika-menyen (se `Region.parent`). Norge sjekkes
 * først; Asia kommer før Europa — se kommentaren over
 * id-listene. Fargene er mettede nok til å skille seg fra hverandre på det
 * mørke nattkartet, og mørke nok til at hvite etiketter leses oppå dem.
 */
const REGION_SKINS: RegionSkin[] = [
  // Norge-etiketten står i Norskehavet, vest for landet: fastlandet er smalt,
  // og et navn oppå det dekker halve regionen man skal kunne se og trykke på.
  {
    id: "norway",
    labelKey: "region.norway",
    color: REGION_COLOR.norway,
    match: (c) => c === 578,
    anchor: [2, 66],
  },
  {
    id: "northAmerica",
    labelKey: "region.northAmerica",
    color: REGION_COLOR.northAmerica,
    match: (c) => NORTH_AMERICA_IDS.has(c),
    // sørlige Canada: med USA inne er dette midt i landmassen, ikke helt nord
    anchor: [-100, 52],
  },
  {
    id: "oceania",
    labelKey: "region.oceania",
    color: REGION_COLOR.oceania,
    match: (c) => OCEANIA_IDS.has(c),
    anchor: [147, -25],
  },
  {
    id: "antarctica",
    labelKey: "region.antarctica",
    color: REGION_COLOR.antarctica,
    match: (c) => c === 10,
    anchor: [20, -78],
  },
  {
    id: "asia",
    labelKey: "region.asia",
    color: REGION_COLOR.asia,
    match: (c) => ASIA_IDS.has(c),
    anchor: [92, 44],
  },
  // Egypt (818) ligger verken i EUROPE_IDS eller ASIA_IDS, så Afrika kan stå
  // hvor som helst i lista uten å ta et land fra noen. Plassen her, etter
  // Asia, holder oppgjøret om Russland og Norge nøyaktig som det var.
  {
    id: "africa",
    labelKey: "region.africa",
    // olivengrønn, ikke enda en brun ved siden av Asias okergule — to
    // jordfarger var ikke til å skille fra hverandre i prikkene under kartet.
    color: REGION_COLOR.africa,
    match: (c) => AFRICA_IDS.has(c),
    // Sentral-Afrika, nord for Kongobassenget: kontinentet er bredest her, og
    // navnet får luft på begge sider uten å legge seg over Guineabukta.
    anchor: [20, 2],
  },
  {
    id: "southAmerica",
    labelKey: "region.southAmerica",
    // stålblå, ikke enda en jordfarge: Norge er den eneste andre kalde
    // tonen på kartet, og ligger på motsatt kant — ingen forveksling der.
    color: REGION_COLOR.southAmerica,
    match: (c) => SOUTH_AMERICA_IDS.has(c),
    // Brasils innland, sør for Amazonas — kontinentet er bredest her.
    anchor: [-58, -12],
  },
  // sør for Østersjøen, klar av både Norge-etiketten og det russiske feltet
  {
    id: "europe",
    labelKey: "region.europe",
    color: REGION_COLOR.europe,
    match: (c) => EUROPE_IDS.has(c),
    anchor: [16, 47],
  },
];

/**
 * Fransk Guyana har Frankrikes ID (250), men ligger i Sør-Amerika. Andre
 * franske og nederlandske oversjøiske polygoner klassifiseres også per ring
 * når de ligger i Nord-Amerika eller Oseania.
 */
const FRENCH_GUIANA_BOX = { minLon: -55, maxLon: -51, minLat: 1, maxLat: 6 };

function classify(code: number, centre?: [number, number]): string {
  if (code === 250 && centre && inBox(centre, FRENCH_GUIANA_BOX)) return "southAmerica";
  if ((code === 250 || code === 528) && centre) {
    if (inBox(centre, { minLon: -90, maxLon: -52, minLat: 10, maxLat: 30 })) return "northAmerica";
    if (inBox(centre, { minLon: 110, maxLon: 180, minLat: -50, maxLat: 22 }) ||
        inBox(centre, { minLon: -180, maxLon: -125, minLat: -50, maxLat: 10 })) return "oceania";
  }
  for (const skin of REGION_SKINS) if (skin.match(code)) return skin.id;
  return "world";
}

function inBox([lon, lat]: [number, number], box: typeof FRENCH_GUIANA_BOX): boolean {
  return lon >= box.minLon && lon <= box.maxLon && lat >= box.minLat && lat <= box.maxLat;
}

function codeOf(f: Feature): number {
  const raw = (f.properties as { id?: string | number } | null)?.id ?? f.id;
  return Number(raw);
}

/** Midtpunktet i en ring — brukt til å avgjøre hvilken side av et unntak den hører til. */
function ringCentre(ring: number[][]): [number, number] {
  let lon = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lon += x;
    lat += y;
  }
  return [lon / ring.length, lat / ring.length];
}

interface Shape {
  d: string;
  region: string;
}

interface Built {
  shapes: Shape[];
  /** midtpunkt for regionetiketten, i lerretskoordinater */
  labels: Record<string, [number, number]>;
  height: number;
  path: ReturnType<typeof makePath>;
}


/** «49.0° N · 18.0° E» — HUD-avlesningen nederst i kartpanelet. */
function formatCoord([lon, lat]: [number, number]): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `LAT ${Math.abs(lat).toFixed(1)}° ${ns} · LON ${Math.abs(lon).toFixed(1)}° ${ew}`;
}

const anchorOf = (id: string): [number, number] =>
  REGION_SKINS.find((s) => s.id === id)?.anchor ?? WORLD_ANCHOR;

/**
 * Landingssiden: hele kloden som ett kart, og kartet er selve menyen.
 *
 * Første trykk på en region velger den og åpner et kort med hva regionen
 * har; «Spill» i kortet, eller et nytt trykk på samme region, går inn. To
 * steg i stedet for ett er med vilje: på en telefon er Norge et par
 * millimeter bredt, og et bomtrykk skal vise feil region, ikke sende deg inn
 * i den. Lista under kartet går rett inn — der er det ingenting å bomme på.
 */
export function WorldMapPicker({ onPick }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [inner, setInner] = useState<FeatureCollection | null>(null);
  const playRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getRegion("world")!.outline(), getRegion("antarctica")!.outline()])
      .then(([world, antarctica]) => {
        if (alive) setData({ type: "FeatureCollection", features: [...world.features, ...antarctica.features] });
      });
    /*
     * De indre grensene hentes ved siden av, ikke sammen med kloden. De er
     * pynt: kartet skal ikke vente på dem, og skulle de feile, er USA, Canada
     * og Mexico bare ett land hver igjen, slik de var.
     */
    import("../../data/landing/borders.json")
      .then((m) => {
        if (alive) setInner(m.default as unknown as FeatureCollection);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Escape lukker kortet. App-ens egen Escape-lytter («tilbake») står over
   * enhver `role="dialog"` i DOM-en, så den gjør ingenting mens kortet er
   * åpent — på forsiden er det uansett ingenting å gå tilbake til.
   */
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  /*
   * Fokus til «Spill» når kortet åpner, så Enter fullfører valget. På en
   * telefon ligger kortet under kartet og kan havne under kanten av skjermen —
   * da rulles det fram, så trykket på kartet faktisk viser noe.
   */
  useEffect(() => {
    if (!selected) return;
    const play = playRef.current;
    play?.focus({ preventScroll: true });
    play?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const built = useMemo<Built | null>(() => {
    if (!data) return null;
    const aspect = naturalAspect(WORLD_PROJECTION, data);
    const height = Math.round(W / aspect);
    const projection = makeProjection(WORLD_PROJECTION, data, W, height, 4);
    const path = makePath(projection);

    const shapes: Shape[] = [];
    for (const f of data.features) {
      const code = codeOf(f);
      // Frankrike og Nederland har oversjøiske ringer i andre regioner. Bare
      // MultiPolygon-features splittes per polygon; alle andre tegnes som
      // én sammenhengende sti, som før.
      if ((code === 250 || code === 528) && f.geometry.type === "MultiPolygon") {
        for (const polygon of f.geometry.coordinates) {
          const d = path({ type: "Polygon", coordinates: polygon });
          if (!d) continue;
          shapes.push({ d, region: classify(code, ringCentre(polygon[0])) });
        }
        continue;
      }
      const d = path(f.geometry);
      if (!d) continue;
      shapes.push({ d, region: classify(code) });
    }

    const labels: Record<string, [number, number]> = {};
    for (const skin of REGION_SKINS) {
      const xy = projection(skin.anchor);
      if (xy) labels[skin.id] = [xy[0], xy[1]];
    }
    const worldXy = projection(WORLD_ANCHOR);
    if (worldXy) labels.world = [worldXy[0], worldXy[1]];

    return { shapes, labels, height, path };
  }, [data]);

  /*
   * Delstats- og provinsgrensene i USA, Canada og Mexico, én sti per region.
   * Alle de andre store landmassene har landegrenser tegnet inn; de tre var
   * hver sin tomme flate og så ut som hull i mønsteret. Bare de *indre*
   * grensene — kysten og riksgrensene tegner verdenskartet allerede. Se
   * scripts/build-landing-borders.mjs.
   */
  const innerByRegion = useMemo(() => {
    const groups: Record<string, string> = {};
    if (!built || !inner) return groups;
    for (const f of inner.features) {
      const d = built.path(f.geometry);
      if (!d) continue;
      const region = classify(codeOf(f));
      groups[region] = (groups[region] ?? "") + d;
    }
    return groups;
  }, [built, inner]);

  const byRegion = useMemo(() => {
    const groups: Record<string, string[]> = { world: [] };
    for (const skin of REGION_SKINS) groups[skin.id] = [];
    for (const s of built?.shapes ?? []) groups[s.region].push(s.d);
    return groups;
  }, [built]);

  const go = (regionId: string) => {
    playSfx("ui");
    onPick(regionId);
  };

  /** Første trykk velger, andre trykk på samme region går inn. */
  const choose = (regionId: string) => {
    if (selected === regionId) {
      go(regionId);
      return;
    }
    playSfx("ui");
    setSelected(regionId);
  };

  const focus = hover ?? selected;
  const pct = (id: string) => {
    const p = built?.labels[id];
    return p && built ? { x: (p[0] / W) * 100, y: (p[1] / built.height) * 100 } : null;
  };
  const selectedAt = selected ? pct(selected) : null;
  const selectedRegion = selected ? getRegion(selected) : undefined;
  const selectedChildren = selected ? childRegions(selected) : [];
  const selectedSkin = REGION_SKINS.find((s) => s.id === selected);
  const selectedBest = selected ? bestForRegion(selected) : 0;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4">
      <motion.section
        aria-label={t("region.title")}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-[32px] border border-[var(--border)] bg-[var(--color-surface-elevated)] px-3 pb-6 pt-12 sm:px-7 md:pb-14"
      >
        {/* HUD-hjørnene */}
        <span className="hud-label absolute left-5 top-5 sm:left-6">{t("region.select")}</span>
        <span className="hud-label absolute right-5 top-5 flex items-center gap-2 sm:right-6">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-[var(--color-primary)] shadow-[var(--glow)]"
          />
          {t("region.online", { count: regions.length })}
        </span>
        <span aria-hidden className="hud-label absolute bottom-5 left-5 hidden normal-case tracking-normal sm:left-6 md:block">
          {focus ? formatCoord(anchorOf(focus)) : " "}
        </span>
        <button
          type="button"
          onClick={() => go("world")}
          className="absolute bottom-3 right-3 hidden min-h-11 items-center gap-2 rounded-full bg-[var(--text)] px-4 text-sm font-bold text-[var(--bg)] transition-transform hover:-translate-y-px sm:right-5 md:inline-flex"
        >
          <Icon name="globe" className="h-4 w-4" />
          {t("region.wholeWorld")}
        </button>

        {/*
          Kartet og kortet deler én ramme. Fra `md` ligger kortet oppå kartet,
          ved siden av regionen; på en telefon er kartet for lite til det, og
          kortet legger seg under i stedet.
        */}
        <div className="relative">
          <div
            className="relative w-full"
            style={{ aspectRatio: built ? `${W} / ${built.height}` : "960 / 500" }}
          >
            {built && (
              <svg
                viewBox={`0 0 ${W} ${built.height}`}
                preserveAspectRatio="xMidYMid meet"
                className="absolute inset-0 h-full w-full"
                role="group"
                aria-label={t("region.title")}
              >
                {/* havet — trykk utenfor en region lukker kortet */}
                <rect
                  x={0}
                  y={0}
                  width={W}
                  height={built.height}
                  fill="var(--color-water)"
                  fillOpacity={0.35}
                  onClick={() => setSelected(null)}
                />

                {/* alt land som ikke tilhører en egen region — Verden */}
                <g
                  className="cursor-pointer"
                  onClick={() => choose("world")}
                  onMouseEnter={() => setHover("world")}
                  onMouseLeave={() => setHover((h) => (h === "world" ? null : h))}
                >
                  {byRegion.world.map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="var(--color-land)"
                      fillOpacity={focus === "world" ? 1 : 0.85}
                      stroke="var(--color-surface-elevated)"
                      strokeWidth={0.6}
                    />
                  ))}
                </g>

                {/* de fargelagte regionene, minste øverst så små land tar imot klikk */}
                {REGION_SKINS.map((skin) => {
                  const active = focus === skin.id;
                  const dim = Boolean(selected) && selected !== skin.id;
                  return (
                    <g
                      key={skin.id}
                      role="button"
                      tabIndex={0}
                      aria-label={t(skin.labelKey)}
                      aria-pressed={selected === skin.id}
                      className="cursor-pointer outline-none"
                      onClick={() => choose(skin.id)}
                      onMouseEnter={() => setHover(skin.id)}
                      onMouseLeave={() => setHover((h) => (h === skin.id ? null : h))}
                      onFocus={() => setHover(skin.id)}
                      onBlur={() => setHover((h) => (h === skin.id ? null : h))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          choose(skin.id);
                        }
                      }}
                    >
                      {byRegion[skin.id].map((d, i) => (
                        <path
                          key={i}
                          d={d}
                          fill={skin.color}
                          fillOpacity={active ? 1 : dim ? 0.45 : 0.82}
                          stroke="var(--color-surface-elevated)"
                          strokeWidth={active ? 0.9 : 0.6}
                          className="transition-[fill-opacity] duration-200"
                        />
                      ))}
                      {/*
                        Tynnere enn landegrensene: en delstat er ikke et land, og
                        kartet skal fortsatt lese regionen som én flate.
                      */}
                      {innerByRegion[skin.id] && (
                        <path
                          d={innerByRegion[skin.id]}
                          fill="none"
                          stroke="var(--color-surface-elevated)"
                          strokeOpacity={0.5}
                          strokeWidth={0.35}
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />
                      )}
                    </g>
                  );
                })}

                {/* ringen rundt valgt region */}
                {selected && selected !== "world" && built.labels[selected] && (
                  <motion.circle
                    key={selected}
                    cx={built.labels[selected][0]}
                    cy={built.labels[selected][1]}
                    r={30}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    pointerEvents="none"
                    initial={{ opacity: 0, scale: 1.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  />
                )}
              </svg>
            )}

            {/*
              Etikettene er HTML, ikke SVG-tekst: de er knapper man kan tabbe
              til, de holder lesbar størrelse uansett hvor stort kartet er, og
              de skjules under `md`, der de ville dekket halve kloden. Lista
              under kartet tar over der.
            */}
            {built &&
              REGION_SKINS.map((skin) => {
                const at = pct(skin.id);
                if (!at) return null;
                const on = selected === skin.id;
                return (
                  <motion.button
                    key={skin.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => choose(skin.id)}
                    onMouseEnter={() => setHover(skin.id)}
                    onMouseLeave={() => setHover((h) => (h === skin.id ? null : h))}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: focus === skin.id ? 1.06 : 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                    className={`absolute z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3 text-sm font-bold shadow-[0_6px_18px_rgba(0,0,0,0.35)] md:inline-flex ${
                      on ? "bg-[var(--color-primary)] text-[var(--on-accent)]" : "bg-white text-[#0b1424]"
                    }`}
                    style={{ left: `${at.x}%`, top: `${at.y}%` }}
                  >
                    <span
                      className="numeric rounded-full px-1.5 py-0.5 text-[0.6875rem] text-white"
                      style={{ background: skin.color }}
                    >
                      {getRegion(skin.id)?.code}
                    </span>
                    {t(skin.labelKey)}
                  </motion.button>
                );
              })}

          </div>

            {/* kortet for valgt region */}
            <AnimatePresence>
              {selected && selectedRegion && selectedAt && (
                <motion.div
                  key={selected}
                  role="dialog"
                  aria-label={t(selectedRegion.labelKey)}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="relative z-20 mt-3 flex w-full flex-col gap-3.5 rounded-[26px] bg-white p-5 text-[#0b1424] shadow-[0_24px_60px_rgba(0,0,0,0.5)] md:absolute md:mt-0 md:w-[300px] md:[bottom:var(--pop-bottom)] md:[left:var(--pop-left)] md:[right:var(--pop-right)] md:[top:var(--pop-top)]"
                  style={
                    {
                      "--pop-left": selectedAt.x > 62 ? "auto" : `${Math.min(selectedAt.x + 4, 98)}%`,
                      "--pop-right": selectedAt.x > 62 ? `${Math.max(1, 100 - selectedAt.x + 4)}%` : "auto",
                      "--pop-top": selectedAt.y > 55 ? "auto" : `${selectedAt.y + 6}%`,
                      "--pop-bottom": selectedAt.y > 55 ? `${Math.max(1, 100 - selectedAt.y + 6)}%` : "auto",
                    } as CSSProperties
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="numeric text-[0.6875rem] font-bold text-[#4a5672]">
                        {selectedRegion.code}
                      </span>
                      <span className="text-[1.625rem] font-bold leading-none tracking-[-0.02em]">
                        {t(selectedRegion.labelKey)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      aria-label={t("region.close")}
                      className="-mr-2 -mt-2 grid h-11 w-11 place-items-center rounded-full text-[#4a5672] hover:bg-[#eef2f8]"
                    >
                      <Icon name="x" className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {selectedRegion.categories.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold"
                        style={{
                          background: `color-mix(in srgb, ${selectedSkin?.color ?? "#5a6d92"} 14%, white)`,
                          color: "#1d2740",
                        }}
                      >
                        {t(c.labelKey)}
                      </li>
                    ))}
                    {selectedChildren.map((child) => (
                      <li
                        key={child.id}
                        className="rounded-full bg-[#eef2f8] px-2.5 py-1 text-[0.8125rem] font-semibold text-[#1d2740]"
                      >
                        {t(child.labelKey)} →
                      </li>
                    ))}
                  </ul>
                  <div className="numeric flex justify-between text-xs text-[#4a5672]">
                    <span>{t("region.best").toUpperCase()}</span>
                    <span className="font-bold text-[#0b1424]">
                      {selectedBest > 0 ? selectedBest : t("region.none")}
                    </span>
                  </div>
                  <button
                    ref={playRef}
                    type="button"
                    onClick={() => go(selected)}
                    className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0b1424] px-5 font-bold text-[#c8ff3c] transition-transform active:scale-[0.98]"
                  >
                    {t("region.play", { name: t(selectedRegion.labelKey) })}
                    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </motion.section>

      {/* lista: tilgjengelig inngang, og den eneste på en telefon */}
      <nav aria-label={t("region.list")} className="mt-4 flex flex-wrap items-center gap-2">
        <span className="hud-label mr-1">{t("region.list")}</span>
        {[
          { id: "world", labelKey: "region.world", color: REGION_COLOR.world },
          ...REGION_SKINS,
        ].map((skin) => {
          const best = bestForRegion(skin.id);
          return (
            <button
              key={skin.id}
              type="button"
              onClick={() => go(skin.id)}
              onMouseEnter={() => setHover(skin.id)}
              onMouseLeave={() => setHover((h) => (h === skin.id ? null : h))}
              className="tag min-h-11 gap-2 py-1.5 pl-2.5 pr-4 text-[0.9375rem] font-semibold transition-colors hover:border-[var(--border-hover)]"
            >
              <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: skin.color }} />
              {t(skin.labelKey)}
              {best > 0 && <span className="numeric text-[var(--gold)]">{best}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
