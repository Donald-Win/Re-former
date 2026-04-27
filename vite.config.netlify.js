import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  resolve: {
    alias: {
      // Swap in Netlify-specific entry point (corrects SW path from /re-former/sw.js to /sw.js)
      './main.jsx': path.resolve('./src/main.netlify.jsx'),
      '../main.jsx': path.resolve('./src/main.netlify.jsx'),
    },
  },
})