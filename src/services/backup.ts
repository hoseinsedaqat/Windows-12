/**
 * Full backup / restore of the simulated Windows session as a single
 * `.win12` file (a real ZIP container written from scratch — uncompressed
 * "stored" entries, so the format is honest and inspectable with any unzip
 * tool). The payload contains every Dexie table plus all localStorage keys,
 * so a restore reproduces files, accounts, settings and windows exactly.
 */
import { db } from './db';

export interface BackupPayload {
  format: 'win12-backup';
  version: 1;
  exportedAt: number;
  app: string;
  dexie: Record<string, unknown[]>;
  localStorage: Record<string, string>;
}

/* ------------------------------------------------------------------ CRC32 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------- ZIP */
export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function dosDateTime(date: Date): { time: number; day: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

/** Builds an uncompressed (method 0) ZIP archive. */
export function buildZip(entries: ZipEntry[], now = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(now);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + nameBytes.length + entry.data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, entry.data.length, true);
    lv.setUint32(22, entry.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(entry.data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, entry.data.length, true);
    cv.setUint32(24, entry.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

/** Reads an uncompressed ZIP archive; throws on foreign/compressed archives. */
export function parseZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Locate the end-of-central-directory record (scan backwards).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file (EOCD signature missing).');
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Corrupt central directory.');
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (method !== 0) throw new Error(`Compressed entry "${name}" is not supported; only stored (uncompressed) archives can be restored.`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({ name, data: bytes.slice(start, start + size) });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/* --------------------------------------------------------- collect/apply */
const TABLE_NAMES = ['files', 'parties', 'accounts', 'invoices', 'transactions', 'categories', 'accountingSettings', 'events', 'kv'] as const;

export async function collectBackup(): Promise<BackupPayload> {
  const dexie: Record<string, unknown[]> = {};
  for (const table of TABLE_NAMES) {
    dexie[table] = await db.table(table).toArray();
  }
  const local: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key) local[key] = window.localStorage.getItem(key) ?? '';
  }
  return {
    format: 'win12-backup',
    version: 1,
    exportedAt: Date.now(),
    app: 'Windows 12 Concept (web simulator)',
    dexie,
    localStorage: local,
  };
}

export function encodeBackup(payload: BackupPayload): Uint8Array {
  const encoder = new TextEncoder();
  const readme = [
    'Windows 12 Concept — full session backup (.win12)',
    '',
    'This ZIP contains backup.json with every Dexie table (virtual file',
    'system, accounting, calendar, KV records) and all localStorage keys',
    '(persisted stores: settings, windows, notifications, browser, system).',
    '',
    'Restore it from Settings → System → Backup & restore → Import.',
    'The file never leaves your machine unless you share it yourself.',
  ].join('\n');
  return buildZip([
    { name: 'backup.json', data: encoder.encode(JSON.stringify(payload)) },
    { name: 'README.txt', data: encoder.encode(readme) },
  ]);
}

export function decodeBackup(bytes: Uint8Array): BackupPayload {
  const entries = parseZip(bytes);
  const json = entries.find((entry) => entry.name === 'backup.json');
  if (!json) throw new Error('backup.json is missing — not a .win12 backup.');
  const payload = JSON.parse(new TextDecoder().decode(json.data)) as BackupPayload;
  if (payload?.format !== 'win12-backup' || payload.version !== 1) {
    throw new Error('Unsupported backup format or version.');
  }
  return payload;
}

export async function applyBackup(payload: BackupPayload): Promise<void> {
  for (const table of TABLE_NAMES) {
    const rows = payload.dexie[table];
    if (!Array.isArray(rows)) continue;
    await db.table(table).clear();
    if (rows.length > 0) await db.table(table).bulkPut(rows as never[]);
  }
  for (const [key, value] of Object.entries(payload.localStorage)) {
    window.localStorage.setItem(key, value);
  }
}

/** Triggers a browser download of the full backup. */
export async function downloadBackup(): Promise<string> {
  const payload = await collectBackup();
  const bytes = encodeBackup(payload);
  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 16).replace(/[:T]/g, '');
  const filename = `windows12-backup-${stamp}.win12`;
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}
