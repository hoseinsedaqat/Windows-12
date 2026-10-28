/**
 * Demo credential helpers.
 *
 * This is *not* real authentication: the "password" only gates entry to the
 * simulated desktop and lives in this browser. It is stored as a **salted**
 * digest (a fresh random salt per password) so no plain-text secret sits in
 * localStorage, but nothing here should be treated as security.
 */

const LEGACY_SALT = 'win12-concept-demo';

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function randomSalt(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

async function digest(value: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(value);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall through to the non-crypto digest */
  }
  return fnv1a(value);
}

/** Returns `salt$digest`. */
export async function hashPassword(password: string, salt: string = randomSalt()): Promise<string> {
  return `${salt}$${await digest(`${salt}:${password}`)}`;
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

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return true;
  const separator = storedHash.indexOf('$');
  if (separator > 0) {
    const salt = storedHash.slice(0, separator);
    return safeEqual(await hashPassword(password, salt), storedHash);
  }
  // Legacy hash written before per-password salts existed.
  return safeEqual(await digest(`${LEGACY_SALT}:${password}`), storedHash);
}

export const DEFAULT_DEMO_PASSWORD = '1234';
