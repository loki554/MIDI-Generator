/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  build: {
    rollupOptions: {
      output: {
        // Framework code changes rarely: keep it in its own long-cached chunk.
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|scheduler|i18next|react-i18next|i18next-browser-languagedetector)[\\/]/.test(id)) {
            return 'vendor'
          }
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
})
