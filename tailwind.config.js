/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // brødtekst: humanistisk sans, rolig og lesbar
        sans: [
          '"Instrument Sans"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // display: titler, region- og kategorinavn — Fraunces, høy kontrast, feltbok-ånd
        display: ['"Fraunces"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        // hud: alle tal — poeng, combo, klokke. Ledger-mono, tabulær
        hud: ['"Spline Sans Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        accent: 'var(--accent)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        gold: 'var(--gold)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-card': 'var(--surface-card)',
        border: 'var(--border)',
        ink: 'var(--text)',
        'ink-muted': 'var(--text-muted)',
        'ink-subtle': 'var(--text-subtle)',
        // handoff-tokens under sine egne navn, for nye komponenter
        primary: 'var(--color-primary)',
        land: 'var(--color-land)',
        water: 'var(--color-water)',
        grid: 'var(--color-grid)',
      },
      // egne navn, ikke overstyring av rounded-sm/md/lg: de står i bruk
      // over hele appen og skal fortsette å bety det de alltid har.
      borderRadius: {
        atlas: 'var(--radius-md)',
        'atlas-lg': 'var(--radius-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
      },
      keyframes: {
        // treffer HUD-en når combo stiger
        'combo-pop': {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
        // lys som sveiper over en flis ved hover
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)' },
        },
        // pustende glød rundt aktivt mål
        breathe: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.9' },
        },
      },
      // MERK — `stamp-press` og `flare-rise` stod også her, med nøyaktig samme
      // keyframes som i index.css. To definisjoner av samme animasjon er én for
      // mange: den ene blir endret, den andre ikke, og hvilken av dem som vinner
      // kommer an på hvilken rekkefølge lagene havner i. De bor i index.css sammen
      // med resten av kartanimasjonene; klassene heter `.stamp-press` og
      // `.flare-rise`, ikke `animate-`.
      animation: {
        'combo-pop': 'combo-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        sheen: 'sheen 0.9s ease-out',
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
