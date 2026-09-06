/**
 * Genererer src/data/norway/counties.json fra Kartverkets fylkesgrenser.
 *
 *   npm run data:norway
 *
 * Kjøres sjelden — resultatet er sjekket inn. Kjør på nytt bare når
 * fylkesinndelingen endrer seg.
 *
 * Norge var den eneste regionen uten sin egen bygger. Europa, Asia og USA
 * henter all geometrien sin fra en sporbar kilde; Norges fylker lå som
 * et ferdig resultat i repoet, uten noe skript som viste hvor de kom fra.
 * De er likevel ikke en ukjent geometri: id-ene, navnene og til og med
 * koordinatene er nøyaktig denne samme kilden — første punktet i Buskerud står
 * på 7.488/60.099 her og 7.488255…/60.098924… i kilden — bare avrundet til 3
 * desimaler og forenklet i en tidligere, ikke-reproduserbar runde. Fila var
 * altså riktig, men låst til 6 500 punkt av de 16 500 kilden faktisk har, og
 * det var akkurat den fineste detaljen — fjordene — som forsvant i det tapet.
 * Denne byggeren henter samme kilde på nytt i full oppløsning, slik at
 * Sognefjorden, Hardangerfjorden og øyrekka i Lofoten kommer tilbake.
 *
 * KILDE OG LISENS. Fylker-S.geojson fra robhop/fylker-og-kommuner — Kartverkets
 * fylkesgrenser, oppdatert 2024, generalisert til S-nivå og klippet etter
 * kystlinja. Kartverkets data er lisensiert under CC BY 4.0: fri bruk,
 * mot kreditering. Det er ikke en kurtesi her, det er et lisensvilkår:
 *
 *   Fylkesgrenser: Kartverket, lisens CC BY 4.0.
 *   Hentet via https://github.com/robhop/fylker-og-kommuner
 *
 * S-NIVÅET, IKKE M ELLER L. Repoet har tre nivå å velge mellom — 16 500,
 * 48 500 og 163 000 punkt. M og L er sju og tjuefem ganger tettere enn S,
 * altså presisjon et kart på 900 piksler høyde aldri får vist, og L alene
 * ville veie mer enn hele verdenskartet for ett eneste land. S er den
 * fineste oppløsningen som faktisk kommer fram på skjermen — nøyaktig nok til at
 * en fjord er en fjord, og ikke en rett linje mellom to nes.
 */

import { resolve } from 'node:path'
import rewind from '@mapbox/geojson-rewind'
import { ROOT, dropRepeats, fetchCached, roundGeometry, writeCollection } from './lib/sources.mjs'

const OUT = resolve(ROOT, 'src/data/norway/counties.json')
const SOURCE_URL =
  'https://raw.githubusercontent.com/robhop/fylker-og-kommuner/main/Fylker-S.geojson'

const source = await fetchCached(SOURCE_URL, 'fylker-S.geojson')

const countPoints = (c) =>
  typeof c[0] === 'number' ? 1 : c.reduce((n, x) => n + countPoints(x), 0)
const sourcePoints = source.features.reduce((n, f) => n + countPoints(f.geometry.coordinates), 0)

const features = []
for (const f of source.features) {
  // kilden dupliserer navn og id som fylkesnummer/fylkesnavn — spillet bruker
  // bare de to feltene det faktisk trenger
  const { id, name } = f.properties
  const geometry = dropRepeats(roundGeometry(f.geometry))
  if (!geometry) {
    console.warn(`  ! ${name} ble tom etter avrunding`)
    continue
  }
  features.push({ type: 'Feature', properties: { id, name }, geometry })
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))

console.log('Norge:')
/*
 * d3-geo leser et polygon sfærisk: hvilken side av ringen som er «inne» følger av
 * hvilken vei den går. En ytterring som går feil vei blir tegnet som resten av
 * kloden, og kartet blir et ensfarget rektangel. Kilden her er ren GeoJSON,
 * ikke bygd om fra en topologi som d3-geo-verktøyene våre ellers garanterer
 * vindingen til, så samlingen blir normalisert til med klokka rundt ytterringen
 * — den konvensjonen d3 regner med — samme steget som Europa- og Asia-kartet
 * gjør, av samme grunn.
 */
const collection = rewind({ type: 'FeatureCollection', features }, true)
writeCollection(OUT, collection.features)

const points = collection.features.reduce((n, f) => n + countPoints(f.geometry.coordinates), 0)
console.log(`  ${sourcePoints} → ${points} punkt (avrundet til 3 desimaler, dupliserte punkt fjernet)`)
if (features.length !== 15) console.warn(`  ! ventet 15 fylker, fikk ${features.length}`)
