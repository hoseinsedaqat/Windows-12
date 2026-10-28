import { beforeEach, describe, expect, it } from 'vitest';
import { db, getKV, initDatabase, persistenceStatus, safeWrite, setKV } from '../services/db';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import { DESKTOP_ID, DOCUMENTS_ID, getNode, ROOT_ID, totalUsedBytes } from '../core/FileSystem';
import { estimateSize } from '../core/FileSystem';

function store() {
  return useFileSystemStore.getState();
}

beforeEach(async () => {
  localStorage.clear();
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  await db.files.clear();
  await db.kv.clear();
  useFileSystemStore.setState({ nodes: {}, hydrated: false, clipboard: null, recentIds: [], usedBytes: 0 });
  await store().hydrate();
});

describe('IndexedDB persistence layer', () => {
  it('initialises the database and reports availability', async () => {
    const available = await initDatabase();
    expect(available).toBe(true);
    expect(persistenceStatus()).toBe('available');
  });

  it('stores and reads key/value rows of every shape', async () => {
    await setKV('test.string', 'hello');
    await setKV('test.number', 42);
    await setKV('test.object', { a: 1, nested: { list: [1, 2, 3] } });
    await setKV('test.array', ['x', 'y']);

    expect(await getKV<string>('test.string')).toBe('hello');
    expect(await getKV<number>('test.number')).toBe(42);
    expect(await getKV<{ a: number; nested: { list: number[] } }>('test.object')).toEqual({ a: 1, nested: { list: [1, 2, 3] } });
    expect(await getKV<string[]>('test.array')).toEqual(['x', 'y']);
    expect(await getKV('test.missing')).toBeUndefined();

    // Overwriting replaces the previous value.
    await setKV('test.string', 'world');
    expect(await getKV<string>('test.string')).toBe('world');
  });

  it('reports success and failure from safeWrite without throwing', async () => {
    const ok = await safeWrite(async () => {
      await setKV('safe.ok', true);
      return 'value';
    });
    expect(ok).toEqual({ ok: true, value: 'value' });
    expect(await getKV<boolean>('safe.ok')).toBe(true);

    const failed = await safeWrite(async () => {
      throw new Error('quota exceeded');
    });
    expect(failed.ok).toBe(false);
    expect(failed.error).toBeInstanceOf(Error);
    expect(failed.value).toBeUndefined();
  });
});

describe('file system store persistence', () => {
  it('seeds the virtual file system on first run and writes it to IndexedDB', async () => {
    expect(store().hydrated).toBe(true);
    expect(store().storageAvailable).toBe(true);
    expect(getNode(store().nodes, ROOT_ID)).toBeTruthy();
    expect(getNode(store().nodes, DESKTOP_ID)).toBeTruthy();
    expect(getNode(store().nodes, DOCUMENTS_ID)).toBeTruthy();

    const rows = await db.files.toArray();
    expect(rows.length).toBe(Object.keys(store().nodes).length);
    expect(await getKV<boolean>('fs.seeded.v1')).toBe(true);
  });

  it('creates folders and files, then recovers them after a simulated reload', async () => {
    const folderId = store().createFolder(DESKTOP_ID, 'Reports');
    const fileId = store().createFile('text', folderId, 'summary.txt', 'First draft');

    expect(store().nodeById(folderId)?.name).toBe('Reports');
    expect(store().nodeById(fileId)?.parentId).toBe(folderId);
    expect(store().nodeById(fileId)?.content).toBe('First draft');
    expect(store().childrenOf(folderId).map((node) => node.id)).toEqual([fileId]);

    const rows = await db.files.toArray();
    expect(rows.some((row) => row.id === fileId)).toBe(true);

    // Simulate a page reload: wipe memory, hydrate again from IndexedDB.
    useFileSystemStore.setState({ nodes: {}, hydrated: false, usedBytes: 0 });
    await store().hydrate();

    const restoredFile = store().nodeById(fileId);
    expect(restoredFile?.name).toBe('summary.txt');
    expect(restoredFile?.content).toBe('First draft');
    expect(store().nodeById(folderId)?.parentId).toBe(DESKTOP_ID);
  });

  it('updates content, renames and keeps names unique per folder', async () => {
    const first = store().createFile('text', DOCUMENTS_ID, 'notes.txt', 'a');
    const second = store().createFile('text', DOCUMENTS_ID, 'notes.txt', 'b');
    expect(store().nodeById(second)?.name).not.toBe('notes.txt');

    store().updateContent(first, 'a much longer body');
    expect(store().nodeById(first)?.content).toBe('a much longer body');
    expect(store().nodeById(first)?.size).toBe(estimateSize('a much longer body'));

    expect(store().rename(first, 'renamed.txt')).toBe(true);
    expect(store().nodeById(first)?.name).toBe('renamed.txt');
    // Renaming onto an existing sibling name is refused.
    expect(store().rename(first, store().nodeById(second)!.name)).toBe(false);
    expect(store().nodeById(first)?.name).toBe('renamed.txt');
  });

  it('moves to the Recycle Bin, restores and purges — persisted each step', async () => {
    const fileId = store().createFile('text', DESKTOP_ID, 'doomed.txt', 'bye');
    store().softDelete([fileId]);

    expect(store().nodeById(fileId)?.deleted).toBe(true);
    expect(store().childrenOf(DESKTOP_ID).some((node) => node.id === fileId)).toBe(false);
    expect((await db.files.get(fileId))?.deleted).toBe(true);

    store().restore([fileId]);
    expect(store().nodeById(fileId)?.deleted).toBe(false);
    expect(store().childrenOf(DESKTOP_ID).some((node) => node.id === fileId)).toBe(true);

    store().softDelete([fileId]);
    store().purge([fileId]);
    expect(store().nodeById(fileId)).toBeUndefined();
    expect(await db.files.get(fileId)).toBeUndefined();
  });

  it('refuses to delete the seeded system folders', () => {
    store().softDelete([DOCUMENTS_ID, DESKTOP_ID]);
    expect(store().nodeById(DOCUMENTS_ID)?.deleted).toBe(false);
    expect(store().nodeById(DESKTOP_ID)?.deleted).toBe(false);
  });

  it('empties the Recycle Bin', () => {
    const a = store().createFile('text', DESKTOP_ID, 'a.txt', 'a');
    const b = store().createFile('text', DESKTOP_ID, 'b.txt', 'b');
    store().softDelete([a, b]);
    expect(store().nodes[a].deleted).toBe(true);

    store().emptyTrash();
    expect(store().nodeById(a)).toBeUndefined();
    expect(store().nodeById(b)).toBeUndefined();
  });

  it('copies, cuts and pastes through the shared clipboard', () => {
    const fileId = store().createFile('text', DESKTOP_ID, 'clip.txt', 'payload');

    store().setClipboard({ mode: 'copy', ids: [fileId] });
    store().paste(DOCUMENTS_ID);
    const copies = store().childrenOf(DOCUMENTS_ID).filter((node) => node.name.startsWith('clip'));
    expect(copies).toHaveLength(1);
    expect(copies[0].id).not.toBe(fileId);
    expect(copies[0].content).toBe('payload');
    // Copy keeps the clipboard, so a second paste still works.
    store().paste(DOCUMENTS_ID);
    expect(store().childrenOf(DOCUMENTS_ID).filter((node) => node.name.startsWith('clip'))).toHaveLength(2);

    store().setClipboard({ mode: 'cut', ids: [fileId] });
    store().paste(DESKTOP_ID);
    expect(store().nodeById(fileId)?.parentId).toBe(DESKTOP_ID);
    expect(store().clipboard).toBeNull();
  });

  it('tracks storage usage against the configured quota', () => {
    const quota = store().quotaBytes();
    expect(quota).toBe(defaultSettings.storageQuotaMB * 1024 * 1024);
    expect(store().usedBytes).toBe(totalUsedBytes(store().nodes));

    const before = store().usedBytes;
    store().createFile('text', DESKTOP_ID, 'big.txt', 'x'.repeat(4096));
    expect(store().usedBytes).toBeGreaterThan(before);

    useSettingsStore.getState().setQuota(32);
    expect(store().quotaBytes()).toBe(32 * 1024 * 1024);
  });

  it('records recently touched files', () => {
    const fileId = store().createFile('text', DESKTOP_ID, 'recent.txt', 'x');
    store().touchRecent(fileId);
    expect(store().recentIds[0]).toBe(fileId);
    store().touchRecent(fileId);
    expect(store().recentIds.filter((id) => id === fileId)).toHaveLength(1);
  });

  it('imports an exported backup and can reset to the seeded state', async () => {
    const fileId = store().createFile('text', DESKTOP_ID, 'backup-me.txt', 'keep me');
    const snapshot = JSON.stringify({ files: Object.values(store().nodes) });

    await store().resetAll();
    expect(store().nodeById(fileId)).toBeUndefined();
    expect(getNode(store().nodes, DESKTOP_ID)).toBeTruthy();

    const imported = await store().importAll(snapshot);
    expect(imported).toBe(true);
    expect(store().nodeById(fileId)?.content).toBe('keep me');

    expect(await store().importAll('not json')).toBe(false);
    expect(await store().importAll('{"files":"nope"}')).toBe(false);
  });
});
