/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
  test: {
    // The pure core is the exhaustively-tested surface (implementation-plan.md §9).
    // No jsdom: nothing under test touches the DOM. The browser boundary is
    // covered end-to-end by Playwright instead.
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
