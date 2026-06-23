import { writeFileSync } from 'fs'

// Norges største byer (tettsteder), [lon, lat]
const cities = [
  ['Oslo', 10.7522, 59.9139],
  ['Bergen', 5.3221, 60.3913],
  ['Trondheim', 10.3951, 63.4305],
  ['Stavanger', 5.7331, 58.97],
  ['Drammen', 10.2045, 59.744],
  ['Fredrikstad', 10.9298, 59.2181],
  ['Kristiansand', 7.9956, 58.1467],
  ['Sandnes', 5.7361, 58.8524],
  ['Tromsø', 18.9553, 69.6492],
  ['Sarpsborg', 11.1098, 59.2839],
  ['Skien', 9.609, 59.2096],
  ['Ålesund', 6.1495, 62.4722],
  ['Sandefjord', 10.2167, 59.1313],
  ['Haugesund', 5.268, 59.4138],
  ['Tønsberg', 10.4078, 59.2674],
  ['Moss', 10.6596, 59.434],
  ['Porsgrunn', 9.656, 59.1405],
  ['Bodø', 14.4049, 67.2804],
  ['Arendal', 8.7726, 58.4612],
  ['Hamar', 11.0676, 60.7945],
  ['Larvik', 10.0277, 59.0537],
  ['Halden', 11.3875, 59.133],
  ['Lillehammer', 10.4662, 61.1153],
  ['Molde', 7.1574, 62.7375],
  ['Gjøvik', 10.6916, 60.7957],
]

const fc = {
  type: 'FeatureCollection',
  features: cities.map(([name, lon, lat]) => ({
    type: 'Feature',
    properties: { id: name, name },
    geometry: { type: 'Point', coordinates: [lon, lat] },
  })),
}

writeFileSync(new URL('../src/data/storbyer.json', import.meta.url), JSON.stringify(fc))
console.log('wrote storbyer.json:', fc.features.length, 'cities')
