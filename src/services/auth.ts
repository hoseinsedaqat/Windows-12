/**
 * Demo credential helpers.
 *
 * This is *not* real authentication: the "password" only gates entry to the
 * simulated desktop and lives in this browser. It is stored as a **salted**
 * digest (a fresh random salt per password) so no plain-text secret sits in
 * localStorage, but nothing here should be treated as security.
 *
 * Two rules keep the gate from locking people out of their own demo:
 *
 * 1. **The digest never depends on the environment.** `crypto.subtle` only
 *    exists in secure contexts, so a hash written over plain HTTP used to be
 *    an 8-character FNV digest while the same password over HTTPS produced a
 *    64-character SHA-256 — the stored credential then never verified again.
 *    SHA-256 is implemented here in plain TypeScript, byte-identical to
 *    `crypto.subtle.digest('SHA-256', …)`, so every hash verifies everywhere.
 * 2. **Typing the same password must always mean the same password.** A
 *    Persian/Arabic keyboard turns `1234` into `۱۲۳۴`, and Persian typing
 *    sprinkles zero-width non-joiners; both used to produce a *different*
 *    credential than the documented demo password. Input is normalised before
 *    hashing, and verification still accepts the raw string so credentials
 *    written by older builds keep working (they are then upgraded in place).
 */

const LEGACY_SALT = 'win12-concept-demo';

/** Canonical shape: 16 hex salt `$` 64 hex SHA-256 digest. */
export const CREDENTIAL_PATTERN = /^[0-9a-f]{16}\$[0-9a-f]{64}$/;

export const DEFAULT_DEMO_PASSWORD = '1234';

/* ------------------------------------------------------------------ *
 * Password normalisation
 * ------------------------------------------------------------------ */

/** Zero-width, bidi-control, soft-hyphen and BOM characters: invisible noise. */
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

function asciiDigits(from: number): (char: string) => string {
  return (char) => String.fromCharCode(char.charCodeAt(0) - from + 48);
}

/**
 * Maps a typed password onto one canonical string:
 * NFKC (full-width → ASCII), invisible characters removed, Arabic-Indic
 * (`٠١٢…`) and Extended Arabic-Indic/Persian (`۰۱۲…`) digits folded to ASCII
 * digits, surrounding whitespace trimmed.
 */
export function normalizePassword(input: string): string {
  return input
    .replace(INVISIBLE, '')
    .normalize('NFKC')
    .replace(/[\u0660-\u0669]/g, asciiDigits(0x0660))
    .replace(/[\u06f0-\u06f9]/g, asciiDigits(0x06f0))
    .trim();
}

/** `1234` → `1•••`: first character only, never the whole secret. */
export function demoHint(password: string): string {
  const value = normalizePassword(password);
  if (!value) return '';
  return `${value.slice(0, 1)}${'•'.repeat(Math.max(0, value.length - 1))}`;
}

/* ------------------------------------------------------------------ *
 * Digests
 * ------------------------------------------------------------------ */

/** FNV-1a, kept only to *verify* credentials written by older builds. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** Lowercase hex SHA-256 — identical output to `crypto.subtle`, in any context. */
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];
    for (let i = 0; i < 64; i += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const choose = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + S1 + choose + SHA256_K[i] + w[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (S0 + majority) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new DataView(new ArrayBuffer(32));
  for (let i = 0; i < 8; i += 1) out.setUint32(i * 4, h[i]);
  return Array.from(new Uint8Array(out.buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function randomSalt(): string {
  const bytes = new Uint8Array(8);
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall through to Math.random */
  }
  let salt = '';
  while (salt.length < 16) salt += Math.random().toString(16).slice(2);
  return salt.slice(0, 16);
}

/* ------------------------------------------------------------------ *
 * Hashing / verification
 * ------------------------------------------------------------------ */

/** Returns `salt$digest` (16 hex `$` 64 hex). */
export async function hashPassword(password: string, salt: string = randomSalt()): Promise<string> {
  return `${salt}$${sha256Hex(`${salt}:${normalizePassword(password)}`)}`;
}

/** Constant-ish time comparison; good enough for a demo gate. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface CredentialCheck {
  /** The typed password unlocks the stored credential. */
  ok: boolean;
  /**
   * Set when the password matched through a compatibility path (raw
   * pre-normalisation text, an 8-hex FNV digest from an insecure context, or a
   * salt-less legacy hash). Storing this value replaces the credential with the
   * canonical form, so the compatibility path is only ever needed once.
   */
  upgradeTo: string | null;
}

export async function checkCredential(password: string, storedHash: string): Promise<CredentialCheck> {
  // No credential yet: whatever is typed first becomes the demo password.
  if (!storedHash) return { ok: true, upgradeTo: null };

  const separator = storedHash.indexOf('$');
  const salt = separator > 0 ? storedHash.slice(0, separator) : LEGACY_SALT;
  const stored = separator > 0 ? storedHash.slice(separator + 1) : storedHash;
  const normalized = normalizePassword(password);

  // Canonical path.
  if (CREDENTIAL_PATTERN.test(storedHash) && safeEqual(sha256Hex(`${salt}:${normalized}`), stored)) {
    return { ok: true, upgradeTo: null };
  }

  // Compatibility paths: the raw typed string (hashes written before
  // normalisation existed) and the legacy digests older builds produced.
  for (const candidate of normalized === password ? [normalized] : [normalized, password]) {
    if (safeEqual(sha256Hex(`${salt}:${candidate}`), stored)) {
      return { ok: true, upgradeTo: await hashPassword(normalized) };
    }
    if (safeEqual(fnv1a(`${salt}:${candidate}`), stored)) {
      return { ok: true, upgradeTo: await hashPassword(normalized) };
    }
  }

  return { ok: false, upgradeTo: null };
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return (await checkCredential(password, storedHash)).ok;
}
