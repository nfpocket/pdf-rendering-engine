import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Demo app config. The publishable library is built by vite.config.lib.ts.
// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Keep the demo build out of dist/ (which is the published package).
  build: { outDir: 'dist-demo' },
})
