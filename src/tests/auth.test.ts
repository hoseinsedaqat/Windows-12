import { afterEach, describe, expect, it } from 'vitest';
import {
  checkCredential,
  CREDENTIAL_PATTERN,
  demoHint,
  hashPassword,
  normalizePassword,
  sha256Hex,
  verifyPassword,
} from '../services/auth';

/**
 * Regression cover for the reported lockout: typing the documented demo
 * password `1234` was rejected and there was no way back in. Three independent
 * mechanisms could produce that, all reproduced here as fixtures.
 */

const realCrypto = globalThis.crypto;

function setCrypto(value: unknown) {
  Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });
}

/** A plain-HTTP context: `crypto.getRandomValues` exists, `crypto.subtle` does not. */
function insecureContext() {
  setCrypto({ getRandomValues: (array: Uint8Array) => realCrypto.getRandomValues(array) });
}

/** FNV-1a, duplicated on purpose: the digest older builds wrote. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

afterEach(() => setCrypto(realCrypto));

describe('digest', () => {
  it('matches crypto.subtle byte for byte, so hashes verify in every context', async () => {
    const samples = ['', 'abc', 'salt:1234', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(120), 'win12-concept-demo:1234', '۱۲۳۴'];
    for (const sample of samples) {
      const subtle = toHex(await realCrypto.subtle.digest('SHA-256', new TextEncoder().encode(sample)));
      expect(sha256Hex(sample), sample).toBe(subtle);
    }
  });

  it('writes canonical salt$digest credentials', async () => {
    expect(await hashPassword('1234')).toMatch(CREDENTIAL_PATTERN);
    expect(await hashPassword('۱۲۳۴')).toMatch(CREDENTIAL_PATTERN);
  });
});

describe('the reported lockout: environment-dependent digests', () => {
  it('verifies a credential written without crypto.subtle (plain HTTP) once subtle is back', async () => {
    insecureContext();
    const insecureHash = await hashPassword('1234');
    setCrypto(realCrypto);
    expect(insecureHash).toMatch(CREDENTIAL_PATTERN);
    expect(await verifyPassword('1234', insecureHash)).toBe(true);
  });

  it('verifies an HTTPS credential from an insecure context', async () => {
    const secureHash = await hashPassword('1234');
    insecureContext();
    expect(await verifyPassword('1234', secureHash)).toBe(true);
  });

  it('unlocks the exact 8-hex FNV credential shape from the bug report and upgrades it', async () => {
    // Captured from a real locked-out profile: an FNV digest written where
    // crypto.subtle was unavailable, so no SHA-256 could ever match it.
    const stored = 'a90a110add07f4d3$3c7849d3';
    expect(fnv1a('a90a110add07f4d3:1234')).toBe('3c7849d3');
    const check = await checkCredential('1234', stored);
    expect(check.ok).toBe(true);
    expect(check.upgradeTo).toMatch(CREDENTIAL_PATTERN);
    // After the upgrade the credential is canonical and needs no compatibility path.
    const upgraded = await checkCredential('1234', check.upgradeTo!);
    expect(upgraded.ok).toBe(true);
    expect(upgraded.upgradeTo).toBeNull();
    expect(await verifyPassword('1235', check.upgradeTo!)).toBe(false);
  });

  it('unlocks a salt-less legacy hash and upgrades it', async () => {
    const legacy = sha256Hex('win12-concept-demo:1234');
    expect(legacy).not.toContain('$');
    const check = await checkCredential('1234', legacy);
    expect(check.ok).toBe(true);
    expect(check.upgradeTo).toMatch(CREDENTIAL_PATTERN);
  });

  it('unlocks a legacy FNV hash with no salt', async () => {
    expect(await verifyPassword('1234', fnv1a('win12-concept-demo:1234'))).toBe(true);
  });
});

describe('the reported lockout: keyboard variants of the same password', () => {
  it('treats Persian, Arabic, full-width digits, ZWNJ and padding as one password', async () => {
    const stored = await hashPassword('1234');
    for (const typed of ['۱۲۳۴', '١٢٣٤', '１２３４', '12\u200c34', ' 1234 ', '1234\u200e']) {
      expect(await verifyPassword(typed, stored), JSON.stringify(typed)).toBe(true);
    }
  });

  it('works the other way round: a credential adopted from Persian digits accepts 1234', async () => {
    const stored = await hashPassword('۱۲۳۴');
    expect(await verifyPassword('1234', stored)).toBe(true);
    expect(await verifyPassword('۱۲۳۴', stored)).toBe(true);
  });

  it('still verifies credentials written from raw text before normalisation existed', async () => {
    const salt = '0f1e2d3c4b5a6978';
    const stored = `${salt}$${sha256Hex(`${salt}:۱۲۳۴`)}`;
    const check = await checkCredential('۱۲۳۴', stored);
    expect(check.ok).toBe(true);
    expect(check.upgradeTo).toMatch(CREDENTIAL_PATTERN);
    // The upgraded credential answers to both keyboards.
    expect(await verifyPassword('1234', check.upgradeTo!)).toBe(true);
    expect(await verifyPassword('۱۲۳۴', check.upgradeTo!)).toBe(true);
  });

  it('normalizes and hints without leaking the secret', () => {
    expect(normalizePassword('۱۲۳۴')).toBe('1234');
    expect(normalizePassword(' 12\u200c34 ')).toBe('1234');
    expect(normalizePassword('ab\u200bcd')).toBe('abcd');
    expect(demoHint('1234')).toBe('1•••');
    expect(demoHint('۱۲۳۴')).toBe('1•••');
    expect(demoHint('')).toBe('');
  });
});

describe('the gate still gates', () => {
  it('rejects wrong passwords and accepts an empty credential on first run', async () => {
    const stored = await hashPassword('1234');
    for (const wrong of ['1235', '', 'wrong', '12345', '۱۲۳۵', '12 34']) {
      expect(await verifyPassword(wrong, stored), JSON.stringify(wrong)).toBe(false);
    }
    expect((await checkCredential('anything', stored)).upgradeTo).toBeNull();
    // No credential yet: whatever is typed first becomes the demo password.
    expect(await verifyPassword('anything', '')).toBe(true);
    expect((await checkCredential('anything', '')).upgradeTo).toBeNull();
  });

  it('does not upgrade a credential that already matched canonically', async () => {
    const stored = await hashPassword('1234');
    expect((await checkCredential('1234', stored)).upgradeTo).toBeNull();
    expect((await checkCredential('۱۲۳۴', stored)).upgradeTo).toBeNull();
  });
});
