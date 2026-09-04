import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQuotaManager, UPLOAD_LIMITS, validateUploadLimits, validateProjectLimits } from '../src/quota';
import { computeContentHash, deriveKeys, encryptPackage, decryptPackage } from '../src/keys';

// ============================================================================
// Mock navigator.storage
// ============================================================================

const mockStorageEstimate = vi.fn();
Object.defineProperty(navigator, 'storage', {
  value: {
    estimate: mockStorageEstimate,
    persist: vi.fn().mockResolvedValue(true),
  },
  writable: true,
});

// ============================================================================
// Quota Manager Tests
// ============================================================================

describe('Quota Manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero status when storage API unavailable', async () => {
    // @ts-ignore
    const originalStorage = navigator.storage;
    // @ts-ignore
    delete navigator.storage;

    const manager = createQuotaManager();
    const status = await manager.getStatus();

    expect(status.usage).toBe(0);
    expect(status.quota).toBe(0);
    expect(status.usagePercent).toBe(0);

    // @ts-ignore
    navigator.storage = originalStorage;
  });

  it('calculates usage percentage correctly', async () => {
    mockStorageEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });

    const manager = createQuotaManager();
    const status = await manager.getStatus();

    expect(status.usage).toBe(50 * 1024 * 1024);
    expect(status.quota).toBe(100 * 1024 * 1024);
    expect(status.usagePercent).toBe(0.5);
    expect(status.available).toBe(50 * 1024 * 1024);
    expect(status.isNearLimit).toBe(false);
    expect(status.isCritical).toBe(false);
  });

  it('detects near limit at 80%', async () => {
    mockStorageEstimate.mockResolvedValue({ usage: 85 * 1024 * 1024, quota: 100 * 1024 * 1024 });

    const manager = createQuotaManager();
    const status = await manager.getStatus();

    expect(status.isNearLimit).toBe(true);
    expect(status.isCritical).toBe(false);
  });

  it('detects critical at 95%', async () => {
    mockStorageEstimate.mockResolvedValue({ usage: 96 * 1024 * 1024, quota: 100 * 1024 * 1024 });

    const manager = createQuotaManager();
    const status = await manager.getStatus();

    expect(status.isNearLimit).toBe(true);
    expect(status.isCritical).toBe(true);
  });

  it('checkSpace returns ok when space available', async () => {
    mockStorageEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });

    const manager = createQuotaManager();
    const result = await manager.checkSpace(10 * 1024 * 1024);

    expect(result.ok).toBe(true);
    expect(result.status.usagePercent).toBe(0.5);
  });

  it('checkSpace returns error when space insufficient', async () => {
    mockStorageEstimate.mockResolvedValue({ usage: 95 * 1024 * 1024, quota: 100 * 1024 * 1024 });

    const manager = createQuotaManager();
    const result = await manager.checkSpace(10 * 1024 * 1024);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Insufficient storage');
  });

  it('requestPersistence returns true when supported', async () => {
    const manager = createQuotaManager();
    const result = await manager.requestPersistence();
    expect(result).toBe(true);
  });

  it('onQuotaChange calls callback and returns unsubscribe', async () => {
    mockStorageEstimate.mockResolvedValue({ usage: 50 * 1024 * 1024, quota: 100 * 1024 * 1024 });

    const manager = createQuotaManager();
    const callback = vi.fn();
    const unsubscribe = manager.onQuotaChange(callback);

    // Trigger immediate call
    await new Promise(r => setTimeout(r, 100));

    expect(callback).toHaveBeenCalled();
    expect(typeof unsubscribe).toBe('function');

    // Unsubscribe and verify no more calls
    unsubscribe();
    callback.mockClear();
    await new Promise(r => setTimeout(r, 100));
    expect(callback).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Upload Limits Tests
// ============================================================================

describe('Upload Limits', () => {
  it('validates image size limit', () => {
    const result = validateUploadLimits('image', 30 * 1024 * 1024);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('25 MB');
  });

  it('validates image dimension limit', () => {
    const result = validateUploadLimits('image', 10 * 1024 * 1024, { width: 13000, height: 8000 });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('12,000px');
  });

  it('validates CSV size limit', () => {
    const result = validateUploadLimits('csv', 10 * 1024 * 1024);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('5 MB');
  });

  it('accepts valid image', () => {
    const result = validateUploadLimits('image', 5 * 1024 * 1024, { width: 2000, height: 1500 });
    expect(result.ok).toBe(true);
  });

  it('accepts valid CSV', () => {
    const result = validateUploadLimits('csv', 1 * 1024 * 1024);
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// Project Limits Tests
// ============================================================================

describe('Project Limits', () => {
  it('validates page count', () => {
    const result = validateProjectLimits(150, 200);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('exceeds 100 page limit');
  });

  it('validates object count', () => {
    const result = validateProjectLimits(50, 500);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('exceeds 400 object limit');
  });

  it('accepts valid project', () => {
    const result = validateProjectLimits(50, 300);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ============================================================================
// Crypto Tests
// ============================================================================

describe('Content Hash', () => {
  it('computes consistent SHA-256 hash', async () => {
    const data = new TextEncoder().encode('test data');
    const hash1 = await computeContentHash(data);
    const hash2 = await computeContentHash(data);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 256 bits = 64 hex chars
  });

  it('produces different hashes for different data', async () => {
    const hash1 = await computeContentHash(new TextEncoder().encode('data 1'));
    const hash2 = await computeContentHash(new TextEncoder().encode('data 2'));
    expect(hash1).not.toBe(hash2);
  });
});

describe('Encryption/Decryption', () => {
  it('encrypts and decrypts package correctly', async () => {
    const data = new TextEncoder().encode('Hello, World! This is a test message.');
    const passphrase = 'test-passphrase-123';

    const encrypted = await encryptPackage(data, passphrase);
    expect(encrypted.version).toBe(1);
    expect(encrypted.salt).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.ciphertext).toBeTruthy();
    expect(encrypted.hmac).toHaveLength(64);

    const decrypted = await decryptPackage(encrypted, passphrase);
    expect(new TextDecoder().decode(decrypted)).toBe('Hello, World! This is a test message.');
  });

  it('fails decryption with wrong passphrase', async () => {
    const data = new TextEncoder().encode('Secret data');
    const encrypted = await encryptPackage(data, 'correct-passphrase');

    await expect(decryptPackage(encrypted, 'wrong-passphrase')).rejects.toThrow('HMAC verification failed');
  });

  it('fails decryption with tampered ciphertext', async () => {
    const data = new TextEncoder().encode('Secret data');
    const encrypted = await encryptPackage(data, 'passphrase');

    // Tamper with ciphertext
    const tampered = { ...encrypted, ciphertext: 'dGVzdA==' }; // 'test' in base64

    await expect(decryptPackage(tampered, 'passphrase')).rejects.toThrow('HMAC verification failed');
  });

  it('produces different ciphertext each time (random IV)', async () => {
    const data = new TextEncoder().encode('Same data');
    const passphrase = 'passphrase';

    const encrypted1 = await encryptPackage(data, passphrase);
    const encrypted2 = await encryptPackage(data, passphrase);

    expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
    expect(encrypted1.iv).not.toBe(encrypted2.iv);
    expect(encrypted1.salt).not.toBe(encrypted2.salt);
  });
});

describe('Key Derivation', () => {
  it('derives keys from passphrase', async () => {
    const keys = await deriveKeys('test-passphrase');
    expect(keys.encryptionKey).toBeTruthy();
    expect(keys.hmacSecret).toHaveLength(64);
    expect(keys.salt).toBeInstanceOf(Uint8Array);
    expect(keys.salt.length).toBe(32);
    expect(keys.iv).toBeInstanceOf(Uint8Array);
    expect(keys.iv.length).toBe(12);
  });

  it('produces different keys for different passphrases', async () => {
    const keys1 = await deriveKeys('passphrase-1');
    const keys2 = await deriveKeys('passphrase-2');
    expect(keys1.hmacSecret).not.toBe(keys2.hmacSecret);
  });

  it('produces same keys with same passphrase and salt', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const keys1 = await deriveKeys('passphrase', salt);
    const keys2 = await deriveKeys('passphrase', salt);
    expect(keys1.hmacSecret).toBe(keys2.hmacSecret);
  });
});