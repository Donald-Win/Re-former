import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // Same configuration as vite.config.js — the only difference is base: '/'.
      // On Netlify the SW is served from /sw.js instead of /re-former/sw.js.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      registerType: 'prompt',
      injectRegister: false,
      manifest: false,

      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/forms/**'],
      },

      devOptions: { enabled: false },
    }),
  ],

  base: '/',
})
