// ============================================================================
// Web Crypto Key Management
// ============================================================================
//
// Encrypted project packages (spec §22) let a user hand a project to someone else
// without exposing content. AES-256-GCM provides confidentiality **and**
// authentication in one pass, so a tampered package fails to decrypt rather than
// yielding altered plaintext.
//
// All key material is derived on demand from the passphrase and never persisted.
// `CryptoKey` objects are created non-extractable so a key cannot be read back
// out of the browser once derived.

import { deriveSessionSecret } from '../eventStore/hmac';

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH_BITS = 256;
const ALGORITHM = 'AES-GCM';

/** 96-bit IV, the size GCM is specified for. */
const IV_LENGTH = 12;
const SALT_LENGTH = 32;

/** Package format version, so a future format change stays decryptable. */
const PACKAGE_VERSION = 1;

export interface EncryptionKeys {
  encryptionKey: CryptoKey;
  hmacSecret: string;
  salt: Uint8Array<ArrayBuffer>;
}

export interface EncryptedPackage {
  version: number;
  /** Base64. */
  salt: string;
  /** Base64. */
  iv: string;
  /** Base64. */
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  // Chunked to stay clear of the argument-count limit on `String.fromCharCode`,
  // which a spread of a multi-megabyte project would exceed.
  const CHUNK = 0x8000;
  let result = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    result += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(result);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derives an AES key and an HMAC secret from a passphrase.
 *
 * Pass `salt` to reproduce keys for decryption; omit it to generate a fresh salt
 * for encryption.
 */
export async function deriveKeys(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer> = randomBytes(SALT_LENGTH)
): Promise<EncryptionKeys> {
  const hmacSecret = await deriveSessionSecret(passphrase, salt);

  // The AES key is derived from the passphrase directly, not from `hmacSecret`.
  // Deriving both from one intermediate would make the HMAC secret a
  // password-equivalent for the encryption key.
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );

  return { encryptionKey, hmacSecret, salt };
}

/**
 * Encrypts data into a self-describing package.
 *
 * A fresh IV is generated per call: reusing an IV with the same key destroys
 * GCM's security guarantees entirely. The IV that encrypted the data is the one
 * stored, which the previous implementation did not guarantee — it took the IV
 * from `deriveKeys` and could not bind it to this particular ciphertext.
 *
 * No separate HMAC is emitted: GCM already authenticates, and an
 * encrypt-then-MAC layer keyed off the same passphrase adds no security while
 * adding a second failure mode.
 */
export async function encryptPackage(
  data: Uint8Array<ArrayBuffer>,
  passphrase: string
): Promise<EncryptedPackage> {
  const { encryptionKey, salt } = await deriveKeys(passphrase);
  const iv = randomBytes(IV_LENGTH);

  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, encryptionKey, data);

  return {
    version: PACKAGE_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypts a package, throwing when the passphrase is wrong or the ciphertext
 * has been altered — GCM's tag check covers both cases indistinguishably, which
 * is the desired behaviour (no oracle for which one failed).
 */
export async function decryptPackage(
  pkg: EncryptedPackage,
  passphrase: string
): Promise<Uint8Array<ArrayBuffer>> {
  if (pkg.version !== PACKAGE_VERSION) {
    throw new Error(`Unsupported package version ${pkg.version}; expected ${PACKAGE_VERSION}`);
  }

  const salt = fromBase64(pkg.salt);
  const iv = fromBase64(pkg.iv);
  const ciphertext = fromBase64(pkg.ciphertext);

  const { encryptionKey } = await deriveKeys(passphrase, salt);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      encryptionKey,
      ciphertext
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error(
      'Decryption failed: the passphrase is incorrect or the package has been modified'
    );
  }
}

// ============================================================================
// Content Addressing
// ============================================================================

/** SHA-256 of raw bytes, as lowercase hex. Used for asset deduplication. */
export async function computeContentHash(data: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Key Export / Import
// ============================================================================
//
// Derived keys are non-extractable, so these apply only to keys created
// explicitly for backup. `exportKey` throws on a non-extractable key.

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64(new Uint8Array(raw));
}

export async function importKey(rawBase64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    fromBase64(rawBase64),
    { name: ALGORITHM, length: KEY_LENGTH_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}
