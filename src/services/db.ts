import Dexie, { type Table } from 'dexie';
import type {
  Account,
  Category,
  FSNode,
  Invoice,
  LedgerEntry,
  Party,
  AccountingSettings,
  CalendarEvent,
} from '../types';

/** Single-row stores keyed by a constant. */
export const SINGLETON_KEY = 'current';

export interface KVRow {
  key: string;
  value: unknown;
}

export class WindowsConceptDB extends Dexie {
  files!: Table<FSNode, string>;
  parties!: Table<Party, string>;
  accounts!: Table<Account, string>;
  invoices!: Table<Invoice, string>;
  transactions!: Table<LedgerEntry, string>;
  categories!: Table<Category, string>;
  accountingSettings!: Table<AccountingSettings & { key: string }, string>;
  events!: Table<CalendarEvent, string>;
  kv!: Table<KVRow, string>;

  constructor() {
    super('windows12-concept');
    this.version(1).stores({
      files: 'id, parentId, name, kind, deleted, updatedAt',
      parties: 'id, kind, name',
      accounts: 'id, name, type',
      invoices: 'id, customerId, status, dueDate, createdAt',
      transactions: 'id, type, date, categoryId, accountId, createdAt',
      categories: 'id, type, name',
      accountingSettings: 'key',
      events: 'id, date',
      kv: 'key',
    });
  }
}

export const db = new WindowsConceptDB();

/** True once we know IndexedDB actually works in this browser context. */
let persistenceState: 'unknown' | 'available' | 'unavailable' = 'unknown';

export function persistenceStatus(): 'unknown' | 'available' | 'unavailable' {
  return persistenceState;
}

export function markPersistenceUnavailable(): void {
  persistenceState = 'unavailable';
}

export function markPersistenceAvailable(): void {
  persistenceState = 'available';
}

/** Opens the database and reports whether durable storage is usable. */
export async function initDatabase(): Promise<boolean> {
  try {
    await db.open();
    persistenceState = 'available';
    return true;
  } catch (error) {
    console.warn('[Windows 12 Concept] IndexedDB unavailable, running in memory only.', error);
    persistenceState = 'unavailable';
    return false;
  }
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  if (persistenceState === 'unavailable') return undefined;
  try {
    const row = await db.kv.get(key);
    return row?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function setKV(key: string, value: unknown): Promise<void> {
  if (persistenceState === 'unavailable') return;
  try {
    await db.kv.put({ key, value });
  } catch (error) {
    console.warn('[Windows 12 Concept] Failed to persist key', key, error);
  }
}

/** Wraps a write so quota / private-mode errors never crash the shell. */
export async function safeWrite<T>(fn: () => Promise<T>): Promise<{ ok: boolean; error?: unknown; value?: T }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    const name = (error as { name?: string })?.name ?? '';
    if (name === 'QuotaExceededError' || name === 'AbortError') {
      markPersistenceUnavailable();
    }
    console.warn('[Windows 12 Concept] Write failed', error);
    return { ok: false, error };
  }
}
