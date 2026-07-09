/**
 * vite.config.js — single config for all deployment targets.
 *
 * Base path
 * ─────────
 * Controlled by the BASE_PATH environment variable at build time:
 *
 *   GitHub Pages (default):  base = '/re-former/'   (no env var needed)
 *   Netlify:                 BASE_PATH=/ npm run build
 *
 * The netlify.toml build command sets BASE_PATH=/ so the Netlify build
 * gets base: '/' while local dev and GitHub Pages CI continue to use the
 * '/re-former/' default.  vite.config.netlify.js is no longer needed and
 * can be deleted.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.BASE_PATH ?? '/re-former/'

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
      filename: 'sw.js',   // output filename — registered as <base>sw.js

      // ── Registration ─────────────────────────────────────────────────────
      // main.jsx handles SW registration manually.
      registerType: 'prompt',
      injectRegister: false,

      // ── Manifest ─────────────────────────────────────────────────────────
      // We have our own public/manifest.json — don't generate or overwrite it.
      manifest: false,

      // ── Precache glob config ──────────────────────────────────────────────
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2}'],
        // Form PDFs are served by the NetworkFirst runtime cache in sw.js.
        globIgnores: ['**/forms/**'],
      },

      devOptions: { enabled: false },
    }),
  ],

  base,

  // ── Web Worker output format ────────────────────────────────────────────
  // pdfGen.worker.js (see src/workers/pdfGen.worker.js) uses dynamic
  // import() per PDF generator so each generator stays its own lazy-loaded
  // chunk instead of being bundled entirely into the worker file. Rollup
  // can only code-split when the worker's OWN output format supports it —
  // Vite's default worker format is 'iife', which does NOT support
  // code-splitting and fails the production build with:
  //   "Invalid value 'iife' for option 'worker.format' - UMD and IIFE
  //   output formats are not supported for code-splitting builds."
  // This only surfaces in `vite build` (dev serves workers as native ES
  // modules regardless of this setting, so `npm run dev` never catches it).
  // Setting format: 'es' tells Rollup to emit the worker itself as an ES
  // module, which allows it to code-split its dynamic imports normally.
  // Requires ES module Worker support, which all supported browsers for
  // this app (recent iOS/Android/desktop) have.
  worker: {
    format: 'es',
  },

  build: {
    // ── Target ───────────────────────────────────────────────────────────────
    target: 'es2020',

    // ── Chunk size warning threshold ─────────────────────────────────────────
    // pdf-lib and pdfjs-dist are unavoidably large.
    chunkSizeWarningLimit: 1500,

    rollupOptions: {
      output: {
        // ── Manual chunk splitting ────────────────────────────────────────────
        manualChunks: {
          'vendor-react':   ['react', 'react-dom'],
          'vendor-pdf-lib': ['pdf-lib'],
          'vendor-pdfjs':   ['pdfjs-dist'],
          'vendor-idb':     ['idb-keyval'],
          'vendor-lucide':  ['lucide-react'],
        },
      },
    },
  },
})