import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  CHAIN_ROOT,
  computeHmac,
  generateSalt,
  timingSafeEqual,
  verifyChain,
  verifyHmac,
} from '../src/eventStore/hmac';
import {
  computeContentHash,
  decryptPackage,
  deriveKeys,
  encryptPackage,
} from '../src/keys';
import {
  createQuotaManager,
  formatBytes,
  UPLOAD_LIMITS,
  validateProjectLimits,
  validateUploadLimits,
} from '../src/quota';

// ============================================================================
// Quota Manager
// ============================================================================

interface StorageStub {
  estimate: ReturnType<typeof vi.fn>;
  persist: ReturnType<typeof vi.fn>;
}

/**
 * Replaces `navigator.storage` with a stub.
 *
 * `defineProperty` is used rather than `delete navigator.storage`, which throws
 * on a non-configurable accessor in modern engines.
 */
function stubStorage(value: StorageStub | undefined): void {
  Object.defineProperty(navigator, 'storage', {
    value,
    writable: true,
    configurable: true,
  });
}

describe('Quota Manager', () => {
  let storage: StorageStub;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = {
      estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
      persist: vi.fn().mockResolvedValue(true),
    };
    stubStorage(storage);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports unsupported when the Storage API is absent', async () => {
    stubStorage(undefined);

    const status = await createQuotaManager().getStatus();

    expect(status.supported).toBe(false);
    expect(status.usage).toBe(0);
    expect(status.quota).toBe(0);
    expect(status.usagePercent).toBe(0);
  });

  it('calculates usage percentage', async () => {
    storage.estimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });

    const status = await createQuotaManager().getStatus();

    expect(status.supported).toBe(true);
    expect(status.usagePercent).toBe(0.5);
    expect(status.available).toBe(50 * 1024 * 1024);
    expect(status.isNearLimit).toBe(false);
    expect(status.isCritical).toBe(false);
  });

  it('flags near limit at 80% and critical at 95%', async () => {
    storage.estimate.mockResolvedValue({ usage: 85, quota: 100 });
    const near = await createQuotaManager().getStatus();
    expect(near.isNearLimit).toBe(true);
    expect(near.isCritical).toBe(false);

    storage.estimate.mockResolvedValue({ usage: 96, quota: 100 });
    const critical = await createQuotaManager().getStatus();
    expect(critical.isNearLimit).toBe(true);
    expect(critical.isCritical).toBe(true);
  });

  it('never reports negative available space', async () => {
    storage.estimate.mockResolvedValue({ usage: 120, quota: 100 });
    const status = await createQuotaManager().getStatus();
    expect(status.available).toBe(0);
  });

  it('allows an operation that fits', async () => {
    storage.estimate.mockResolvedValue({ usage: 50, quota: 100 });
    const result = await createQuotaManager().checkSpace(10);
    expect(result.ok).toBe(true);
  });

  it('refuses an operation that does not fit, with actionable guidance', async () => {
    storage.estimate.mockResolvedValue({ usage: 95, quota: 100 });
    const result = await createQuotaManager().checkSpace(10);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Insufficient storage');
    expect(result.error).toContain('free space');
  });

  it('permits the operation when quota is unknowable', async () => {
    stubStorage(undefined);
    // Refusing on missing telemetry would block work for no reason; a real quota
    // error will surface from IndexedDB if space genuinely runs out.
    const result = await createQuotaManager().checkSpace(10 * 1024 * 1024);
    expect(result.ok).toBe(true);
  });

  it('requestPersistence reports support', async () => {
    await expect(createQuotaManager().requestPersistence()).resolves.toBe(true);

    stubStorage(undefined);
    await expect(createQuotaManager().requestPersistence()).resolves.toBe(false);
  });

  it('notifies a subscriber immediately, then on each poll, then stops after unsubscribe', async () => {
    storage.estimate.mockResolvedValue({ usage: 50, quota: 100 });
    const manager = createQuotaManager();
    const callback = vi.fn();

    const unsubscribe = manager.onQuotaChange(callback);

    // Immediate emission resolves on the microtask queue, before any timer fires.
    await vi.advanceTimersByTimeAsync(0);
    expect(callback).toHaveBeenCalledTimes(1);

    // One further call per 30s poll interval.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    callback.mockClear();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('isolates a throwing subscriber from the others', async () => {
    storage.estimate.mockResolvedValue({ usage: 50, quota: 100 });
    const manager = createQuotaManager();
    const healthy = vi.fn();

    manager.onQuotaChange(() => {
      throw new Error('subscriber failure');
    });
    manager.onQuotaChange(healthy);

    await vi.advanceTimersByTimeAsync(31_000);
    expect(healthy).toHaveBeenCalled();
  });
});

describe('formatBytes', () => {
  it('formats each magnitude', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
  });

  it('treats negative input as zero', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });
});

// ============================================================================
// Input Limits
// ============================================================================

describe('Upload Limits', () => {
  it('rejects an oversized image', () => {
    const result = validateUploadLimits('image', UPLOAD_LIMITS.IMAGE_MAX_BYTES + 1);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('25 MB');
  });

  it('rejects an over-large image dimension', () => {
    const result = validateUploadLimits('image', 1024, { width: 13_000, height: 8_000 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('12,000px');
  });

  it('rejects an oversized CSV', () => {
    const result = validateUploadLimits('csv', UPLOAD_LIMITS.CSV_MAX_BYTES + 1);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('5 MB');
  });

  it('accepts inputs at the boundary', () => {
    expect(validateUploadLimits('image', UPLOAD_LIMITS.IMAGE_MAX_BYTES).ok).toBe(true);
    expect(validateUploadLimits('csv', UPLOAD_LIMITS.CSV_MAX_BYTES).ok).toBe(true);
    expect(
      validateUploadLimits('image', 1024, {
        width: UPLOAD_LIMITS.IMAGE_MAX_DIMENSION,
        height: UPLOAD_LIMITS.IMAGE_MAX_DIMENSION,
      }).ok
    ).toBe(true);
  });
});

describe('Project Limits', () => {
  it('reports the page limit with the actual count', () => {
    const result = validateProjectLimits(150, 200);
    expect(result.ok).toBe(false);
    // Substring, not exact equality: messages carry actionable guidance.
    expect(result.errors.some((e) => e.includes('100 page limit') && e.includes('150'))).toBe(true);
  });

  it('reports the object limit with the actual count', () => {
    const result = validateProjectLimits(50, 500);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('400 object limit') && e.includes('500'))).toBe(
      true
    );
  });

  it('reports both limits when both are exceeded', () => {
    expect(validateProjectLimits(150, 500).errors).toHaveLength(2);
  });

  it('accepts a project inside both limits', () => {
    const result = validateProjectLimits(50, 300);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ============================================================================
// Content Hashing
// ============================================================================

describe('computeContentHash', () => {
  it('is deterministic and 256 bits wide', async () => {
    const data = new TextEncoder().encode('test data');
    const first = await computeContentHash(data);
    const second = await computeContentHash(data);

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different input', async () => {
    const a = await computeContentHash(new TextEncoder().encode('data 1'));
    const b = await computeContentHash(new TextEncoder().encode('data 2'));
    expect(a).not.toBe(b);
  });
});

// ============================================================================
// Encryption
// ============================================================================

describe('Encrypted packages', () => {
  it('round-trips content', async () => {
    const message = 'Hello, World! This is a test message.';
    const encrypted = await encryptPackage(new TextEncoder().encode(message), 'test-passphrase-123');

    expect(encrypted.version).toBe(1);
    expect(encrypted.salt).not.toBe('');
    expect(encrypted.iv).not.toBe('');

    const decrypted = await decryptPackage(encrypted, 'test-passphrase-123');
    expect(new TextDecoder().decode(decrypted)).toBe(message);
  });

  it('fails with the wrong passphrase', async () => {
    const encrypted = await encryptPackage(new TextEncoder().encode('Secret'), 'correct');
    await expect(decryptPackage(encrypted, 'wrong')).rejects.toThrow(/Decryption failed/);
  });

  it('fails on tampered ciphertext (GCM authentication)', async () => {
    const encrypted = await encryptPackage(new TextEncoder().encode('Secret'), 'passphrase');
    const tampered = { ...encrypted, ciphertext: 'dGVzdA==' };
    await expect(decryptPackage(tampered, 'passphrase')).rejects.toThrow(/Decryption failed/);
  });

  it('rejects an unknown package version', async () => {
    const encrypted = await encryptPackage(new TextEncoder().encode('Secret'), 'passphrase');
    await expect(decryptPackage({ ...encrypted, version: 99 }, 'passphrase')).rejects.toThrow(
      /Unsupported package version/
    );
  });

  it('uses a fresh salt and IV per call', async () => {
    const data = new TextEncoder().encode('Same data');
    const first = await encryptPackage(data, 'passphrase');
    const second = await encryptPackage(data, 'passphrase');

    // IV reuse under one key breaks GCM entirely, so this is a security property.
    expect(first.iv).not.toBe(second.iv);
    expect(first.salt).not.toBe(second.salt);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('handles empty and multi-byte content', async () => {
    const empty = await encryptPackage(new Uint8Array(0), 'p');
    expect((await decryptPackage(empty, 'p')).length).toBe(0);

    const unicode = 'héllo wörld 日本語 🎉';
    const encrypted = await encryptPackage(new TextEncoder().encode(unicode), 'p');
    expect(new TextDecoder().decode(await decryptPackage(encrypted, 'p'))).toBe(unicode);
  });
});

describe('deriveKeys', () => {
  it('derives a 256-bit HMAC secret and 32-byte salt', async () => {
    const keys = await deriveKeys('test-passphrase');
    expect(keys.encryptionKey.type).toBe('secret');
    expect(keys.hmacSecret).toHaveLength(64);
    expect(keys.salt).toHaveLength(32);
  });

  it('derives a non-extractable encryption key', async () => {
    const keys = await deriveKeys('test-passphrase');
    // A key that can be exported can be exfiltrated by any script on the page.
    expect(keys.encryptionKey.extractable).toBe(false);
  });

  it('differs across passphrases and matches for a shared salt', async () => {
    const salt = generateSalt();
    const a = await deriveKeys('passphrase-1', salt);
    const b = await deriveKeys('passphrase-2', salt);
    const aAgain = await deriveKeys('passphrase-1', salt);

    expect(a.hmacSecret).not.toBe(b.hmacSecret);
    expect(a.hmacSecret).toBe(aAgain.hmacSecret);
  });
});

// ============================================================================
// HMAC Chain
// ============================================================================

describe('HMAC chain', () => {
  const secret = 'session-secret';
  const event = (id: string, payload: unknown) => ({ id, type: 'Test', payload });

  it('produces a 256-bit hex digest', async () => {
    const hmac = await computeHmac(event('e1', { a: 1 }), secret);
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifies a matching event', async () => {
    const e = event('e1', { a: 1 });
    const hmac = await computeHmac(e, secret);
    await expect(verifyHmac(e, secret, hmac)).resolves.toBe(true);
  });

  it('detects a change to nested payload content', async () => {
    const original = event('e1', { nested: { value: 'original' } });
    const hmac = await computeHmac(original, secret);
    const modified = event('e1', { nested: { value: 'tampered' } });

    // Regression guard: signing with a replacer array covered only top-level
    // keys, so nested edits went undetected.
    await expect(verifyHmac(modified, secret, hmac)).resolves.toBe(false);
  });

  it('is insensitive to key order but sensitive to values', async () => {
    const a = await computeHmac({ id: 'e', type: 'T', payload: { x: 1, y: 2 } }, secret);
    const b = await computeHmac({ payload: { y: 2, x: 1 }, type: 'T', id: 'e' }, secret);
    const c = await computeHmac({ id: 'e', type: 'T', payload: { x: 1, y: 3 } }, secret);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('binds each link to its predecessor', async () => {
    const e = event('e2', { a: 1 });
    const withRoot = await computeHmac(e, secret, CHAIN_ROOT);
    const withPredecessor = await computeHmac(e, secret, 'a'.repeat(64));

    expect(withRoot).not.toBe(withPredecessor);
  });

  it('rejects a valid HMAC computed under a different secret', async () => {
    const e = event('e1', { a: 1 });
    const hmac = await computeHmac(e, 'other-secret');
    await expect(verifyHmac(e, secret, hmac)).resolves.toBe(false);
  });

  it('verifies a well-formed chain', async () => {
    const events = [event('e1', { a: 1 }), event('e2', { a: 2 }), event('e3', { a: 3 })];
    const links: { event: object; hmac: string }[] = [];

    let previous = CHAIN_ROOT;
    for (const e of events) {
      const hmac = await computeHmac(e, secret, previous);
      links.push({ event: e, hmac });
      previous = hmac;
    }

    const result = await verifyChain(links, secret);
    expect(result.valid).toBe(true);
    expect(result.firstInvalidIndex).toBeNull();
  });

  it('reports the index of the first broken link', async () => {
    const events = [event('e1', { a: 1 }), event('e2', { a: 2 }), event('e3', { a: 3 })];
    const links: { event: object; hmac: string }[] = [];

    let previous = CHAIN_ROOT;
    for (const e of events) {
      const hmac = await computeHmac(e, secret, previous);
      links.push({ event: e, hmac });
      previous = hmac;
    }

    // Alter the middle event; index 1 must be reported so recovery knows events
    // 0..0 are still trustworthy.
    links[1] = { event: event('e2', { a: 999 }), hmac: links[1]?.hmac ?? '' };

    const result = await verifyChain(links, secret);
    expect(result.valid).toBe(false);
    expect(result.firstInvalidIndex).toBe(1);
    expect(result.message).toContain('index 1');
  });

  it('detects a removed link', async () => {
    const events = [event('e1', { a: 1 }), event('e2', { a: 2 }), event('e3', { a: 3 })];
    const links: { event: object; hmac: string }[] = [];

    let previous = CHAIN_ROOT;
    for (const e of events) {
      const hmac = await computeHmac(e, secret, previous);
      links.push({ event: e, hmac });
      previous = hmac;
    }

    const truncated = [links[0], links[2]].filter((l): l is { event: object; hmac: string } =>
      Boolean(l)
    );
    const result = await verifyChain(truncated, secret);
    expect(result.valid).toBe(false);
    expect(result.firstInvalidIndex).toBe(1);
  });

  it('reports a link with no HMAC', async () => {
    const result = await verifyChain([{ event: event('e1', {}), hmac: undefined }], secret);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('no HMAC');
  });

  it('treats an empty chain as valid', async () => {
    await expect(verifyChain([], secret)).resolves.toMatchObject({ valid: true });
  });
});

describe('timingSafeEqual', () => {
  it('compares by value', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
  });

  it('returns false for differing lengths', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  it('treats empty strings as equal', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });
});
