type PirateCompassProps = {
    size?: number;
    className?: string;
    heading?: number; // 0-359, where 0 = north
    showNeedle?: boolean;
};

export default function PirateCompass({
    size = 240,
    className = "",
    heading = 0,
    showNeedle = true,
}: PirateCompassProps) {
    const center = 200;
    const roseOuter = 116;
    const roseInner = 74;

    const cardinals = [
        { label: "N", angle: 0 },
        { label: "E", angle: 90 },
        { label: "S", angle: 180 },
        { label: "W", angle: 270 },
    ];

    const intercardinals = [
        { label: "NE", angle: 45 },
        { label: "SE", angle: 135 },
        { label: "SW", angle: 225 },
        { label: "NW", angle: 315 },
    ];

    const degrees = Array.from({ length: 72 }, (_, i) => i * 5);

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

    const longTicks = Array.from({ length: 16 }, (_, i) => i * 22.5);
    const ringNumbers = Array.from({ length: 12 }, (_, i) => ({
        label: `${i === 0 ? 36 : i * 3}`,
        angle: i * 30,
    }));

    return (
        <div
            className={`pirate-compass ${className}`}
            style={{ width: size, height: size }}
            aria-label="Compass"
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

                <circle cx="200" cy="200" r="126" fill="none" stroke="#67411e" strokeWidth="1.5" opacity="0.72" />
                <circle cx="200" cy="200" r="118" fill="none" stroke="#b78437" strokeWidth="1.2" opacity="0.72" />
                <circle cx="200" cy="200" r="98" fill="none" stroke="#1b4a4d" strokeWidth="1" opacity="0.42" />
                <circle cx="200" cy="200" r="78" fill="none" stroke="#1b4a4d" strokeWidth="1" opacity="0.5" />

                {degrees.map((angle, i) => {
                    const isCardinal = angle % 90 === 0;
                    const isMajor = angle % 30 === 0;
                    const outer = 132;
                    const inner = isCardinal ? 116 : isMajor ? 121 : 125;
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
                            strokeWidth={isCardinal ? 3 : isMajor ? 2 : 1}
                            strokeLinecap="round"
                            opacity={0.95}
                        />
                    );
                })}

                {longTicks.map((angle, i) => {
                    const p1 = polar(angle, 112);
                    const p2 = polar(angle, 88);
                    return (
                        <line
                            key={`inner-${i}`}
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            stroke="#24565a"
                            strokeWidth="1.1"
                            opacity="0.35"
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
                            d={diamondPath(angle, 98, 60, 7)}
                            fill="#4f857e"
                            stroke="#234649"
                            strokeWidth="1.4"
                            opacity="0.9"
                        />
                    ))}

                    <circle cx="200" cy="200" r="20" fill="url(#pc-brass-dark)" stroke="#25474a" strokeWidth="3" />
                    <circle cx="200" cy="200" r="7" fill="#fff0b0" stroke="#80501e" strokeWidth="2" />
                </g>

                <g>
                    {cardinals.map((item) => {
                        const p = polar(item.angle, 104);
                        return (
                            <text
                                key={item.label}
                                x={p.x}
                                y={p.y + 6}
                                textAnchor="middle"
                                className={`pirate-compass__label pirate-compass__label--cardinal ${item.label === "N" ? "is-north" : ""
                                    }`}
                            >
                                {item.label}
                            </text>
                        );
                    })}

                    {intercardinals.map((item) => {
                        const p = polar(item.angle, 92);
                        return (
                            <text
                                key={item.label}
                                x={p.x}
                                y={p.y + 4}
                                textAnchor="middle"
                                className="pirate-compass__label pirate-compass__label--minor"
                            >
                                {item.label}
                            </text>
                        );
                    })}

                    {ringNumbers.map((item) => {
                        const p = polar(item.angle + 15, 124);
                        return (
                            <text
                                key={item.label}
                                x={p.x}
                                y={p.y + 4}
                                textAnchor="middle"
                                className="pirate-compass__degree"
                            >
                                {item.label}
                            </text>
                        );
                    })}
                </g>

                <g transform="translate(200 200)">
                    <g transform={`rotate(${heading})`} className="pirate-compass__needleWrap">
                        {showNeedle && (
                            <>
                                <path
                                    d="M 0 -132 L 12 -8 L 0 -24 L -12 -8 Z"
                                    fill="url(#pc-needle-red)"
                                    stroke="#45150f"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M 0 132 L 10 10 L 0 26 L -10 10 Z"
                                    fill="url(#pc-needle-light)"
                                    stroke="#5b4627"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M -4 -118 L 0 -145 L 4 -118"
                                    fill="#e8d7a4"
                                    stroke="#5b4322"
                                    strokeWidth="1.5"
                                />
                            </>
                        )}
                    </g>
                </g>

                <g className="pirate-compass__fleur">
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

            <style>{`
        .pirate-compass {
          border-radius: 50%;
          user-select: none;
          isolation: isolate;
          filter: drop-shadow(0 18px 28px rgba(0, 0, 0, 0.35));
        }

        .pirate-compass__svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .pirate-compass__label {
          font-family: Georgia, "Times New Roman", serif;
          fill: #163f45;
          letter-spacing: 0;
          paint-order: stroke;
          stroke: rgba(245, 225, 178, 0.35);
          stroke-width: 1.4px;
        }

        .pirate-compass__label--cardinal {
          font-size: 25px;
          font-weight: 700;
        }

        .pirate-compass__label--cardinal.is-north {
          fill: #9e2d1e;
          font-size: 31px;
        }

        .pirate-compass__label--minor {
          font-size: 12px;
          font-weight: 700;
          opacity: 0.88;
        }

        .pirate-compass__degree {
          font-family: Georgia, "Times New Roman", serif;
          font-size: 9px;
          font-weight: 700;
          fill: #6c4923;
          letter-spacing: 0;
          opacity: 0.75;
        }

        .pirate-compass__needleWrap {
          transform-origin: center;
          transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .pirate-compass__fleur {
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.22));
        }
      `}</style>
        </div>
    );
}