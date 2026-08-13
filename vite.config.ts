import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/atlas/',
  plugins: [react()],
  server: {
    proxy: {
      // Ledertavla er en Pages Function. Kjør den ved siden av med
      // `npx wrangler pages dev` (port 8788) for å teste skylagring lokalt;
      // svarer ingen der, faller spillet tilbake på den lokale tavla.
      '/atlas/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/atlas/, ''),
      },
    },
  },
})
