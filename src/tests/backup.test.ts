import { describe, expect, it } from 'vitest';
import { buildZip, crc32, decodeBackup, encodeBackup, parseZip, type BackupPayload } from '../services/backup';

const encoder = new TextEncoder();

describe('zip writer', () => {
  it('computes the canonical CRC32', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips multiple entries through buildZip/parseZip', () => {
    const entries = [
      { name: 'a.txt', data: encoder.encode('hello world') },
      { name: 'nested/b.bin', data: new Uint8Array([0, 1, 2, 250, 255]) },
      { name: 'empty.txt', data: new Uint8Array(0) },
    ];
    const zip = buildZip(entries, new Date(2026, 0, 2, 3, 4, 5));
    const parsed = parseZip(zip);
    expect(parsed.map((entry) => entry.name)).toEqual(['a.txt', 'nested/b.bin', 'empty.txt']);
    expect(new TextDecoder().decode(parsed[0].data)).toBe('hello world');
    expect(Array.from(parsed[1].data)).toEqual([0, 1, 2, 250, 255]);
  });

  it('rejects data that is not a zip', () => {
    expect(() => parseZip(encoder.encode('this is not a zip file at all'))).toThrow();
  });
});

describe('win12 backup payload', () => {
  const payload: BackupPayload = {
    format: 'win12-backup',
    version: 1,
    exportedAt: 1730000000000,
    app: 'Windows 12 Concept (web simulator)',
    dexie: { files: [{ id: 'f1', name: 'note.txt' }], kv: [{ key: 'a', value: 1 }] },
    localStorage: { 'win12-settings': '{"locale":"fa"}' },
  };

  it('encodes and decodes a payload losslessly', () => {
    const decoded = decodeBackup(encodeBackup(payload));
    expect(decoded).toEqual(payload);
  });

  it('rejects foreign payloads', () => {
    const zip = buildZip([{ name: 'backup.json', data: encoder.encode(JSON.stringify({ hello: 'world' })) }]);
    expect(() => decodeBackup(zip)).toThrow();
    const noJson = buildZip([{ name: 'other.txt', data: encoder.encode('x') }]);
    expect(() => decodeBackup(noJson)).toThrow();
  });
});
