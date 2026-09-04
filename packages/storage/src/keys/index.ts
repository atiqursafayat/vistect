// ============================================================================
// Web Crypto Key Management
// ============================================================================

import { generateSalt, deriveSessionSecret } from '../eventStore/hmac';

// ============================================================================
// Key Derivation
// ============================================================================

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 256; // bits
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96 bits for GCM

export interface EncryptionKeys {
  encryptionKey: CryptoKey;
  hmacSecret: string;
  salt: Uint8Array;
  iv: Uint8Array;
}

export interface EncryptedPackage {
  version: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  hmac: string; // hex
}

export async function deriveKeys(passphrase: string, salt?: Uint8Array): Promise<EncryptionKeys> {
  const usedSalt = salt || crypto.getRandomValues(new Uint8Array(32));
  const hmacSecret = await deriveSessionSecret(passphrase, usedSalt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hmacSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: usedSalt,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  return { encryptionKey, hmacSecret, salt: usedSalt, iv };
}

export async function encryptPackage(
  data: Uint8Array,
  passphrase: string
): Promise<EncryptedPackage> {
  const { encryptionKey, hmacSecret, salt, iv } = await deriveKeys(passphrase);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    encryptionKey,
    data
  );

  // Compute HMAC of ciphertext
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hmacSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const hmac = await crypto.subtle.sign('HMAC', hmacKey, ciphertext);

  return {
    version: 1,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    hmac: Array.from(new Uint8Array(hmac)).map(b => b.toString(16).padStart(2, '0')).join(''),
  };
}

export async function decryptPackage(
  pkg: EncryptedPackage,
  passphrase: string
): Promise<Uint8Array> {
  const salt = Uint8Array.from(atob(pkg.salt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(pkg.iv), c => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(pkg.ciphertext), c => c.charCodeAt(0));

  const { encryptionKey, hmacSecret } = await deriveKeys(passphrase, salt);

  // Verify HMAC
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hmacSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const hmacBytes = Uint8Array.from(pkg.hmac.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const valid = await crypto.subtle.verify('HMAC', hmacKey, hmacBytes, ciphertext);
  if (!valid) {
    throw new Error('HMAC verification failed: package may be corrupted or tampered');
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    encryptionKey,
    ciphertext
  );

  return new Uint8Array(plaintext);
}

// ============================================================================
// Content Addressing
// ============================================================================

export async function computeContentHash(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeProjectHash(project: object): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(project, Object.keys(project).sort()));
  return computeContentHash(data);
}

// ============================================================================
// Key Export/Import (for backup)
// ============================================================================

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importKey(rawBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}