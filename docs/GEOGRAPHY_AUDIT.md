# Geography and game-logic audit — 4 November 2026

This pass changes datasets, their generators, game rules and checks. It does
not edit the design work being done in parallel.

## Coverage rule

The country baseline is the [193 UN member states](https://www.un.org/en/about-us/member-states)
and the [two UN observer states](https://research.un.org/en/unmembers/observers).
The existing Kosovo and Taiwan exercises are retained as explicit additions:
197 playable world entries. Dependencies and other areas remain scenery.

The checked-in reference joins the [UN M49 identities and regions](https://unstats.un.org/unsd/methodology/m49/)
with the [Spanish national mapping agency's country/capital roster](https://www.ign.es/web/en/datos-geograficos/paises-capitales).
Regional grouping retains the game's existing exceptions: Cyprus is in Europe;
Russia is in both Europe and Asia. Turkey, Kazakhstan and the South Caucasus
countries remain in Asia. These are documented groupings, not a claim that
there is one universally accepted continental boundary.

The user selected a curated major-city scope. Cities, rivers, mountains and
Antarctic stations are selections; they are not inventories of every settlement,
watercourse, mountain or station.

## Findings and fixes

| Region | Country/state coverage after fixes | Capital/seat targets before → after |
| --- | --- | --- |
| Europe | 46 countries | 39 → 46 |
| Asia | 48 → 49 countries | 44 → 50 |
| Africa | All 54 UN members | 54 → 57 |
| South America | All 12 countries | 12 → 13 |
| North America | All 23 sovereign UN members | 23 → 23 |
| Oceania | All 14 sovereign UN members | 14 → 14 |
| World | 195 → 197 playable entries | Covered through the regional exercises |
| Norway | All 15 current counties | 25 → 28 selected cities |
| USA | All 50 states | 26 → 34 selected cities |

All 193 UN members were already present in the world list. The omissions were
Palestine, a UN observer state, and the inconsistency that Taiwan was playable
in Asia but scenery in the world exercise. Both now appear in world country
and flag rounds; Palestine also appears in Asia. Their flag files and mappings
are included. The Norwegian Maldives label is corrected to “Maldivene”.

### Missing and outdated capitals

- Europe lacked Andorra la Vella, Vaduz, Monaco, Moscow, San Marino, Vatican
  City and Pristina. All seven are added.
- Asia lacked Manama, Malé, Singapore and Moscow, plus Palestinian capital/
  government-seat coverage. East Jerusalem is recorded as the **claimed**
  capital, and Ramallah as the government seat. The [Palestinian position](https://www.mofa.pna.ps/en-us/mn/our-position)
  and the [unsettled status of Jerusalem](https://questions-statements.parliament.uk/written-questions/detail/2026-01-02/101966)
  are documented; the data does not treat the sovereignty question as settled.
- Burundi used Bujumbura. It now uses [Gitega](https://www.diplomatie.gouv.fr/fr/information-par-pays/burundi/presentation-du-burundi).
- Equatorial Guinea used Malabo. It now uses Ciudad de la Paz, following the
  [government's 2 January 2026 proclamation](https://www.guineaecuatorialpress.com/noticias/el_presidente_de_la_republica_proclama_la_ciudad_de_la_paz_como_capital_de_la_republica_de_guinea_ecuatorial_con_la_firma_de_un_decreto_ley).
  The government transfer is transitional; the former capital is not an alias
  for the new city's location.
- Sri Lanka used Colombo alone. It now uses [Sri Jayawardenepura Kotte](https://www.kotte.mc.gov.lk/index.php?Itemid=175&id=25&lang=en&option=com_content&view=article).
  The [UK geographical factfile](https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/1187220/Sri_Lanka_Toponymic__Factfile.pdf)
  also identifies Kotte as the official capital. Colombo is not accepted as a
  spelling variant for that point.
- Bolivia lacked its [constitutional capital, Sucre](https://web.oep.org.bo/wp-content/uploads/2016/12/sucre.pdf).
  Sucre is added; La Paz is retained with its government-seat role.
- South Africa lacked Cape Town and Bloemfontein; all [three capital roles](https://www.gov.za/about-sa/south-africas-provinces)
  are now represented. Eswatini also gains [Lobamba](https://www.sadc.int/member-states/kingdom-eswatini),
  alongside Mbabane.
- Nauru's Yaren entry is explicitly a government seat, not an official capital.
  Bern is a federal city. Jakarta is retained during the Indonesian transition;
  [Jakarta's official site](https://www.jakarta.go.id/tentang-jakarta) still
  identifies it as the capital. A future relocation decree needs a new review.

The capital reference includes `countryId`, `capitalRole`, spelling aliases and
notes for these exceptions. Capital labels remain geographic place names.
Alternative government seats are explicitly distinguished from national capitals
in the data; the reference does not enumerate every commercial or administrative
centre worldwide. National capitals have full country coverage.

### Missing mainland and physical features

The world builder discarded polygon rings whose raw longitude range exceeded
180 degrees. That deleted **Russia's entire mainland**, leaving islands and
small fragments despite retaining a “Russia” answer. The same rule removed
Fiji's Taveuni island. Both geometries are restored from the original
[world-atlas 50m source](https://github.com/topojson/world-atlas); d3's spherical
clipping handles the date line. World scenery, ocean land masks, and the Oceania
country/outline copies now include the restored land.

Location checks cover Moscow, Siberia, the Russian Far East on both sides of
the date line, and Taveuni. A country ID and a nonempty polygon no longer suffice
to prove coverage.

Europe's selection also omitted **Volga**, **Dnipro/Dnieper**, **Dniester**, and
**Elbrus**. These are added using [Natural Earth river geometry](https://www.naturalearthdata.com/downloads/50m-physical-vectors/)
and a summit point for [Elbrus](https://science.nasa.gov/earth/earth-observatory/mt-elbrus-caucasus-range-2941/).
Volga is [Europe's longest river](https://education.nationalgeographic.org/resource/understanding-rivers/)
and Elbrus its highest peak. River paths follow the regional map crop, as do
other transboundary features.

### Selected cities

Norway gains **Jessheim, Kongsberg and Horten**, retaining its existing 25 cities.
[SSB distinguishes statistical urban settlements from informal city labels](https://www.ssb.no/befolkning/folketall/artikler/de-storste-byene-og-tettstedene-i-norge);
the game is a curated place quiz, not an exact population ranking.

The USA gains **Austin, Charlotte, Columbus (Ohio), Fort Worth, Indianapolis,
Jacksonville, Oklahoma City and San Jose**. Its selection now includes all of
the [2024 Census top 20 incorporated cities](https://www.census.gov/newsroom/press-releases/2025/vintage-2024-popest.html),
while retaining its existing regional/metropolitan landmarks. This is not a list
of every US state capital. City coordinates are approximate map targets, based
on Natural Earth and reviewed city-centre points, rather than legal municipal
boundaries.

## Logic corrections

- A solved place remains an invalid map click. In choice/flag modes it can still
  be a distractor: choosing it now counts as a wrong answer instead of doing
  nothing.
- Typo tolerance no longer accepts the exact name of a different target, such
  as **Mali for Malta** or **Togo for Tonga**.
- Accents, Unicode composition and Norwegian ø/æ transliteration are normalized
  for typed answers. Explicit aliases cover conventional variants such as
  Washington DC, Malé/Male and Kotte.
- Unknown target IDs are ignored; an empty dataset starts finished.

## Repeatable checks and remaining limits

Run:

```sh
npm run data:geography  # deterministic capital/city/physical-feature rebuild
npm run check:facts    # identities, coverage, roles, points, aliases and date line
npm run check:engine
npm run check:geo
npm run check:regions
npm run lint
npm run build
```

The regional generators now use the same reviewed capital and city sources,
so rerunning a generator does not silently restore the old capital omissions.
The world generator uses the explicit country roster and preserves date-line
rings. `check:facts` compares the outputs against the roster and verifies every
country has a capital/seat target. It also checks all 15 Norwegian county codes,
all 50 US state codes, actual flag files, city locations and accepted aliases.
Coastal points may be outside generalized coast polygons; the geographic check
allows correct-country land within 20 km, while exact reference coordinates
separately guard against unintended moves.

Engine, fact, geometry and all 41 registered-category checks pass. Build and
lint pass against the concurrent design work at validation time. The existing
`check:sql` command cannot start because it imports the removed
`functions/api/auth/index.js` (and also references the removed profile endpoint).
That pre-existing migration of authentication to SpillArena is separate from
this audit; the current leaderboard validator is exercised by `check:regions`.

Category IDs are unchanged and historical scores are retained. New rounds in
expanded datasets contain more targets, so their possible totals differ from
historical rounds. There is no standalone world-capitals or US-state-capitals
exercise; the former is covered by regional national-capital exercises, and the
latter remains outside the selected major-city scope.

Europe and USA still provide geometric badge hints for only 30/46 countries
and 7/50 states. Those hints are optional and neither region offers a dedicated
flag-only category. Actual flag-mode categories have full image coverage. The
remaining territories, city selections, rivers, mountains and research stations
are deliberately not claimed to be exhaustive.
