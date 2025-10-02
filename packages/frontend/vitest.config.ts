/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Handle browser APIs and globals
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Mock browser APIs that cause issues
    server: {
      deps: {
        inline: ['webidl-conversions', 'whatwg-url'],
        external: ['webidl-conversions', 'whatwg-url'],
      },
    },
    // Exclude problematic dependencies
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    // Increase timeout for slower CI environments
    testTimeout: 10000,
    hookTimeout: 10000,
    // Handle unhandled promise rejections
    onConsoleLog: () => false,
    // Suppress noisy logs during tests
    silent: false,
    reporter: ['verbose'],
  },
  // Resolve issues with ESM modules
  resolve: {
    conditions: ['development', 'browser'],
  },
  define: {
    // Define globals that might be missing
    global: 'globalThis',
  },
})