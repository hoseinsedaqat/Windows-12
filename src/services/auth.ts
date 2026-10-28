/**
 * Demo credential helpers.
 *
 * This is *not* real authentication: the "password" only gates entry to the
 * simulated desktop and lives in this browser. It is stored as a salted digest
 * so no plain-text secret sits in localStorage, but nothing here should be
 * treated as security.
 */

const SALT = 'win12-concept-demo';

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function hashPassword(password: string): Promise<string> {
  const value = `${SALT}:${password}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall through to the non-crypto digest */
  }
  return fnv1a(value);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return true;
  const candidate = await hashPassword(password);
  // Constant-ish time comparison; good enough for a demo gate.
  if (candidate.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

export const DEFAULT_DEMO_PASSWORD = '1234';
