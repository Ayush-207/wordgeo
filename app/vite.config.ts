import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves at https://ayush-207.github.io/wordgeo/
  base: process.env.VITE_BASE || '/wordgeo/',
  test: {
    // e2e/play.test.js is a manual script (needs a preview server + a
    // downloaded browser); keep it out of vitest's unit-test discovery.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
})
