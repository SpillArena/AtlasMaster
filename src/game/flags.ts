/**
 * Flagg, teikna av spelet sjølv.
 *
 * KVIFOR IKKJE EMOJI. Unicode har eit flagg for kvar ISO 3166-1-kode, og det
 * er den lettaste løysinga som finst — to teikn per land. Windows har berre
 * aldri levert flagga: Segoe UI Emoji teiknar dei ikkje, så eit norsk flagg
 * blir «NO» i to bokstavar på den vanlegaste skrivebordsplattforma i landet.
 * Eit hint som forsvinn for halvparten av spelarane er ikkje eit hint.
 *
 * KVIFOR IKKJE BILETE. Eit ferdig flaggsett er tusenvis av filer eller ein
 * pakke på fleire hundre kilobyte, og alternativet — å peike på nokon andre
 * sin tenar — sender spelarane sine kart- og landval til ein tredjepart og
 * fell saman den dagen den tenaren gjer det.
 *
 * KVIFOR EI SKILDRING. Dei fleste europeiske flagg *er* geometri: to eller
 * tre band, eit nordisk kors, eit kvitt kors på raudt. Skildringa under er
 * nokre få hundre byte for heile Europa, og teiknaren i FlagBadge gjer henne
 * om til SVG utan ei einaste nettverkshenting.
 *
 * KVA SOM MANGLAR. Flagg med våpenskjold, segl eller silhuettar er ikkje her:
 * Albania, Bosnia-Hercegovina, Hviterussland, Kypros, Moldova, Montenegro,
 * Nord-Makedonia, Serbia, Slovakia og Slovenia. Å teikne dei som reine band
 * ville vore verre enn ingenting — Slovenia, Slovakia og Russland ville fått
 * *same* flagg. Dei står difor utan, og flagget er med vilje eit tillegg til
 * namnet og aldri det einaste haldepunktet: `flagFor` gjev null, og
 * `FlagBadge` teiknar ingenting.
 *
 * KVA MED FYLKESVÅPEN OG DELSTATSFLAGG. Delstatsflagga er fri gjengiving, men
 * berre eit fåtal av dei er geometri: dei fleste ber eit segl med tekst,
 * figurar og årstal, og eit segl kan ikkje skildrast i nokre få tal. Dei sju
 * som *kan* teiknast står her; resten står utan, på same vilkår som dei
 * europeiske.
 *
 * Dei norske fylkesvåpna er ikkje her, og det er eit rettsleg val og ikkje
 * eit teknisk. Offentlege våpen i Noreg er verna: bruk krev løyve frå
 * fylkeskommunen som eig våpenet, og eit spel er ikkje unnateke. Å teikne dei
 * på nytt gjer dei ikkje frie — det er motivet som er verna, ikkje fila. Vi
 * hentar dei difor korkje frå ein tredjepart eller frå eiga hand.
 *
 * Nøklane er den same id-en som features i datasettet ber: ISO 3166-1
 * numerisk for landa, FIPS for delstatane. Dei to overlappar — «40» er både
 * Østerrike og Oklahoma — så oppslaget går alltid gjennom eit sett.
 */

/** Band på tvers eller på langs, med valfri vekt per band. */
export interface BandsFlag {
  kind: 'bands'
  dir: 'h' | 'v'
  colors: string[]
  /** relativ breidd per band; utelate = like breie */
  weights?: number[]
}

/** Nordisk kors — forskyve mot stanga, med valfri indre stripe. */
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

/** Ni striper og eit kors i øvre hjørne (Hellas). */
export interface GreeceFlag {
  kind: 'greece'
}

/** To vassrette felt og ein kile frå stanga (Tsjekkia). */
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

/** Tre band og eit sjakkbrett (Kroatia). */
export interface CroatiaFlag {
  kind: 'croatia'
}

/**
 * Delstatsflagg med kvar si eiga form. Kvart av dei er eit oppsett som ikkje
 * går att nokon annan stad, så dei ber berre namnet sitt.
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
  // --- vassrette band ---
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

  // --- loddrette band ---
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

  // --- eigne former ---
  191: { kind: 'croatia' }, // Kroatia
  203: { kind: 'wedge', top: '#ffffff', bottom: '#d7141a', wedge: '#11457e' }, // Tsjekkia
  300: { kind: 'greece' }, // Hellas
  756: { kind: 'cross', field: '#d52b1e', cross: '#ffffff' }, // Sveits
  826: { kind: 'union' }, // Storbritannia
}

/**
 * Dei sju delstatsflagga som er rein geometri. Nøkkelen er FIPS-koden.
 *
 * Dei 43 andre ber eit segl, ein figur eller ei tekstlinje. Maryland sitt
 * kors bottony, Californias bjørn, Wyomings bison og alt som har «The Great
 * Seal of the State of …» skrive rundt kanten høyrer til ei anna sorts
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
 * Kva sett eit merke skal slåast opp i.
 *
 * Id-ane frå to datasett kan vere like utan å tyde det same, så settet er
 * ikkje ein bekvemmelegheit — det er det som gjer oppslaget eintydig.
 */
export type EmblemSet = 'europe' | 'usStates'

const SETS: Record<EmblemSet, Record<string, FlagSpec>> = {
  europe: EUROPE_FLAGS,
  usStates: US_STATE_FLAGS,
}

/**
 * Merket til eit sted, eller null når vi ikkje har eit truverdig eitt.
 *
 * Null er eit fullgodt svar. Kallaren teiknar ingenting og går vidare — eit
 * manglande merke skal aldri kunne stoppe eit svar.
 */
export function flagFor(set: EmblemSet, featureId: string): FlagSpec | null {
  return SETS[set][featureId] ?? null
}

/** Kor mange av stadene i eit datasett vi faktisk kan teikne. Brukt av testar. */
export function flagCoverage(
  set: EmblemSet,
  ids: string[],
): { drawn: string[]; missing: string[] } {
  const table = SETS[set]
  const drawn: string[] = []
  const missing: string[] = []
  for (const id of ids) (table[id] ? drawn : missing).push(id)
  return { drawn, missing }
}
