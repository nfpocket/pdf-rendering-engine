import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

// Library build → publishable package in dist/ (index.js + style.css + d.ts).
// The demo app is built separately by `npm run build:demo` (vite.config.ts).
export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.lib.json',
      entryRoot: 'src',
      include: [
        'src/index.ts',
        'src/vite-env.d.ts',
        'src/core/**/*.ts',
        'src/engine-vue/**/*.ts',
        'src/engine-vue/**/*.vue',
      ],
      exclude: ['src/demo/**', 'scripts/**', 'server/**'],
      insertTypesEntry: true,
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // Vue is a peer dependency — never bundle it.
      external: ['vue'],
      // cssCodeSplit:false emits exactly one CSS asset.
      output: { assetFileNames: 'style.css' },
    },
  },
})
