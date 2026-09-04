// ============================================================================
// Storage Quota Management
// ============================================================================

export interface QuotaStatus {
  usage: number;
  quota: number;
  usagePercent: number;
  available: number;
  isNearLimit: boolean;
  isCritical: boolean;
}

export interface QuotaManager {
  getStatus(): Promise<QuotaStatus>;
  checkSpace(requiredBytes: number): Promise<{ ok: boolean; status: QuotaStatus; error?: string }>;
  requestPersistence(): Promise<boolean>;
  onQuotaChange(callback: (status: QuotaStatus) => void): () => void;
}

const NEAR_LIMIT_THRESHOLD = 0.8; // 80%
const CRITICAL_THRESHOLD = 0.95; // 95%
const POLL_INTERVAL = 30_000; // 30 seconds

export function createQuotaManager(): QuotaManager {
  let callbacks: Array<(status: QuotaStatus) => void> = [];
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function getStatus(): Promise<QuotaStatus> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return {
        usage: 0,
        quota: 0,
        usagePercent: 0,
        available: 0,
        isNearLimit: false,
        isCritical: false,
      };
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const usagePercent = quota > 0 ? usage / quota : 0;

    return {
      usage,
      quota,
      usagePercent,
      available: quota - usage,
      isNearLimit: usagePercent >= NEAR_LIMIT_THRESHOLD,
      isCritical: usagePercent >= CRITICAL_THRESHOLD,
    };
  }

  async function checkSpace(requiredBytes: number): Promise<{ ok: boolean; status: QuotaStatus; error?: string }> {
    const status = await getStatus();
    if (status.available < requiredBytes) {
      return {
        ok: false,
        status,
        error: `Insufficient storage: need ${formatBytes(requiredBytes)}, have ${formatBytes(status.available)}`,
      };
    }
    return { ok: true, status };
  }

  async function requestPersistence(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) {
      return false;
    }
    return navigator.storage.persist();
  }

  function onQuotaChange(callback: (status: QuotaStatus) => void): () => void {
    callbacks.push(callback);

    // Start polling if not already started
    if (!pollTimer) {
      pollTimer = setInterval(async () => {
        const status = await getStatus();
        for (const cb of callbacks) {
          try {
            cb(status);
          } catch {
            // Ignore callback errors
          }
        }
      }, POLL_INTERVAL);
    }

    return () => {
      callbacks = callbacks.filter(cb => cb !== callback);
      if (callbacks.length === 0 && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  }

  return { getStatus, checkSpace, requestPersistence, onQuotaChange };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================================================
// Upload Size Limits (R-09)
// ============================================================================

export const UPLOAD_LIMITS = {
  IMAGE_MAX_BYTES: 25 * 1024 * 1024, // 25 MB
  IMAGE_MAX_DIMENSION: 12_000, // 12k pixels
  CSV_MAX_BYTES: 5 * 1024 * 1024, // 5 MB
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
      return { ok: false, error: `Image exceeds 25 MB limit (${formatBytes(size)})` };
    }
    if (dimensions) {
      if (dimensions.width > UPLOAD_LIMITS.IMAGE_MAX_DIMENSION || dimensions.height > UPLOAD_LIMITS.IMAGE_MAX_DIMENSION) {
        return { ok: false, error: `Image exceeds 12,000px dimension limit (${dimensions.width}x${dimensions.height})` };
      }
    }
  }
  if (type === 'csv') {
    if (size > UPLOAD_LIMITS.CSV_MAX_BYTES) {
      return { ok: false, error: `CSV exceeds 5 MB limit (${formatBytes(size)})` };
    }
  }
  return { ok: true };
}

export function validateProjectLimits(
  pageCount: number,
  objectCount: number
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (pageCount > UPLOAD_LIMITS.MAX_PAGES) {
    errors.push(`Project exceeds 100 page limit (${pageCount})`);
  }
  if (objectCount > UPLOAD_LIMITS.MAX_OBJECTS) {
    errors.push(`Project exceeds 400 object limit (${objectCount})`);
  }
  return { ok: errors.length === 0, errors };
}