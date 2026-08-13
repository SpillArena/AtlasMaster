import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Må vere same segment som ruta i `spillarena-router`. Routeren strippar
  // `/atlasmaster` før han proxyar vidare til atlasmaster.pages.dev, så basen
  // her er det som gjer at HTML-en ber om `/atlasmaster/assets/…` og treffer
  // rett. Endrar du ein av dei to, må den andre følgje etter.
  base: '/atlasmaster/',
  plugins: [react()],
  server: {
    proxy: {
      // Ledertavla er en Pages Function. Kjør den ved siden av med
      // `npx wrangler pages dev` (port 8788) for å teste skylagring lokalt;
      // svarer ingen der, faller spillet tilbake på den lokale tavla.
      '/atlasmaster/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/atlasmaster/, ''),
      },
    },
  },
})
