import { defineConfig } from 'vitest/config';

/**
 * The gate's browser confirmation handler dispatches `CustomEvent` on `window`,
 * and the capability probe reads `navigator`, so these tests need a DOM-like
 * environment.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
