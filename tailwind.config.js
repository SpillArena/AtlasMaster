/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // én font for hele appen (samme som "Ferdig"-skjermen brukte)
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // display: titler, poengsum og store tall — gir appen egen identitet
        display: ['"Sora"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
      },
    },
  },
  plugins: [],
}

