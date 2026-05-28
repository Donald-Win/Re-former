import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      // ── Strategy: injectManifest ─────────────────────────────────────────
      // We provide our own SW template (src/sw.js).
      // The plugin bundles it via Vite/Rollup and injects the full list of
      // hashed output filenames into self.__WB_MANIFEST at build time.
      // This is what fixes the offline caching bug.
      strategies: 'injectManifest',
      srcDir: 'src',       // location of our SW template
      filename: 'sw.js',   // output filename — registered as /re-former/sw.js

      // ── Registration ─────────────────────────────────────────────────────
      // main.jsx handles SW registration manually so we can control the
      // exact path (/re-former/sw.js on GitHub Pages).
      registerType: 'prompt',   // don't auto-activate; banner controls this
      injectRegister: false,    // we call navigator.serviceWorker.register() ourselves

      // ── Manifest ─────────────────────────────────────────────────────────
      // We have our own public/manifest.json — don't generate or overwrite it.
      manifest: false,

      // ── Precache glob config (passed to workbox-build InjectManifest) ────
      injectManifest: {
        // Precache everything Vite emits: hashed JS bundles, CSS, HTML,
        // icons, fonts (woff2), and the pdfjs worker (.mjs).
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2}'],

        // Exclude form PDFs — they're large (multi-MB) and would make the
        // initial SW install very slow. They're served by the NetworkFirst
        // runtime cache in sw.js instead.
        globIgnores: ['**/forms/**'],
      },

      // Disable the dev-mode SW (avoids confusing Vite's HMR during development)
      devOptions: { enabled: false },
    }),
  ],

  base: '/re-former/',
})
