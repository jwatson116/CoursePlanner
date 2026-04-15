import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: 'base: "./"' ensures assets are linked relatively (e.g., "./assets/script.js")
  // instead of absolutely ("/assets/script.js"). 
  // This allows the app to run correctly at https://www.cs.ox.ac.uk/people/jennifer.watson/calendar.html
  base: './', 
})