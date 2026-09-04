// ============================================================================
// Vitest Setup — apps/web
// ============================================================================
//
// Browser APIs the components touch, stubbed for happy-dom.
//
// Web Crypto is **not** stubbed: Node 20 provides a real `globalThis.crypto`, and
// the previous `vi.fn()` stubs made every crypto call resolve `undefined`, so a
// test could pass while hashing or signing silently produced nothing.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Unmount between tests, otherwise queries match leftover trees from earlier
// tests and failures appear in the wrong place.
afterEach(() => {
  cleanup();
});

Object.defineProperty(navigator, 'storage', {
  value: {
    estimate: vi.fn().mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
    persist: vi.fn().mockResolvedValue(true),
  },
  writable: true,
  configurable: true,
});

// IndexedDB is not implemented by happy-dom. Components that need real
// persistence are covered by E2E tests in a browser instead.
Object.defineProperty(window, 'indexedDB', {
  value: { open: vi.fn(), deleteDatabase: vi.fn(), databases: vi.fn().mockResolvedValue([]) },
  writable: true,
  configurable: true,
});

window.URL.createObjectURL = vi.fn(() => 'blob:mock');
window.URL.revokeObjectURL = vi.fn();

window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: () => [],
}));

// `matchMedia` backs reduced-motion and high-contrast checks.
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
