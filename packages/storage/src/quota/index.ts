// ============================================================================
// Storage Quota Management
// ============================================================================
//
// IndexedDB is subject to browser eviction and per-origin quotas. A local-first
// app must therefore tell the user how much room is left *before* an operation
// fails, and offer persistence so the browser does not evict the only copy of
// their work (AC F-1.9 §4).

export interface QuotaStatus {
  usage: number;
  quota: number;
  /** Fraction in [0, 1]. Zero when the Storage API is unavailable. */
  usagePercent: number;
  available: number;
  isNearLimit: boolean;
  isCritical: boolean;
  /** False when `navigator.storage.estimate` is unavailable; figures are then unknown, not zero. */
  supported: boolean;
}

export interface SpaceCheck {
  ok: boolean;
  status: QuotaStatus;
  error?: string;
}

export interface QuotaManager {
  getStatus(): Promise<QuotaStatus>;
  checkSpace(requiredBytes: number): Promise<SpaceCheck>;
  requestPersistence(): Promise<boolean>;
  /** Subscribes to quota changes. The callback fires immediately with current status. */
  onQuotaChange(callback: (status: QuotaStatus) => void): () => void;
}

const NEAR_LIMIT_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 0.95;
const POLL_INTERVAL_MS = 30_000;

const UNSUPPORTED_STATUS: QuotaStatus = {
  usage: 0,
  quota: 0,
  usagePercent: 0,
  available: 0,
  isNearLimit: false,
  isCritical: false,
  supported: false,
};

export function createQuotaManager(): QuotaManager {
  let callbacks: ((status: QuotaStatus) => void)[] = [];
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function getStatus(): Promise<QuotaStatus> {
    // Feature-detected per call, not cached: `navigator.storage` availability
    // differs between browsing modes and the object may be absent in tests.
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (storage?.estimate === undefined) return UNSUPPORTED_STATUS;

    const estimate = await storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const usagePercent = quota > 0 ? usage / quota : 0;

    return {
      usage,
      quota,
      usagePercent,
      available: Math.max(0, quota - usage),
      isNearLimit: usagePercent >= NEAR_LIMIT_THRESHOLD,
      isCritical: usagePercent >= CRITICAL_THRESHOLD,
      supported: true,
    };
  }

  async function checkSpace(requiredBytes: number): Promise<SpaceCheck> {
    const status = await getStatus();

    // Without the Storage API there is no basis to refuse; let the operation
    // proceed and surface a real quota error if one occurs.
    if (!status.supported) return { ok: true, status };

    if (status.available < requiredBytes) {
      return {
        ok: false,
        status,
        error: `Insufficient storage: need ${formatBytes(requiredBytes)}, have ${formatBytes(status.available)} available. Delete unused projects or assets to free space.`,
      };
    }
    return { ok: true, status };
  }

  async function requestPersistence(): Promise<boolean> {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (storage?.persist === undefined) return false;
    return storage.persist();
  }

  /** Invokes one subscriber, containing any failure it throws. */
  function notify(callback: (status: QuotaStatus) => void, status: QuotaStatus): void {
    try {
      callback(status);
    } catch {
      // One subscriber's failure must not stop the others from being notified,
      // nor surface as an unhandled rejection from the polling timer.
    }
  }

  function notifyAll(status: QuotaStatus): void {
    for (const cb of callbacks) {
      notify(cb, status);
    }
  }

  function onQuotaChange(callback: (status: QuotaStatus) => void): () => void {
    callbacks.push(callback);

    // Emit current status immediately: a subscriber that has to wait a full poll
    // interval for its first value cannot render an accurate initial state.
    void getStatus().then((status) => {
      if (callbacks.includes(callback)) notify(callback, status);
    });

    pollTimer ??= setInterval(() => {
      void getStatus().then(notifyAll);
    }, POLL_INTERVAL_MS);

    return () => {
      callbacks = callbacks.filter((cb) => cb !== callback);
      if (callbacks.length === 0 && pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }

  return { getStatus, checkSpace, requestPersistence, onQuotaChange };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${Number.parseFloat(value.toFixed(2))} ${units[exponent] ?? 'B'}`;
}

// ============================================================================
// Input Limits (R-09)
// ============================================================================
//
// Caps bound memory and parse time for adversarial input, and keep a project
// within a size the export pipeline can render in the browser.

export const UPLOAD_LIMITS = {
  IMAGE_MAX_BYTES: 25 * 1024 * 1024,
  /** Pixels per side. A 12k × 12k RGBA bitmap is already ~576 MB decoded. */
  IMAGE_MAX_DIMENSION: 12_000,
  CSV_MAX_BYTES: 5 * 1024 * 1024,
  MAX_PAGES: 100,
  MAX_OBJECTS: 400,
  MAX_SVG_ELEMENTS: 10_000,
} as const;

export function validateUploadLimits(
  type: 'image' | 'csv',
  size: number,
  dimensions?: { width: number; height: number }
): { ok: boolean; error?: string } {
  if (type === 'image') {
    if (size > UPLOAD_LIMITS.IMAGE_MAX_BYTES) {
      return {
        ok: false,
        error: `Image exceeds the 25 MB limit (${formatBytes(size)}). Reduce its resolution or export it at a lower quality.`,
      };
    }
    if (
      dimensions !== undefined &&
      (dimensions.width > UPLOAD_LIMITS.IMAGE_MAX_DIMENSION ||
        dimensions.height > UPLOAD_LIMITS.IMAGE_MAX_DIMENSION)
    ) {
      return {
        ok: false,
        error: `Image exceeds the 12,000px dimension limit (${dimensions.width}×${dimensions.height}). Resize it before uploading.`,
      };
    }
    return { ok: true };
  }

  if (size > UPLOAD_LIMITS.CSV_MAX_BYTES) {
    return {
      ok: false,
      error: `CSV exceeds the 5 MB limit (${formatBytes(size)}). Split the file or remove unused columns.`,
    };
  }
  return { ok: true };
}

export function validateProjectLimits(
  pageCount: number,
  objectCount: number
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (pageCount > UPLOAD_LIMITS.MAX_PAGES) {
    errors.push(
      `Project exceeds the ${UPLOAD_LIMITS.MAX_PAGES} page limit (${pageCount} pages). Split it into separate documents.`
    );
  }
  if (objectCount > UPLOAD_LIMITS.MAX_OBJECTS) {
    errors.push(
      `Project exceeds the ${UPLOAD_LIMITS.MAX_OBJECTS} object limit (${objectCount} objects). Remove unused objects or split the document.`
    );
  }

  return { ok: errors.length === 0, errors };
}
