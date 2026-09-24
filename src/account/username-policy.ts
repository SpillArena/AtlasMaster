/**
 * Hvilke navn en spiller ikke får ta — ett sted, for hele SpillArena.
 *
 * DETTE ERSTATTER TRE KOPIER. FleetBot, HangBot og ScribbleBot hadde hver sin
 * fil med den samme engelske lista på ~470 ord (FleetBot/usernameBlocklist.js,
 * HangBot/src/constants/reservedUsernameTerms.js,
 * ScribbleBot/src/lib/reservedUsernames.ts). De hadde alt begynt å drive fra
 * hverandre — HangBot hadde to ord de andre ikke hadde — og AtlasMaster og
 * forsiden hadde ingen liste i det hele tatt, så kontoen alle spillene nå deler
 * ble laget helt uten filter.
 *
 * TRE TING VAR GALT, og alle tre er rettet her:
 *
 * 1. LISTA VAR BARE ENGELSK. Nettstedet er norsk. Alt en norsk spiller kunne
 *    finne på å skrive gikk rett gjennom. Se NORWEGIAN_TERMS.
 *
 * 2. INGENTING VERNET NAVNET TIL NETTSTEDET SELV. «Admin», «SpillArena»,
 *    «Moderator» var ledige. Det betydde lite da et navn var en streng i et
 *    tekstfelt per spill; nå er et navn én identitet på tvers av fem spill og
 *    en ledertavle andre leser. Se RESERVED_NAMES.
 *
 * 3. SAMMENLIGNINGEN VAR `includes` PÅ HELE LISTA. Med «ass», «anal» og «hell»
 *    på lista betyr det at ekte navn ble nektet: Cassandra, Kassandra, Hassan,
 *    Klasse, Grasse, Analyse, Passord, Massimo, Hellstrom — alle sperret ute av
 *    sitt eget navn, uten noen måte å komme videre på. Det er Scunthorpe-
 *    problemet, og det rammer nøyaktig de navnene et norsk nettsted må slippe
 *    inn. Se `isNameAllowed` for hva som gjøres i stedet.
 *
 * Lista er ikke og blir aldri komplett. Den er en terskel mot det åpenbare, og
 * feil vei å bomme er å slippe gjennom ett stygt navn — som et menneske kan
 * rydde opp i — framfor å nekte en spiller å hete det hen heter.
 */

/**
 * Ord som aldri finnes inni et uskyldig ord.
 *
 * DISSE, og bare disse, sammenlignes som delstreng — «xXnigg3rXx» skal fanges
 * uansett hva som står rundt. Grunnen til at resten av lista IKKE behandles
 * slik står øverst i fila. Legger du noe til her, må det tåle den testen:
 * finnes bokstavrekka inni et vanlig navn, hører den hjemme i PROFANITY_TERMS.
 */
export const SEVERE_TERMS: readonly string[] = [
  'apekatt',
  'beastiality',
  'bestiality',
  'chink',
  'coon',
  'dyke',
  'faggitt',
  'faggot',
  'fagot',
  'gook',
  'heil',
  'hitler',
  'jodesvin',
  'kike',
  'kkk',
  'n1gger',
  'nazi',
  'neger',
  'negger',
  'nigg3r',
  'nigga',
  'niggah',
  'niggas',
  'niggaz',
  'nigger',
  'paki',
  'pedo',
  'pedophile',
  'rapist',
  'retard',
  'shemale',
  'spic',
  'tranny',
]

/**
 * Banning og grovheter, slått sammen fra de tre gamle listene.
 *
 * Matches som HELE ORD, ikke som delstreng: «ass» nekter «ass» og «xX_ass_Xx»,
 * men ikke «Cassandra».
 */
export const PROFANITY_TERMS: readonly string[] = [
  '4r5e',
  '5h1t',
  '5hit',
  'a55',
  'a_s_s',
  'anal',
  'anus',
  'ar5e',
  'arrse',
  'arse',
  'ass',
  'ass-fucker',
  'asses',
  'assfucker',
  'assfukka',
  'asshole',
  'assholes',
  'asswhole',
  'b!tch',
  'b00bs',
  'b17ch',
  'b1tch',
  'ballbag',
  'balls',
  'ballsack',
  'bastard',
  'beastial',
  'bellend',
  'bestial',
  'bi+ch',
  'biatch',
  'bitch',
  'bitcher',
  'bitchers',
  'bitches',
  'bitchin',
  'bitching',
  'bloody',
  'blow job',
  'blowjob',
  'blowjobs',
  'boiolas',
  'bollock',
  'bollok',
  'boner',
  'boob',
  'boobs',
  'booobs',
  'boooobs',
  'booooobs',
  'booooooobs',
  'breasts',
  'buceta',
  'bugger',
  'bum',
  'bunny fucker',
  'butt',
  'butthole',
  'buttmuch',
  'buttplug',
  'bøtteknott',
  'c0ck',
  'c0cksucker',
  'carpet muncher',
  'cawk',
  'cipa',
  'cl1t',
  'clit',
  'clitoris',
  'clits',
  'cnut',
  'cock',
  'cock-sucker',
  'cockface',
  'cockhead',
  'cockmunch',
  'cockmuncher',
  'cocks',
  'cocksuck',
  'cocksucked',
  'cocksucker',
  'cocksucking',
  'cocksucks',
  'cocksuka',
  'cocksukka',
  'cok',
  'cokmuncher',
  'coksucka',
  'cottonp',
  'cox',
  'crap',
  'cum',
  'cummer',
  'cumming',
  'cums',
  'cumshot',
  'cunilingus',
  'cunillingus',
  'cunnilingus',
  'cunt',
  'cuntlick',
  'cuntlicker',
  'cuntlicking',
  'cunts',
  'cyalis',
  'cyberfuc',
  'cyberfuck',
  'cyberfucked',
  'cyberfucker',
  'cyberfuckers',
  'cyberfucking',
  'd1ck',
  'damn',
  'dick',
  'dickhead',
  'dildo',
  'dildos',
  'dink',
  'dinks',
  'dirsa',
  'djævel',
  'dlck',
  'dog-fucker',
  'doggin',
  'dogging',
  'donkeyribber',
  'doosh',
  'duche',
  'ejaculate',
  'ejaculated',
  'ejaculates',
  'ejaculating',
  'ejaculatings',
  'ejaculation',
  'ejakulate',
  'f u c k',
  'f u c k e r',
  'f4nny',
  'f_u_c_k',
  'faen',
  'fag',
  'fagging',
  'faggs',
  'fagots',
  'fags',
  'fanden',
  'fanny',
  'fannyflaps',
  'fannyfucker',
  'fanyy',
  'fatass',
  'fcuk',
  'fcuker',
  'fcuking',
  'feck',
  'fecker',
  'felching',
  'fellate',
  'fellatio',
  'fingerfuck',
  'fingerfucked',
  'fingerfucker',
  'fingerfuckers',
  'fingerfucking',
  'fingerfucks',
  'fistfuck',
  'fistfucked',
  'fistfucker',
  'fistfuckers',
  'fistfucking',
  'fistfuckings',
  'fistfucks',
  'flange',
  'fook',
  'fooker',
  'forbanna',
  'forpulte',
  'fuck',
  'fucka',
  'fucked',
  'fucker',
  'fuckers',
  'fuckhead',
  'fuckheads',
  'fuckin',
  'fucking',
  'fuckings',
  'fuckingshitmotherfucker',
  'fuckme',
  'fucks',
  'fuckwhit',
  'fuckwit',
  'fudge packer',
  'fudgepacker',
  'fuk',
  'fuker',
  'fukker',
  'fukkin',
  'fuks',
  'fukwhit',
  'fukwit',
  'fux',
  'fux0r',
  'gangbang',
  'gangbanged',
  'gangbangs',
  'gaylord',
  'gaysex',
  'goatse',
  'god',
  'god-dam',
  'god-damned',
  'goddamn',
  'goddamned',
  'hardcoresex',
  'hell',
  'helvete',
  'heshe',
  'hoar',
  'hoare',
  'hoer',
  'homo',
  'hore',
  'horniest',
  'horny',
  'hotsex',
  'invalid',
  'jack-off',
  'jackoff',
  'jap',
  'jerk-off',
  'jism',
  'jiz',
  'jizm',
  'jizz',
  'jævel',
  'jævla',
  'kawk',
  'kjerring',
  'knob',
  'knobead',
  'knobed',
  'knobend',
  'knobhead',
  'knobjocky',
  'knobjokey',
  'kock',
  'kondum',
  'kondums',
  'krøpling',
  'kum',
  'kummer',
  'kumming',
  'kums',
  'kunilingus',
  'l3i+ch',
  'l3itch',
  'labia',
  'lesbe',
  'lmfao',
  'lust',
  'lusting',
  'm0f0',
  'm0fo',
  'm45terbate',
  'ma5terb8',
  'ma5terbate',
  'masochist',
  'master-bate',
  'masterb8',
  'masterbat*',
  'masterbat3',
  'masterbate',
  'masterbation',
  'masterbations',
  'masturbate',
  'mo-fo',
  'mof0',
  'mofo',
  'mongol',
  'mothafuck',
  'mothafucka',
  'mothafuckas',
  'mothafuckaz',
  'mothafucked',
  'mothafucker',
  'mothafuckers',
  'mothafuckin',
  'mothafucking',
  'mothafuckings',
  'mothafucks',
  'mother fucker',
  'motherfuck',
  'motherfucked',
  'motherfucker',
  'motherfuckers',
  'motherfuckin',
  'motherfucking',
  'motherfuckings',
  'motherfuckka',
  'motherfucks',
  'muff',
  'mutha',
  'muthafecker',
  'muthafuckker',
  'muther',
  'mutherfucker',
  'n1gga',
  'ni6',
  'nigg4h',
  'niggers',
  'nob',
  'nob jokey',
  'nobhead',
  'nobjocky',
  'nobjokey',
  'numbnuts',
  'nutsack',
  'orgasim',
  'orgasims',
  'orgasm',
  'orgasms',
  'p0rn',
  'pakkis',
  'pawn',
  'pecker',
  'penis',
  'penisfucker',
  'phonesex',
  'phuck',
  'phuk',
  'phuked',
  'phuking',
  'phukked',
  'phukking',
  'phuks',
  'phuq',
  'pigfucker',
  'pimpis',
  'piss',
  'pissed',
  'pisser',
  'pissers',
  'pisses',
  'pissflaps',
  'pissin',
  'pissing',
  'pissoff',
  'poop',
  'porn',
  'porno',
  'pornography',
  'pornos',
  'prick',
  'pricks',
  'pron',
  'pube',
  'pusse',
  'pussi',
  'pussies',
  'pussy',
  'pussys',
  'rectum',
  'rimjaw',
  'rimming',
  's hit',
  's.o.b.',
  's_h_i_t',
  'sadist',
  'schlong',
  'screwing',
  'scroat',
  'scrote',
  'scrotum',
  'semen',
  'sex',
  'sh!+',
  'sh!t',
  'sh1t',
  'shag',
  'shagger',
  'shaggin',
  'shagging',
  'shi+',
  'shit',
  'shitdick',
  'shite',
  'shited',
  'shitey',
  'shitfuck',
  'shitfull',
  'shithead',
  'shiting',
  'shitings',
  'shits',
  'shitted',
  'shitter',
  'shitters',
  'shitting',
  'shittings',
  'shitty',
  'skank',
  'slut',
  'sluts',
  'smegma',
  'smut',
  'snatch',
  'son-of-a-bitch',
  'soper',
  'spac',
  'spunk',
  't1tt1e5',
  't1tties',
  'teets',
  'teez',
  'testical',
  'testicle',
  'tit',
  'titfuck',
  'tits',
  'titt',
  'tittie5',
  'tittiefucker',
  'titties',
  'tittyfuck',
  'tittywank',
  'titwank',
  'tosser',
  'turd',
  'tw4t',
  'twat',
  'twathead',
  'twatty',
  'twunt',
  'twunter',
  'v14gra',
  'v1gra',
  'vagina',
  'viagra',
  'vulva',
  'w00se',
  'wang',
  'wank',
  'wanker',
  'wanky',
  'whoar',
  'whore',
  'willies',
  'willy',
  'xrated',
  'xxx',
  'åndssvak',
]

/** Norsk. Manglet helt i alle tre listene dette erstatter. */
export const NORWEGIAN_TERMS: readonly string[] = [
  'dritt',
  'drittfitte',
  'drittsekk',
  'drittunge',
  'faen',
  'faens',
  'fanden',
  'fitta',
  'fitte',
  'fitter',
  'fittetryne',
  'helvete',
  'helvetes',
  'homse',
  'hore',
  'horer',
  'horunge',
  'idiot',
  'idioter',
  'jaevel',
  'jaevla',
  'jævel',
  'jævla',
  'jævlig',
  'knulle',
  'knuller',
  'kodd',
  'kodde',
  'kuk',
  'kuken',
  'kukk',
  'kuksuger',
  'kødd',
  'kødde',
  'lespe',
  'ludder',
  'megge',
  'mongis',
  'mongo',
  'morrapuler',
  'pikk',
  'pikken',
  'pokker',
  'pule',
  'puler',
  'pupper',
  'rasshol',
  'rasshøl',
  'reva',
  'ronke',
  'runke',
  'runker',
  'ræva',
  'rævhøl',
  'rønke',
  'satan',
  'satans',
  'soper',
  'sopere',
  'spasser',
  'tispe',
  'tulling',
]

/**
 * Navn som utgir seg for å være nettstedet, en ansatt eller et system.
 *
 * Eierens eget navn står IKKE her. «emilb» ville sperret «Emil B.», som er et
 * helt vanlig navn — og eieren har uansett alt kontoen sin. En reservasjon som
 * nekter ekte folk navnet sitt verner mindre enn den koster.
 *
 * Disse nektes som HELE NAVNET (etter folding), ikke som ord inni et navn:
 * «Admin» er sperret, «Admiral Ackbar» er ikke. En spiller som heter noe som
 * inneholder «all» eller «me» skal ikke straffes for det.
 */
export const RESERVED_NAMES: readonly string[] = [
  'admin',
  'administrator',
  'administrators',
  'admins',
  'all',
  'anonym',
  'anonymous',
  'arena',
  'atlasmaster',
  'billing',
  'bot',
  'channel',
  'deleted',
  'everyone',
  'fleetbot',
  'gjest',
  'guest',
  'hangbot',
  'helpdesk',
  'here',
  'host',
  'me',
  'mod',
  'moderator',
  'moderators',
  'mods',
  'nan',
  'nil',
  'no-reply',
  'none',
  'noreply',
  'null',
  'official',
  'owner',
  'payment',
  'pixel-panic',
  'pixelpanic',
  'proportion-panic',
  'proportionpanic',
  'root',
  'scribblebot',
  'security',
  'server',
  'spill-arena',
  'spillarena',
  'spillarena-no',
  'staff',
  'superuser',
  'support',
  'sysadmin',
  'system',
  'systemet',
  'test',
  'testuser',
  'undefined',
  'unknown',
  'void',
  'webmaster',
  'you',
]

/**
 * Leet-folding: 4→a, 1→i, 0→o, $→s …
 *
 * Uten dette er «f4gg0t» et helt annet ord enn «faggot», og lista blir en
 * liste over stavemåter i stedet for ord. De gamle listene løste det ved å ta
 * inn stavevariantene som egne oppføringer — «4r5e», «5h1t», «b17ch» — noe som
 * bare virker for de variantene noen husket å skrive ned.
 *
 * Sifrene er tvetydige med vilje: «1337» folder til «leet», og et navn som
 * «Emil2000» folder til «emilzooo». Det gjør ingen skade, fordi resultatet kun
 * brukes til å slå opp i lista — det er aldri navnet som lagres.
 */
const LEET: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '6': 'g',
    '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i',
}

/** Små bokstaver, uten aksenter, uten skilletegn, med sifre foldet til bokstaver. */
export function fold(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .split('')
        .map((char) => LEET[char] ?? char)
        .join('')
        .replace(/[^a-z0-9]/g, '')
}

/**
 * Navnet delt i ord.
 *
 * Deler på alt som ikke er en bokstav eller et siffer, OG på overgangen fra
 * liten til stor bokstav, slik at «xXFuckXx» og «SuperFuckBoy» faller fra
 * hverandre i de ordene de faktisk består av. Uten den andre delen ville det
 * eneste som skilte et stygt ord fra resten vært et mellomrom noen kunne latt
 * være å skrive.
 */
function words(value: string): string[] {
    return value
        .replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2')
        .split(/[^\p{L}\p{N}]+/u)
        .map(fold)
        .filter(Boolean)
}

/**
 * Pynt rundt et ord er ikke et annet ord.
 *
 * «xXFuckXx» deles til «x», «xfuck», «xx» — og «xfuck» står ikke på noen liste,
 * så navnet slapp gjennom. Bokstavene som brukes til å ramme inn et navn er få
 * og forutsigbare, så hvert ord prøves også uten dem.
 *
 * Settet holdes med vilje lite. «k» ville strippet «Klasse» ned til «lasse», og
 * da er vi tilbake til å finne ord som ikke står der.
 */
const PADDING = /^[xz]+|[xz]+$/g

const SEVERE = new Set(SEVERE_TERMS.map(fold))
const BANNED_WORDS = new Set([...PROFANITY_TERMS, ...NORWEGIAN_TERMS].map(fold))
const RESERVED = new Set(RESERVED_NAMES.map(fold))

export type NameRejection = 'severe' | 'profanity' | 'reserved'

/**
 * Hvorfor navnet ikke går, eller null når det går.
 *
 * Tre regler, i tur:
 *
 *   1. Et grovt ord hvor som helst i navnet — delstreng, se SEVERE_TERMS.
 *   2. Et banneord som ET HELT ORD i navnet. «Cassandra» inneholder «ass», men
 *      har det ikke som ord, og slipper gjennom. Det er hele poenget.
 *   3. Hele navnet er et reservert navn. «Admin» nektes, «Admiral» gjør ikke.
 *
 * Merk at dette er en terskel, ikke en garanti: den fanger det åpenbare og
 * ingenting annet. Et menneske må fortsatt kunne rydde opp etterpå.
 */
export function checkName(username: string): NameRejection | null {
    const folded = fold(username)
    if (!folded) return null

    for (const term of SEVERE) {
        if (term.length > 2 && folded.includes(term)) return 'severe'
    }

    for (const word of words(username)) {
        if (BANNED_WORDS.has(word)) return 'profanity'
        const unpadded = word.replace(PADDING, '')
        if (unpadded.length > 2 && BANNED_WORDS.has(unpadded)) return 'profanity'
    }

    if (RESERVED.has(folded)) return 'reserved'

    return null
}

/** Sant når navnet kan brukes. Motsatt av `checkName`. */
export const isNameAllowed = (username: string): boolean => checkName(username) === null
