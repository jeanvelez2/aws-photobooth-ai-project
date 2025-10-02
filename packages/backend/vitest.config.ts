import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@photobooth/shared': resolve(__dirname, '../shared/src'),
      shared: resolve(__dirname, '../shared/src'),
    },
  },
});
