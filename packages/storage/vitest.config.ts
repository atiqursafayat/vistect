import { defineConfig } from 'vitest/config';

/**
 * Storage tests exercise `navigator.storage` and `crypto.subtle`, so they need a
 * DOM-like environment. `happy-dom` provides `navigator`; Web Crypto comes from
 * Node's global `crypto` (Node 20+), which is why `globals` stays enabled and no
 * crypto polyfill is required.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
