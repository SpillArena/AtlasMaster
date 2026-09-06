import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import type { FeatureCollection, Feature } from "geojson";
import { makePath, makeProjection, naturalAspect } from "../../game/projection";
import { getRegion } from "../../game/regions";
import { bestForRegion } from "../../game/progress";
import { playSfx } from "../../game/sfx";
import type { ProjectionSpec } from "../../game/types";
import PirateCompass from "./PirateCompass";
import { PaperRifts } from "../PaperRifts";

interface Props {
  onPick: (regionId: string) => void;
}

const W = 960;

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
 * Norge og USA sjekkes først, så Asia, så Europa — se kommentaren over
 * id-listene. Fargene er dempede kartograftoner, ikke rene primærfarger, så
 * kloden fortsatt leser som et blad fra feltboka.
 */
const REGION_SKINS: RegionSkin[] = [
  // Norge-etiketten står i Norskehavet, vest for landet: fastlandet er smalt,
  // og et navn oppå det dekker halve regionen man skal kunne se og trykke på.
  {
    id: "norway",
    labelKey: "region.norway",
    color: "#5f8a7d",
    match: (c) => c === 578,
    anchor: [2, 66],
  },
  {
    id: "usa",
    labelKey: "region.usa",
    color: "#b06f4e",
    match: (c) => c === 840,
    anchor: [-99, 40],
  },
  {
    id: "asia",
    labelKey: "region.asia",
    color: "#c39a3f",
    match: (c) => ASIA_IDS.has(c),
    anchor: [92, 44],
  },
  // sør for Østersjøen, klar av både Norge-etiketten og det russiske feltet
  {
    id: "europe",
    labelKey: "region.europe",
    color: "#8a6f9c",
    match: (c) => EUROPE_IDS.has(c),
    anchor: [16, 47],
  },
];

function classify(code: number): string {
  for (const skin of REGION_SKINS) if (skin.match(code)) return skin.id;
  return "world";
}

function codeOf(f: Feature): number {
  const raw = (f.properties as { id?: string | number } | null)?.id ?? f.id;
  return Number(raw);
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
}

/**
 * Landingssiden: hele kloden som ett kart. De regionene spillet støtter er
 * fargelagt og klikkbare — trykk på Frankrike og du er i Europa-menyen, på
 * Japan og du er i Asia. Alt annet land, og havet, sender deg til «Verden».
 */
export function WorldMapPicker({ onPick }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getRegion("world")
      ?.outline()
      .then((fc) => {
        if (alive) setData(fc);
      });
    return () => {
      alive = false;
    };
  }, []);

  const built = useMemo<Built | null>(() => {
    if (!data) return null;
    const aspect = naturalAspect(WORLD_PROJECTION, data);
    const height = Math.round(W / aspect);
    const projection = makeProjection(WORLD_PROJECTION, data, W, height, 4);
    const path = makePath(projection);

    const shapes: Shape[] = [];
    for (const f of data.features) {
      const d = path(f.geometry);
      if (!d) continue;
      shapes.push({ d, region: classify(codeOf(f)) });
    }

    const labels: Record<string, [number, number]> = {};
    for (const skin of REGION_SKINS) {
      const xy = projection(skin.anchor);
      if (xy) labels[skin.id] = [xy[0], xy[1]];
    }

    return { shapes, labels, height };
  }, [data]);

  /*
   * Peilingen kompasset skal vise: fra midten av kartet til regionen musa er
   * over. Nålen har alltid hatt en overgang som kunne ta den dit — den
   * fyrte bare aldri, fordi ingen sendte inn en peiling.
   */
  const heading = useMemo(() => {
    if (!built || !hover) return null;
    const target = built.labels[hover];
    if (!target) return null;
    const dx = target[0] - W / 2;
    const dy = target[1] - built.height / 2;
    // atan2(øst, nord): null grader er opp, og vinkelen øker med klokka
    return (Math.round((Math.atan2(dx, -dy) * 180) / Math.PI) + 360) % 360;
  }, [built, hover]);

  const pick = (regionId: string) => {
    playSfx("ui");
    onPick(regionId);
  };

  const byRegion = useMemo(() => {
    const groups: Record<string, string[]> = { world: [] };
    for (const skin of REGION_SKINS) groups[skin.id] = [];
    for (const s of built?.shapes ?? []) groups[s.region].push(s.d);
    return groups;
  }, [built]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      {/*
        Kompasset ligger utenfor selve platen, ikke inni den. Platen bærer den
        revne kanten, og en maske klipper alt den inneholder — instrumentet
        ville fått et jafs tatt ut av seg i det ene hjørnet. Messinget er ikke
        det som er gammelt her; papiret er.
      */}
      <div className="relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="plate torn relative w-full overflow-hidden"
          style={{
            aspectRatio: built ? `${W} / ${built.height}` : "960 / 480",
          }}
        >
          <div className="grain foxed pointer-events-none absolute inset-0 opacity-[0.5]" />
          {built && (
            <svg
              viewBox={`0 0 ${W} ${built.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 h-full w-full"
              role="group"
              aria-label={t("region.title")}
            >
              <defs>
                <pattern
                  id="wmp-graticule"
                  width={W / 12}
                  height={W / 12}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M${W / 12} 0V${W / 12}M0 ${W / 12}H${W / 12}`}
                    fill="none"
                    stroke="var(--graticule)"
                    strokeWidth={0.6}
                  />
                </pattern>
              </defs>

              {/* havet — klikk hvor som helst utenfor en region = Verden */}
              <rect
                x={0}
                y={0}
                width={W}
                height={built.height}
                fill="var(--color-water)"
                fillOpacity={0.22}
                style={{ cursor: "pointer" }}
                onClick={() => pick("world")}
              />
              <rect
                x={0}
                y={0}
                width={W}
                height={built.height}
                fill="url(#wmp-graticule)"
                opacity={0.5}
                pointerEvents="none"
              />

              {/* alt land som ikke tilhører en egen region — også Verden */}
              <g
                style={{ cursor: "pointer" }}
                onClick={() => pick("world")}
                onMouseEnter={() => setHover("world")}
                onMouseLeave={() => setHover((h) => (h === "world" ? null : h))}
              >
                {byRegion.world.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="var(--coast)"
                    fillOpacity={hover === "world" ? 0.3 : 0.14}
                    stroke="var(--coast)"
                    strokeOpacity={0.35}
                    strokeWidth={0.4}
                  />
                ))}
              </g>

              {/* de fargelagte regionene, minste øverst så små land tar imot klikk */}
              {REGION_SKINS.map((skin) => {
                const active = hover === skin.id;
                return (
                  <g
                    key={skin.id}
                    role="button"
                    tabIndex={0}
                    aria-label={t(skin.labelKey)}
                    style={{ cursor: "pointer", outline: "none" }}
                    onClick={() => pick(skin.id)}
                    onMouseEnter={() => setHover(skin.id)}
                    onMouseLeave={() =>
                      setHover((h) => (h === skin.id ? null : h))
                    }
                    onFocus={() => setHover(skin.id)}
                    onBlur={() => setHover((h) => (h === skin.id ? null : h))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        pick(skin.id);
                      }
                    }}
                  >
                    {byRegion[skin.id].map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill={skin.color}
                        fillOpacity={active ? 0.92 : 0.68}
                        stroke="var(--coast)"
                        strokeOpacity={active ? 0.95 : 0.55}
                        strokeWidth={active ? 1 : 0.5}
                      />
                    ))}
                  </g>
                );
              })}

              {/* regionetiketter, ikke klikkbare */}
              {REGION_SKINS.map((skin) => {
                const p = built.labels[skin.id];
                if (!p) return null;
                return (
                  <text
                    key={skin.id}
                    x={p[0]}
                    y={p[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-display"
                    style={{
                      pointerEvents: "none",
                      fontSize: hover === skin.id ? 22 : 18,
                      fontWeight: 700,
                      fill: "var(--ink)",
                      paintOrder: "stroke",
                      stroke: "var(--bg)",
                      strokeWidth: 4,
                      strokeLinejoin: "round",
                    }}
                  >
                    {t(skin.labelKey)}
                  </text>
                );
              })}
            </svg>
          )}
          {/*
          Riftene ligger over kartet, men under kompasset og etikettene: arket
          er gammelt, navnene skal fortsatt kunne leses.
        */}
          <PaperRifts className="z-[5] opacity-40 dark:opacity-50" />
        </motion.div>

        <PirateCompass
          size={128}
          heading={heading}
          label={t("region.title")}
          className="pointer-events-none absolute bottom-4 left-4 z-10 hidden drop-shadow-lg sm:inline-grid"
        />
      </div>

      {/* tekst-snarveier: tilgjengelig fallback og tydelig på mobil */}
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {[
          ...REGION_SKINS,
          { id: "world", labelKey: "region.world", color: "var(--coast)" },
        ].map((skin) => {
          const best = bestForRegion(skin.id);
          return (
            <li key={skin.id}>
              <button
                onClick={() => pick(skin.id)}
                onMouseEnter={() => setHover(skin.id)}
                onMouseLeave={() => setHover((h) => (h === skin.id ? null : h))}
                className="tag flex items-center gap-2 px-3 py-1.5 text-sm font-semibold"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: skin.color }}
                />
                {t(skin.labelKey)}
                {best > 0 && (
                  <span className="numeric" style={{ color: "var(--gold)" }}>
                    {best}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
