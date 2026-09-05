/**
 * Genererer src/data/norway/counties.json frå Kartverket sine fylkesgrenser.
 *
 *   npm run data:norway
 *
 * Kjøres sjeldan — resultatet er sjekka inn. Kjør på nytt berre når
 * fylkesinndelinga endrar seg.
 *
 * Noreg var den einaste regionen utan sin eigen byggjar. Europa, Asia og USA
 * hentar alle geometrien sin frå ei sporbar kjelde; Noreg sine fylke låg som
 * eit ferdig resultat i repoet, med ingen skript som viste kvar dei kom frå.
 * Dei er likevel ikkje ei ukjend geometri: id-ane, namna og til og med
 * koordinatane er nøyaktig denne same kjelda — første punktet i Buskerud står
 * på 7.488/60.099 her og 7.488255…/60.098924… i kjelda — berre avrunda til 3
 * desimalar og forenkla i ein tidlegare, ikkje-reproduserbar runde. Fila var
 * altså rett, men låst til 6 500 punkt av dei 16 500 kjelda faktisk har, og
 * det var akkurat den finaste detaljen — fjordane — som forsvann i det tapet.
 * Denne byggjaren hentar same kjelda på nytt i full oppløysing, slik at
 * Sognefjorden, Hardangerfjorden og øyrekkja i Lofoten kjem attende.
 *
 * KJELDE OG LISENS. Fylker-S.geojson frå robhop/fylker-og-kommuner — Kartverket
 * sine fylkesgrenser, oppdatert 2024, generalisert til S-nivå og klipt etter
 * kystlinja. Kartverket sine data er lisensierte under CC BY 4.0: fri bruk,
 * mot kreditering. Det er ikkje ein kurtesi her, det er eit lisensvilkår:
 *
 *   Fylkesgrenser: Kartverket, lisens CC BY 4.0.
 *   Henta via https://github.com/robhop/fylker-og-kommuner
 *
 * S-NIVÅET, IKKJE M ELLER L. Repoet har tre nivå å velje mellom — 16 500,
 * 48 500 og 163 000 punkt. M og L er sju og tjuvefem gonger tettare enn S,
 * altså presisjon eit kart på 900 pikslar høgd aldri får vist, og L åleine
 * ville vege meir enn heile verdskartet for eitt einaste land. S er den
 * finaste oppløysinga som faktisk kjem fram på skjermen — nøyaktig nok til at
 * ein fjord er ein fjord, og ikkje ei rett linje mellom to nes.
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
  // kjelda dupliserer namn og id som fylkesnummer/fylkesnavn — spelet bruker
  // berre dei to felta det faktisk treng
  const { id, name } = f.properties
  const geometry = dropRepeats(roundGeometry(f.geometry))
  if (!geometry) {
    console.warn(`  ! ${name} vart tom etter avrunding`)
    continue
  }
  features.push({ type: 'Feature', properties: { id, name }, geometry })
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))

console.log('Noreg:')
/*
 * d3-geo les eit polygon sfærisk: kva side av ringen som er «inne» følgjer av
 * kva veg han går. Ein ytterring som går feil veg blir teikna som resten av
 * kloden, og kartet blir eit einsfarga rektangel. Kjelda her er rein GeoJSON,
 * ikkje bygd om frå ein topologi som d3-geo-verktøya våre elles garanterer
 * vindinga til, så samlinga blir normalisert til med klokka rundt ytterringen
 * — den konvensjonen d3 reknar med — same steget som Europa- og Asia-kartet
 * gjer, av same grunn.
 */
const collection = rewind({ type: 'FeatureCollection', features }, true)
writeCollection(OUT, collection.features)

const points = collection.features.reduce((n, f) => n + countPoints(f.geometry.coordinates), 0)
console.log(`  ${sourcePoints} → ${points} punkt (avrunda til 3 desimalar, dupliserte punkt fjerna)`)
if (features.length !== 15) console.warn(`  ! venta 15 fylke, fekk ${features.length}`)
