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
    // Enhanced environment options for jsdom
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        url: 'http://localhost:3000',
      },
    },
    // Optimize module resolution for problematic dependencies
    server: {
      deps: {
        // Inline problematic ESM modules to avoid resolution issues
        inline: [
          'webidl-conversions',
          'whatwg-url',
          '@testing-library/jest-dom',
          '@testing-library/react',
          '@testing-library/user-event'
        ],
        // External modules that should not be bundled
        external: [
          'react',
          'react-dom',
          'vitest',
          'jsdom'
        ],
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
    alias: {
      '@photobooth/shared': new URL('../shared/src/index.ts', import.meta.url).pathname,
    },
  },
  define: {
    // Define globals that might be missing
    global: 'globalThis',
    'process.env.NODE_ENV': '"test"',
  },
})