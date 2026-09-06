/**
 * Flagg, tegnet av spillet selv.
 *
 * HVORFOR IKKE EMOJI. Unicode har et flagg for hver ISO 3166-1-kode, og det
 * er den letteste løsningen som finnes — to tegn per land. Windows har bare
 * aldri levert flaggene: Segoe UI Emoji tegner dem ikke, så et norsk flagg
 * blir «NO» i to bokstaver på den vanligste skrivebordsplattformen i landet.
 * Et hint som forsvinner for halvparten av spillerne er ikke et hint.
 *
 * HVORFOR IKKE BILDER. Et ferdig flaggsett er tusenvis av filer eller en
 * pakke på flere hundre kilobyte, og alternativet — å peke på noen andres
 * tjener — sender spillernes kart- og landvalg til en tredjepart og
 * faller sammen den dagen den tjeneren gjør det.
 *
 * HVORFOR EN BESKRIVELSE. De fleste europeiske flagg *er* geometri: to eller
 * tre bånd, et nordisk kors, et hvitt kors på rødt. Beskrivelsen under er
 * noen få hundre byte for hele Europa, og tegneren i FlagBadge gjør den
 * om til SVG uten en eneste nettverkshenting.
 *
 * HVA SOM MANGLER. Flagg med våpenskjold, segl eller silhuetter er ikke her:
 * Albania, Bosnia-Hercegovina, Hviterussland, Kypros, Moldova, Montenegro,
 * Nord-Makedonia, Serbia, Slovakia og Slovenia. Å tegne dem som rene bånd
 * ville vært verre enn ingenting — Slovenia, Slovakia og Russland ville fått
 * *samme* flagg. De står derfor uten, og flagget er med vilje et tillegg til
 * navnet og aldri det eneste holdepunktet: `flagFor` gir null, og
 * `FlagBadge` tegner ingenting.
 *
 * HVA MED FYLKESVÅPEN OG DELSTATSFLAGG. Delstatsflaggene er fri gjengivelse, men
 * bare et fåtall av dem er geometri: de fleste bærer et segl med tekst,
 * figurer og årstall, og et segl kan ikke beskrives i noen få tall. De sju
 * som *kan* tegnes står her; resten står uten, på samme vilkår som de
 * europeiske.
 *
 * De norske fylkesvåpnene er ikke her, og det er et rettslig valg og ikke
 * et teknisk. Offentlige våpen i Norge er vernet: bruk krever løyve fra
 * fylkeskommunen som eier våpenet, og et spill er ikke unntatt. Å tegne dem
 * på nytt gjør dem ikke frie — det er motivet som er vernet, ikke fila. Vi
 * henter dem derfor verken fra en tredjepart eller fra egen hånd.
 *
 * Nøklene er den samme id-en som features i datasettet bærer: ISO 3166-1
 * numerisk for landene, FIPS for delstatene. De to overlapper — «40» er både
 * Østerrike og Oklahoma — så oppslaget går alltid gjennom et sett.
 */

/** Bånd på tvers eller på langs, med valgfri vekt per bånd. */
export interface BandsFlag {
  kind: 'bands'
  dir: 'h' | 'v'
  colors: string[]
  /** relativ bredde per bånd; utelatt = like brede */
  weights?: number[]
}

/** Nordisk kors — forskjøvet mot stanga, med valgfri indre stripe. */
export interface NordicFlag {
  kind: 'nordic'
  field: string
  cross: string
  inner?: string
}

/** Kors midt i duken (Sveits). */
export interface CrossFlag {
  kind: 'cross'
  field: string
  cross: string
}

/** Ni striper og et kors i øvre hjørne (Hellas). */
export interface GreeceFlag {
  kind: 'greece'
}

/** To vannrette felt og en kile fra stanga (Tsjekkia). */
export interface WedgeFlag {
  kind: 'wedge'
  top: string
  bottom: string
  wedge: string
}

/** Union Jack. */
export interface UnionFlag {
  kind: 'union'
}

/** Tre bånd og et sjakkbrett (Kroatia). */
export interface CroatiaFlag {
  kind: 'croatia'
}

/**
 * Delstatsflagg med hver sin egen form. Hvert av dem er et oppsett som ikke
 * går igjen noen annen plass, så de bærer bare navnet sitt.
 */
export interface StateFlag {
  kind: 'texas' | 'alabama' | 'alaska' | 'hawaii' | 'colorado' | 'arizona' | 'newMexico'
}

export type FlagSpec =
  | BandsFlag
  | NordicFlag
  | CrossFlag
  | GreeceFlag
  | WedgeFlag
  | UnionFlag
  | CroatiaFlag
  | StateFlag

const bands = (dir: 'h' | 'v', colors: string[], weights?: number[]): BandsFlag => ({
  kind: 'bands',
  dir,
  colors,
  weights,
})

const nordic = (field: string, cross: string, inner?: string): NordicFlag => ({
  kind: 'nordic',
  field,
  cross,
  inner,
})

const EUROPE_FLAGS: Record<string, FlagSpec> = {
  // --- vannrette bånd ---
  40: bands('h', ['#ed2939', '#ffffff', '#ed2939']), // Østerrike
  100: bands('h', ['#ffffff', '#00966e', '#d62612']), // Bulgaria
  208: nordic('#c8102e', '#ffffff'), // Danmark
  233: bands('h', ['#0072ce', '#000000', '#ffffff']), // Estland
  276: bands('h', ['#000000', '#dd0000', '#ffce00']), // Tyskland
  348: bands('h', ['#cd2a3e', '#ffffff', '#436f4d']), // Ungarn
  428: bands('h', ['#9e3039', '#ffffff', '#9e3039'], [2, 1, 2]), // Latvia
  440: bands('h', ['#fdb913', '#006a44', '#c1272d']), // Litauen
  442: bands('h', ['#ed2939', '#ffffff', '#00a1de']), // Luxembourg
  528: bands('h', ['#ae1c28', '#ffffff', '#21468b']), // Nederland
  616: bands('h', ['#ffffff', '#dc143c']), // Polen
  643: bands('h', ['#ffffff', '#0039a6', '#d52b1e']), // Russland
  724: bands('h', ['#aa151b', '#f1bf00', '#aa151b'], [1, 2, 1]), // Spania
  804: bands('h', ['#0057b7', '#ffd700']), // Ukraina

  // --- loddrette bånd ---
  56: bands('v', ['#000000', '#fae042', '#ed2939']), // Belgia
  250: bands('v', ['#002395', '#ffffff', '#ed2939']), // Frankrike
  372: bands('v', ['#169b62', '#ffffff', '#ff883e']), // Irland
  380: bands('v', ['#008c45', '#f4f5f0', '#cd212a']), // Italia
  470: bands('v', ['#ffffff', '#c01620']), // Malta
  620: bands('v', ['#046a38', '#da291c'], [2, 3]), // Portugal
  642: bands('v', ['#002b7f', '#fcd116', '#ce1126']), // Romania

  // --- nordiske kors ---
  246: nordic('#ffffff', '#002f6c'), // Finland
  352: nordic('#02529c', '#ffffff', '#dc1e35'), // Island
  578: nordic('#ba0c2f', '#ffffff', '#00205b'), // Norge
  752: nordic('#005293', '#fecb00'), // Sverige

  // --- egne former ---
  191: { kind: 'croatia' }, // Kroatia
  203: { kind: 'wedge', top: '#ffffff', bottom: '#d7141a', wedge: '#11457e' }, // Tsjekkia
  300: { kind: 'greece' }, // Hellas
  756: { kind: 'cross', field: '#d52b1e', cross: '#ffffff' }, // Sveits
  826: { kind: 'union' }, // Storbritannia
}

/**
 * De sju delstatsflaggene som er ren geometri. Nøkkelen er FIPS-koden.
 *
 * De 43 andre bærer et segl, en figur eller en tekstlinje. Marylands
 * kors bottony, Californias bjørn, Wyomings bison og alt som har «The Great
 * Seal of the State of …» skrevet rundt kanten hører til en annen sorts
 * ressurs enn denne fila.
 */
const US_STATE_FLAGS: Record<string, FlagSpec> = {
  '01': { kind: 'alabama' },
  '02': { kind: 'alaska' },
  '04': { kind: 'arizona' },
  '08': { kind: 'colorado' },
  15: { kind: 'hawaii' },
  35: { kind: 'newMexico' },
  48: { kind: 'texas' },
}

/**
 * Hvilket sett et merke skal slås opp i.
 *
 * Id-ene fra to datasett kan være like uten å bety det samme, så settet er
 * ikke en bekvemmelighet — det er det som gjør oppslaget entydig.
 */
export type EmblemSet = 'europe' | 'usStates' | 'world'

const SETS: Partial<Record<EmblemSet, Record<string, FlagSpec>>> = {
  europe: EUROPE_FLAGS,
  usStates: US_STATE_FLAGS,
}

// Verdensflaggene er bilder, ikke geometri — se game/worldFlags.ts. Den
// modulen holdes atskilt fordi den bruker Vites `import.meta.glob`, som ikke
// finnes når scripts/check-geo.mjs laster denne fila under node.

/**
 * Merket til et sted, eller null når vi ikke har et troverdig ett.
 *
 * Null er et fullgodt svar. Kalleren tegner ingenting og går videre — et
 * manglende merke skal aldri kunne stoppe et svar.
 */
export function flagFor(set: EmblemSet, featureId: string): FlagSpec | null {
  return SETS[set]?.[featureId] ?? null
}

/** Hvor mange av stedene i et datasett vi faktisk kan tegne. Brukt av tester. */
export function flagCoverage(
  set: EmblemSet,
  ids: string[],
): { drawn: string[]; missing: string[] } {
  const table = SETS[set] ?? {}
  const drawn: string[] = []
  const missing: string[] = []
  for (const id of ids) (table[id] ? drawn : missing).push(id)
  return { drawn, missing }
}
