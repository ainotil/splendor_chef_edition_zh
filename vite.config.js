import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// VITE_BASE：网页挂在哪个路径下。GitHub Pages 是 /仓库名/，本地开发是 /
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
