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

  build: {
    // ── Target ───────────────────────────────────────────────────────────────
    // 'es2020' is safe for field devices running Chrome/Safari (2020+) and
    // unlocks modern JS syntax in the output (optional chaining, nullish
    // coalescing etc.) while keeping full browser compatibility.
    target: 'es2020',

    // ── Chunk size warning threshold ─────────────────────────────────────────
    // pdf-lib and pdfjs-dist are unavoidably large — raise the limit so the
    // build doesn't emit noisy warnings for chunks we've already split.
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        // ── Manual chunk splitting ────────────────────────────────────────────
        // Splitting by domain means each chunk has a long-lived cache entry.
        // The app shell (React, lucide) is rebuilt rarely; PDF libs only change
        // when we upgrade their version — so users get cache hits for most builds.
        manualChunks: {
          // React core — changes only when we upgrade React itself
          'vendor-react':   ['react', 'react-dom'],

          // pdf-lib — used only inside wizard generators, never on the list screen
          'vendor-pdf-lib': ['pdf-lib'],

          // pdfjs-dist — used only for PdfCanvasPreview. The worker is emitted
          // separately via the ?url import, so this chunk just covers the main lib.
          'vendor-pdfjs':   ['pdfjs-dist'],

          // IndexedDB wrapper — tiny but shared by every wizard via draftStore /
          // projectStore; isolating it keeps the idb update footprint minimal
          'vendor-idb':     ['idb-keyval'],

          // Icon set — tree-shaken by Rollup but still worth isolating since
          // lucide-react updates frequently and we import from it in many files
          'vendor-lucide':  ['lucide-react'],
        },
      },
    },
  },
})
