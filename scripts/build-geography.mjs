/** Regenerate reviewed capital and major-city points without fetching data. */
import { geographyReference, majorCityReference, writeCapitals, writeMajorCities, writeGeographyAdditions, writeCountryAliases } from './lib/geography-reference.mjs'
for (const region of Object.keys(geographyReference.capitals)) writeCapitals(region)
for (const region of Object.keys(majorCityReference.cities)) writeMajorCities(region)

writeGeographyAdditions()

for (const region of ['world', ...Object.keys(geographyReference.capitals)]) writeCountryAliases(region)
