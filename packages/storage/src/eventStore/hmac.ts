// ============================================================================
// HMAC-SHA256 for Event Chain Integrity
// ============================================================================
//
// Each persisted event carries an HMAC over its own content **and the previous
// event's HMAC**, forming a chain. Altering or removing any event invalidates
// every HMAC after it, so tampering is detectable rather than merely unlikely
// (AC F-1.2 §1, §3).
//
// The key is a per-session secret derived from a user passphrase; it never leaves
// the device and is not persisted alongside the events it protects.

const encoder = new TextEncoder();

/** Genesis link for the first event in a project's chain. */
export const CHAIN_ROOT = '0'.repeat(64);

/** PBKDF2 iteration count. OWASP 2023 guidance for PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 600_000;

const SALT_BYTES = 32;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deterministic serialisation for signing.
 *
 * Keys are sorted **recursively**. `JSON.stringify(obj, Object.keys(obj).sort())`
 * — the previous implementation — passes a replacer array, which sorts only
 * top-level keys *and silently drops any nested key not present in that array*.
 * Event payloads are nested, so most of the signed content was being omitted.
 */
function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalise).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(',')}}`;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/**
 * Computes the HMAC for one link in the chain.
 *
 * `previousHmac` binds this event to its predecessor. Any existing `hmac` field
 * on the event is excluded from the signed content, since it is the output.
 */
export async function computeHmac(
  event: object,
  secret: string,
  previousHmac: string = CHAIN_ROOT
): Promise<string> {
  const key = await importSigningKey(secret);
  const { hmac: _ignored, ...content } = event as Record<string, unknown>;
  const data = encoder.encode(`${previousHmac}\u0000${canonicalise(content)}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return toHex(signature);
}

/**
 * Verifies one link.
 *
 * Comparison is constant-time so a timing side channel cannot be used to forge a
 * signature byte by byte.
 */
export async function verifyHmac(
  event: object,
  secret: string,
  expectedHmac: string,
  previousHmac: string = CHAIN_ROOT
): Promise<boolean> {
  const computed = await computeHmac(event, secret, previousHmac);
  return timingSafeEqual(computed, expectedHmac);
}

/** Length-independent, value-constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export interface ChainLink {
  event: object;
  hmac?: string | undefined;
}

export interface ChainVerification {
  valid: boolean;
  /** Index of the first invalid link, or `null` when the chain verifies. */
  firstInvalidIndex: number | null;
  message: string | null;
}

/**
 * Verifies an entire chain in order, reporting the first break.
 *
 * The index matters operationally: events before it are trustworthy, so recovery
 * can replay up to that point and fall back to the last good snapshot after it.
 */
export async function verifyChain(links: ChainLink[], secret: string): Promise<ChainVerification> {
  let previous = CHAIN_ROOT;

  for (const [index, link] of links.entries()) {
    if (link.hmac === undefined) {
      return {
        valid: false,
        firstInvalidIndex: index,
        message: `Event at index ${index} has no HMAC`,
      };
    }

    if (!(await verifyHmac(link.event, secret, link.hmac, previous))) {
      return {
        valid: false,
        firstInvalidIndex: index,
        message: `Event chain broken at index ${index}: HMAC does not match`,
      };
    }

    previous = link.hmac;
  }

  return { valid: true, firstInvalidIndex: null, message: null };
}

/**
 * Derives a session secret from a passphrase.
 *
 * `salt` is typed `Uint8Array<ArrayBuffer>` because `BufferSource` requires a
 * non-shared buffer; a plain `Uint8Array` may be backed by a `SharedArrayBuffer`.
 */
export async function deriveSessionSecret(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
    'deriveBits',
  ]);

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );

  return toHex(derived);
}

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}
