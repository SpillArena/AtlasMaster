/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // brødtekst: humanistisk sans, roleg og lesbar
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
        // display: titlar, region- og kategorinamn — Fraunces, høg kontrast, feltbok-ånd
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
        // handoff-tokens under sine eigne namn, for nye komponentar
        primary: 'var(--color-primary)',
        land: 'var(--color-land)',
        water: 'var(--color-water)',
        grid: 'var(--color-grid)',
      },
      // eigne namn, ikkje overstyring av rounded-sm/md/lg: dei står i bruk
      // over heile appen og skal halde fram med å tyde det dei alltid har.
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
        // lakkseglet blir pressa ned
        'stamp-press': {
          '0%': { transform: 'scale(2.1) rotate(-14deg)', opacity: '0' },
          '60%': { transform: 'scale(0.94) rotate(-7deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-6deg)', opacity: '1' },
        },
        // signalbluss som stig
        'flare-rise': {
          '0%': { transform: 'translateY(6px) scale(0.9)', opacity: '0' },
          '100%': { transform: 'translateY(-2px) scale(1)', opacity: '1' },
        },
      },
      animation: {
        'combo-pop': 'combo-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        sheen: 'sheen 0.9s ease-out',
        breathe: 'breathe 2.4s ease-in-out infinite',
        'stamp-press': 'stamp-press 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'flare-rise': 'flare-rise 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
