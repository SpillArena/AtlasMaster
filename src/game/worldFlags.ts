/**
 * Verdensflaggene — bildesettet for verdensregionen.
 *
 * De andre flaggene i spillet tegnes fra en geometrisk beskrivelse
 * (game/flags.ts): de fleste europeiske flagg *er* to-tre bånd. Hele verden
 * er ikke det — våpenskjold, segl og silhuetter kan ikke beskrives i noen få
 * tall — så verdensregionen bruker et ekte flaggsett kopiert inn under
 * src/data/world/flags/ av scripts/build-world.mjs. Det er de eneste
 * bilde-flaggene i prosjektet, og de hentes fra egne filer, ikke fra en
 * fremmed tjener mens noen spiller.
 *
 * Denne modulen er skilt fra game/flags.ts fordi `import.meta.glob` er
 * Vite-spesifikk og ikke finnes når scripts/check-geo.mjs laster flags.ts
 * under node.
 *
 * `eager` bygger bare URL-strengene ved lasting — billig. Selve SVG-ene er
 * separate filer nettleseren først henter når et `<img>` faktisk tegnes, og
 * verdens-datasettet er uansett code-split.
 */

import worldFlagCodes from '../data/world/flags.json'

const worldFlagUrls = import.meta.glob('../data/world/flags/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** URL-en til et lands flaggbilde i verdenssettet, eller null. */
export function flagImageFor(featureId: string): string | null {
  const code = (worldFlagCodes as Record<string, string>)[featureId]
  if (!code) return null
  return worldFlagUrls[`../data/world/flags/${code}.svg`] ?? null
}
