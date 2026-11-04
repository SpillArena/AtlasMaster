/** Reviewed rosters are independent of Natural Earth's capital flags, which
 * omit small states and retain several former capitals. No network at build. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, writeCollection } from './sources.mjs'

export const geographyReference = JSON.parse(readFileSync(resolve(ROOT, 'scripts/data/geography-reference.json'), 'utf8'))
export const majorCityReference = JSON.parse(readFileSync(resolve(ROOT, 'scripts/data/major-cities.json'), 'utf8'))

export function capitalFeatures(region) {
  const rows = geographyReference.capitals[region]
  if (!rows) throw new Error(`No reviewed capital roster for ${region}`)
  return rows.map(({ coordinates, ...properties }) => ({
    type: 'Feature', properties, geometry: { type: 'Point', coordinates },
  })).sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'nb'))
}

export function writeCapitals(region) {
  writeCollection(resolve(ROOT, `src/data/${region}/capitals.json`), capitalFeatures(region))
}

export function writeMajorCities(region) {
  const features = majorCityReference.cities[region]
  if (!features) throw new Error(`No reviewed major-city roster for ${region}`)
  writeCollection(resolve(ROOT, `src/data/${region}/cities.json`), features)
}

export const geographyAdditions = JSON.parse(readFileSync(resolve(ROOT, 'scripts/data/geography-additions.json'), 'utf8'))

/** Reviewed additions merge by stable id and can be safely applied again. */
export function writeGeographyAdditions() {
  for (const [dataset, additions] of Object.entries(geographyAdditions.datasets)) {
    const file = resolve(ROOT, `src/data/${dataset}.json`)
    const original = JSON.parse(readFileSync(file, 'utf8'))
    const byId = new Map(original.features.map((f) => [f.properties.id, f]))
    for (const feature of additions) byId.set(feature.properties.id, feature)
    writeCollection(file, [...byId.values()])
  }
}

/** Keep official reference names accepted alongside localized short names. */
export function writeCountryAliases(region) {
  const countries = new Map(geographyReference.countries.map((c) => [c.id, c]))
  for (const dataset of ['countries', 'outline']) {
    const file = resolve(ROOT, `src/data/${region}/${dataset}.json`)
    if (!existsSync(file)) continue
    const collection = JSON.parse(readFileSync(file, 'utf8'))
    for (const feature of collection.features) {
      const p = feature.properties
      const key = /^\d+$/.test(String(p.id)) ? String(p.id).padStart(3, '0') : p.id
      const canonical = countries.get(key)?.name
      if (canonical && canonical !== p.name && canonical !== p.nameEn) {
        p.aliases = [...new Set([...(p.aliases ?? []), canonical])]
      }
    }
    writeFileSync(file, JSON.stringify(collection))
  }
}
