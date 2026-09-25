import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves at https://ayush-207.github.io/wordgeo/
  base: process.env.VITE_BASE || '/wordgeo/',
})
