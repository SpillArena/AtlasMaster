/**
 * Kompasset på landingssiden.
 *
 * Det var tegnet ferdig og stod helt stille. Nålen hadde en overgang som
 * aldri fyrte, fordi ingen sendte inn en `heading`; den hardkodede
 * aria-etiketten var engelsk i en app som snakker to språk; og hver montering
 * skrøv en `<style>`-blokk inn i DOM-en på nytt, med farger som ikke visste at
 * appen har et mørkt tema.
 *
 * Nå peker det. `heading` kommer fra regionen musa er over, og nålen svinger
 * dit med overgangen som alltid har ligget der. Uten en peiling driver den
 * sakte rundt nord, slik en magnetnål gjør når ingenting drar i den.
 */
import type { CSSProperties } from "react";

type PirateCompassProps = {
    /**
     * Diameteren, som et tall i piksler eller en hvilken som helst CSS-lengde.
     *
     * Den var et rent tall før, skrevet rett inn i `width`/`height`. Da kunne
     * instrumentet bare ha én størrelse om gangen, og landingssida valgte 168
     * px uansett hvor lav skjermen var — på et bredt, lavt vindu la kompasset
     * seg oppå Vest-Afrika. En streng slipper `clamp()` inn, og da er
     * størrelsen skjermens og ikke komponentens.
     */
    size?: number | string;
    className?: string;
    /** 0-359, der 0 = nord. `null` = ingenting å peke på, nålen driver. */
    heading?: number | null;
    showNeedle?: boolean;
    /** tilgjengelig navn — må komme utenfra, appen snakker to språk */
    label?: string;
};

/*
 * MERK — instrumentet plasserer ikke seg selv, og tar ikke imot en
 * plasseringsklasse heller.
 *
 * Roten er `position: relative`, fordi messingkuppelen over glasset ligger
 * `absolute inset-0` inni. Det stod som Tailwind-klassen `relative` rett i
 * `className` her, foran den kalleren sendte inn — og `absolute` utenfra vant
 * aldri: begge er utility-klasser med samme spesifisitet, så det er
 * rekkefølgen i stilarket som avgjør, og der kommer `.relative` sist.
 * Kompasset falt derfor ut i vanlig flyt og la seg *under* kartet i stedet for
 * nede i hjørnet av det.
 *
 * Nå bor `position` i `.pirate-compass` i index.css og hører komponenten til.
 * Skal instrumentet stå et sted, pakk det inn:
 *
 *   <div className="absolute bottom-5 left-5"><PirateCompass … /></div>
 */

export default function PirateCompass({
    size = 240,
    className = "",
    heading = null,
    showNeedle = true,
    label = "Compass",
}: PirateCompassProps) {
    const pointing = heading !== null && Number.isFinite(heading);
    const center = 200;

    /*
     * Urskiva i tre bånd, utenfra og inn: streker (127–137), bokstaver (112),
     * rose (56–96). Ingen av dem deler radius med et annet.
     *
     * De gjorde det før, og da forsvant halve instrumentet. Rosen gikk ut til
     * 116 og bokstavene stod på 104 — altså oppå diamantene — og fargene var
     * hverandres: «N» var #9e2d1e på en #9e2d1e nord-diamant, «E», «S» og «W»
     * var #163f45 på #174a50. De fire hovedstrekene var ikke svake, de var
     * usynlige. Nå står bokstavene på bart papir, der de leses mot papiret og
     * ikke mot en figur under seg.
     */
    const roseOuter = 96;
    const roseInner = 56;
    const letterRadius = 112;

    /*
     * Nord er liljen, ikke en «N».
     *
     * Den lå der fra før — en fleur-de-lis tvers over nordaksen — og en «N»
     * oppå den var to nordmerker i samme punkt. Liljen er dessuten den et
     * kompass faktisk bruker. Så blir det tre bokstaver, med god plass.
     */
    const cardinals = [
        { label: "E", angle: 90 },
        { label: "S", angle: 180 },
        { label: "W", angle: 270 },
    ];

    /*
     * Hver tiende grad, ikke hver femte.
     *
     * Instrumentet står mellom 96 og 168 px bredt på landingssida. Ved 168 px
     * er strekbåndet rundt 56 px i radius, altså 350 px rundt: 72 streker ble
     * én per 4,9 px, og båndet leste som en grå ring. 36 gir dobbelt så mye
     * luft — man ser at det *er* streker. I den nedre enden av spennet er
     * selv 36 streker tett, men da er båndet uansett et mønster og ikke noe
     * man teller.
     */
    const degrees = Array.from({ length: 36 }, (_, i) => i * 10);

    const polar = (angle: number, radius: number) => {
        const a = ((angle - 90) * Math.PI) / 180;
        return {
            x: center + Math.cos(a) * radius,
            y: center + Math.sin(a) * radius,
        };
    };

    const diamondPath = (angle: number, outer: number, inner: number, width: number) => {
        const tip = polar(angle, outer);
        const base = polar(angle, inner);
        const left = polar(angle - width, inner + (outer - inner) * 0.28);
        const right = polar(angle + width, inner + (outer - inner) * 0.28);
        return `M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${base.x} ${base.y} L ${right.x} ${right.y} Z`;
    };

    return (
        <div
            className={`pirate-compass ${className}`}
            /*
             * Størrelsen går inn som en egenskap, ikke som `width`/`height`.
             * `.pirate-compass` leser den, og en beholderspørring i index.css
             * leser den samme bredden én gang til for å forstørre
             * himmelretningene når instrumentet blir lite. Skrev vi `width`
             * her, ville en CSS-lengde som `clamp(...)` fortsatt virket, men
             * stilarket hadde ikke hatt noe å spørre om.
             */
            style={{ "--compass-size": typeof size === "number" ? `${size}px` : size } as CSSProperties}
            aria-label={label}
            role="img"
        >
            <svg viewBox="0 0 400 400" className="pirate-compass__svg">
                <defs>
                    <radialGradient id="pc-wood" cx="50%" cy="45%" r="60%">
                        <stop offset="0%" stopColor="#815832" />
                        <stop offset="42%" stopColor="#604025" />
                        <stop offset="76%" stopColor="#3c2517" />
                        <stop offset="100%" stopColor="#21130d" />
                    </radialGradient>

                    <radialGradient id="pc-brass" cx="35%" cy="30%" r="80%">
                        <stop offset="0%" stopColor="#fff0b7" />
                        <stop offset="22%" stopColor="#e7c66f" />
                        <stop offset="52%" stopColor="#b77b2e" />
                        <stop offset="78%" stopColor="#70401a" />
                        <stop offset="100%" stopColor="#38200f" />
                    </radialGradient>

                    <radialGradient id="pc-brass-dark" cx="50%" cy="50%" r="70%">
                        <stop offset="0%" stopColor="#caa35f" />
                        <stop offset="60%" stopColor="#8b6230" />
                        <stop offset="100%" stopColor="#3f2914" />
                    </radialGradient>

                    <radialGradient id="pc-paper" cx="50%" cy="45%" r="65%">
                        <stop offset="0%" stopColor="#fff5ce" />
                        <stop offset="58%" stopColor="#ead9a4" />
                        <stop offset="100%" stopColor="#b9955c" />
                    </radialGradient>

                    <linearGradient id="pc-needle-red" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#7c1612" />
                        <stop offset="55%" stopColor="#b03522" />
                        <stop offset="100%" stopColor="#f2b181" />
                    </linearGradient>

                    <linearGradient id="pc-needle-light" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#d8caa3" />
                        <stop offset="50%" stopColor="#f4e6be" />
                        <stop offset="100%" stopColor="#8f7750" />
                    </linearGradient>

                    <filter id="pc-shadow" x="-30%" y="-30%" width="160%" height="160%">
                        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity="0.35" />
                    </filter>

                    <filter id="pc-innerShadow" x="-30%" y="-30%" width="160%" height="160%">
                        <feOffset dx="0" dy="3" />
                        <feGaussianBlur stdDeviation="4" result="offset-blur" />
                        <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                        <feFlood floodColor="#000000" floodOpacity="0.35" result="color" />
                        <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                        <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                    </filter>

                    <filter id="pc-paperTexture">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.9"
                            numOctaves="2"
                            seed="8"
                            result="noise"
                        />
                        <feColorMatrix
                            in="noise"
                            type="matrix"
                            values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 .08 0"
                        />
                    </filter>

                    <filter id="pc-metalTexture">
                        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="4" />
                        <feDisplacementMap in="SourceGraphic" scale="4" />
                    </filter>
                </defs>

                <g filter="url(#pc-shadow)">
                    <circle cx="200" cy="200" r="188" fill="url(#pc-wood)" stroke="#1e120b" strokeWidth="5" />
                    <circle cx="200" cy="200" r="178" fill="none" stroke="#d2a755" strokeWidth="3" opacity="0.75" />
                    <circle cx="200" cy="200" r="171" fill="none" stroke="#27170d" strokeWidth="7" opacity="0.75" />
                </g>

                <g filter="url(#pc-metalTexture)">
                    <circle cx="200" cy="200" r="160" fill="url(#pc-brass)" stroke="#492711" strokeWidth="7" />
                    <circle cx="200" cy="200" r="148" fill="none" stroke="#fff0b0" strokeWidth="2" opacity="0.55" />
                    <circle cx="200" cy="200" r="142" fill="url(#pc-paper)" stroke="#6e421e" strokeWidth="3" />
                    <circle
                        cx="200"
                        cy="200"
                        r="136"
                        fill="transparent"
                        filter="url(#pc-paperTexture)"
                        opacity="0.9"
                    />
                </g>

                {/* ytterkant og innerkant av strekbåndet, og kanten av rosen */}
                <circle cx="200" cy="200" r="138" fill="none" stroke="#67411e" strokeWidth="1.5" opacity="0.72" />
                <circle cx="200" cy="200" r="125" fill="none" stroke="#b78437" strokeWidth="1.2" opacity="0.72" />
                <circle cx="200" cy="200" r="100" fill="none" stroke="#1b4a4d" strokeWidth="1" opacity="0.42" />

                {degrees.map((angle, i) => {
                    const isCardinal = angle % 90 === 0;
                    const isMajor = angle % 30 === 0;
                    const outer = 137;
                    const inner = isCardinal ? 127 : isMajor ? 130 : 133;
                    const p1 = polar(angle, outer);
                    const p2 = polar(angle, inner);
                    return (
                        <line
                            key={i}
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            stroke={isCardinal ? "#173f43" : "#765328"}
                            strokeWidth={isCardinal ? 3.5 : isMajor ? 2.4 : 1.4}
                            strokeLinecap="round"
                            opacity={0.95}
                        />
                    );
                })}

                <g filter="url(#pc-innerShadow)">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                        <path
                            key={`outer-star-${i}`}
                            d={diamondPath(angle, roseOuter, roseInner, angle % 90 === 0 ? 11 : 8)}
                            fill={angle === 0 ? "#9e2d1e" : angle % 90 === 0 ? "#174a50" : "#d5a74d"}
                            stroke="#26341f"
                            strokeWidth="2"
                            opacity={angle % 90 === 0 ? 0.98 : 0.85}
                        />
                    ))}

                    {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle, i) => (
                        <path
                            key={`mid-star-${i}`}
                            d={diamondPath(angle, 80, 46, 7)}
                            fill="#4f857e"
                            stroke="#234649"
                            strokeWidth="1.4"
                            opacity="0.9"
                        />
                    ))}

                    <circle cx="200" cy="200" r="20" fill="url(#pc-brass-dark)" stroke="#25474a" strokeWidth="3" />
                    <circle cx="200" cy="200" r="7" fill="#fff0b0" stroke="#80501e" strokeWidth="2" />
                </g>

                {/*
                  NØ/SØ/SV/NV og gradtallene stod her før. Selv på det
                  største instrumentet sida viser, 168 px, kom de ut som
                  henholdsvis 5 og 3,8 piksler — under det man kan lese, altså
                  mønster og ikke tekst, oppå et bånd som allerede var fullt.
                  Nå krymper kompasset ned mot 96 px, og da ville de vært under
                  tre piksler. Diamantene i rosen peker på mellomretningene;
                  det er merket. Gradtallene hadde ingen å avløse, og er borte.
                */}
                <g>
                    {cardinals.map((item) => {
                        const p = polar(item.angle, letterRadius);
                        return (
                            <text
                                key={item.label}
                                x={p.x}
                                y={p.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="pirate-compass__label pirate-compass__label--cardinal"
                            >
                                {item.label}
                            </text>
                        );
                    })}
                </g>

                <g>
                    {/*
                      Uten en peiling driver nålen sakte rundt nord — en
                      magnetnål står aldri helt stille. Med en peiling slår
                      driften av, og overgangen i stilarket tar nåla dit.

                      MERK — `rotate()` står uten dreiepunkt med vilje.
                      Punktet ligger i stilarket, som `transform-origin` på
                      `.pirate-compass__needleWrap`, og det gjelder både denne
                      rotasjonen og driftanimasjonen. Skriver vi senteret her
                      også, blir det lagt på to ganger: nåla dreier først om
                      (200 200) og så om (200 200) én gang til, og havner
                      `c − R(c)` unna — 400 enheter rett ut av urskiva ved 90°.
                    */}
                    <g
                        transform={`rotate(${pointing ? heading : 0})`}
                        className={`pirate-compass__needleWrap${pointing ? "" : " is-adrift"}`}
                    >
                        {/*
                          Nåla stopper på radius 98 — inne i rosen, og klar av
                          bokstavbåndet. Den delen som snurrer har rosen for
                          seg selv, og kortet under beholder liljen og
                          bokstavene sine udekket, uansett hvor nåla står.
                          Rakk den lenger, lå den permanent oppå nordmerket.

                          Den lille fløtefargede hetta over den røde spissen er
                          av samme grunn borte. Den nådde dessuten radius 145,
                          utenfor papirskiva på 142, og ble klippet av kanten.
                        */}
                        {showNeedle && (
                            <>
                                <path
                                    d="M 200 102 L 212 192 L 200 176 L 188 192 Z"
                                    fill="url(#pc-needle-red)"
                                    stroke="#45150f"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M 200 298 L 210 210 L 200 226 L 190 210 Z"
                                    fill="url(#pc-needle-light)"
                                    stroke="#5b4627"
                                    strokeWidth="2"
                                />
                            </>
                        )}
                    </g>
                </g>

                {/*
                  Liljen er nordmerket, og står i bokstavbåndet sammen med E, S
                  og W. Tegningen er den samme som før; den blir bare skalert
                  ned til båndet i stedet for å bli tegnet om punkt for punkt.
                  Slik den stod nådde spissen radius 147 — utenfor papirskiva —
                  og foten gikk helt inn i rosen.
                */}
                <g
                    className="pirate-compass__fleur"
                    transform="translate(200 70) scale(0.384) translate(-200 -53)"
                >
                    <path
                        d="M200 53
               C191 60, 189 74, 195 82
               C186 80, 180 88, 181 96
               C182 105, 190 110, 198 108
               L198 126
               L202 126
               L202 108
               C210 110, 218 105, 219 96
               C220 88, 214 80, 205 82
               C211 74, 209 60, 200 53 Z"
                        fill="#f1dd9e"
                        stroke="#573719"
                        strokeWidth="2.2"
                    />
                    <path
                        d="M194 122 Q200 112 206 122"
                        fill="none"
                        stroke="#573719"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </g>

                <circle cx="200" cy="200" r="150" fill="none" stroke="#efd39b" strokeWidth="1.5" opacity="0.3" />
                <circle cx="200" cy="200" r="154" fill="none" stroke="#3a2412" strokeWidth="2" opacity="0.2" />

                <g opacity="0.22">
                    <path d="M120 112 C146 97, 163 102, 176 119" stroke="#5c3514" strokeWidth="2" fill="none" />
                    <path d="M245 89 C275 101, 287 118, 291 146" stroke="#5c3514" strokeWidth="1.8" fill="none" />
                    <path d="M102 248 C124 261, 136 279, 144 304" stroke="#5c3514" strokeWidth="2" fill="none" />
                    <path d="M236 292 C264 283, 285 265, 299 243" stroke="#5c3514" strokeWidth="1.8" fill="none" />
                </g>
            </svg>
            <span className="pirate-compass__dome" aria-hidden />
        </div>
    );
}