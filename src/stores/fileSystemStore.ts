import { create } from 'zustand';
import type { ClipboardPayload, FileKind, FSNode } from '../types';
import {
  addNode,
  applyClipboard,
  copyNode,
  createNode,
  duplicateNode,
  emptyRecycleBin,
  estimateSize,
  getChildren,
  moveNode,
  purgeNode,
  renameNode,
  resolvePath,
  restoreNode,
  ROOT_ID,
  softDeleteNode,
  totalUsedBytes,
  uniqueName,
  updateNode,
  kindFromFileName,
  type NodeMap,
} from '../core/FileSystem';
import { contentForKind } from '../core/Documents';
import { buildSeedNodes } from '../data/seed';
import { ensureShellNodes } from '../data/shellAdditions';
import { db, initDatabase, safeWrite, getKV, setKV } from '../services/db';
import { useNotificationStore } from './notificationStore';
import { useSystemStore } from './systemStore';
import { useSettingsStore } from './settingsStore';
import { readFileAsDataUrl, readFileAsText, downloadBlob } from '../services/files';

/** Files larger than this are stored as metadata only (browser storage is finite). */
const MAX_INLINE_IMAGE_BYTES = 3.5 * 1024 * 1024;
const MAX_INLINE_TEXT_BYTES = 1.5 * 1024 * 1024;
const SEED_FLAG = 'fs.seeded.v1';

export interface FileSystemState {
  nodes: NodeMap;
  hydrated: boolean;
  storageAvailable: boolean;
  clipboard: ClipboardPayload | null;
  recentIds: string[];
  usedBytes: number;

  hydrate: () => Promise<void>;
  mutate: (fn: (nodes: NodeMap) => NodeMap) => void;
  createFolder: (parentId: string | null, name?: string) => string;
  createFile: (kind: FileKind, parentId: string | null, name?: string, content?: unknown) => string;
  updateContent: (id: string, content: unknown, patch?: Partial<FSNode>) => void;
  updateMetadata: (id: string, metadata: Partial<FSNode['metadata']>) => void;
  rename: (id: string, name: string) => boolean;
  move: (ids: string[], targetParentId: string | null) => void;
  copyTo: (ids: string[], targetParentId: string | null) => void;
  duplicate: (id: string) => void;
  softDelete: (ids: string[]) => void;
  purge: (ids: string[]) => void;
  restore: (ids: string[]) => void;
  emptyTrash: () => void;
  setClipboard: (payload: ClipboardPayload | null) => void;
  paste: (targetParentId: string | null) => void;
  setIconPosition: (id: string, x: number, y: number) => void;
  touchRecent: (id: string) => void;
  importFiles: (files: File[], parentId: string | null) => Promise<number>;
  exportNode: (id: string) => void;
  exportAll: () => void;
  importAll: (json: string) => Promise<boolean>;
  resetAll: () => Promise<void>;
  nodeById: (id: string | null | undefined) => FSNode | undefined;
  childrenOf: (parentId: string | null) => FSNode[];
  quotaBytes: () => number;
}

function diff(prev: NodeMap, next: NodeMap): { changed: FSNode[]; removed: string[] } {
  const changed: FSNode[] = [];
  const removed: string[] = [];
  for (const [id, node] of Object.entries(next)) {
    if (node !== prev[id]) changed.push(node);
  }
  for (const id of Object.keys(prev)) {
    if (!(id in next)) removed.push(id);
  }
  return { changed, removed };
}

export const useFileSystemStore = create<FileSystemState>()((set, get) => ({
  nodes: {},
  hydrated: false,
  storageAvailable: true,
  clipboard: null,
  recentIds: [],
  usedBytes: 0,

  hydrate: async () => {
    const available = await initDatabase();
    set({ storageAvailable: available });
    if (!available) {
      const seed = ensureShellNodes(buildSeedNodes()).nodes;
      set({ nodes: seed, hydrated: true, usedBytes: totalUsedBytes(seed) });
      useSystemStore.getState().setStorageWarning('error.storageUnavailable');
      return;
    }
    try {
      const seeded = await getKV<boolean>(SEED_FLAG);
      const rows = await db.files.toArray();
      const recent = (await getKV<string[]>('fs.recent')) ?? [];
      if (!seeded || rows.length === 0) {
        const merged: NodeMap = { ...buildSeedNodes() };
        for (const row of rows) merged[row.id] = row;
        const ensured = ensureShellNodes(merged);
        await safeWrite(() => db.files.bulkPut(Object.values(ensured.nodes)));
        await setKV(SEED_FLAG, true);
        set({ nodes: ensured.nodes, hydrated: true, usedBytes: totalUsedBytes(ensured.nodes), recentIds: recent });
      } else {
        const nodes: NodeMap = {};
        for (const row of rows) nodes[row.id] = row;
        if (!nodes[ROOT_ID]) {
          for (const [id, node] of Object.entries(buildSeedNodes())) {
            if (!nodes[id]) nodes[id] = node;
          }
        }
        const ensured = ensureShellNodes(nodes);
        if (ensured.added.length) {
          await safeWrite(() => db.files.bulkPut(ensured.added));
        }
        set({ nodes: ensured.nodes, hydrated: true, usedBytes: totalUsedBytes(ensured.nodes), recentIds: recent });
      }
    } catch (error) {
      console.error('[Windows 12 Concept] Failed to hydrate the file system', error);
      const seed = ensureShellNodes(buildSeedNodes()).nodes;
      set({ nodes: seed, hydrated: true, usedBytes: totalUsedBytes(seed) });
    }
  },

  mutate: (fn) => {
    const prev = get().nodes;
    const next = fn(prev);
    if (next === prev) return;
    const { changed, removed } = diff(prev, next);
    set({ nodes: next, usedBytes: totalUsedBytes(next) });
    if (!get().storageAvailable) return;
    void safeWrite(async () => {
      if (changed.length) await db.files.bulkPut(changed);
      if (removed.length) await db.files.bulkDelete(removed);
    }).then((result) => {
      if (!result.ok) {
        set({ storageAvailable: false });
        useSystemStore.getState().setStorageWarning('error.storageFull');
        useNotificationStore.getState().push({
          appId: 'explorer',
          title: 'Storage problem',
          body: 'Changes are kept in memory only — browser storage refused the write.',
          kind: 'error',
        });
      }
    });
  },

  createFolder: (parentId, name) => {
    const nodes = get().nodes;
    const finalName = uniqueName(nodes, parentId, name?.trim() || 'New folder');
    const node = createNode({ name: finalName, kind: 'folder', parentId, content: null });
    get().mutate((current) => addNode(current, node));
    useSystemStore.getState().logActivity({ label: `Created folder ${finalName}`, kind: 'file', appId: 'explorer' });
    return node.id;
  },

  createFile: (kind, parentId, name, content) => {
    const nodes = get().nodes;
    const extension = kind === 'doc' ? '.docx' : kind === 'sheet' ? '.xlsx' : kind === 'slides' ? '.pptx' : kind === 'text' ? '.txt' : kind === 'note' ? '.note' : '';
    const base = name?.trim() || (kind === 'doc' ? 'Document' : kind === 'sheet' ? 'Workbook' : kind === 'slides' ? 'Presentation' : kind === 'note' ? 'Note' : 'New file');
    const finalName = uniqueName(nodes, parentId, base.toLowerCase().endsWith(extension) || !extension ? base : `${base}${extension}`);
    const body = content ?? contentForKind(kind, finalName);
    const node = createNode({
      name: finalName,
      kind,
      parentId,
      content: body,
      size: estimateSize(body),
      metadata: { appId: appIdForKind(kind) },
    });
    get().mutate((current) => addNode(current, node));
    useSystemStore.getState().logActivity({ label: `Created ${finalName}`, kind: 'file', appId: 'explorer' });
    return node.id;
  },

  updateContent: (id, content, patch) => {
    const node = get().nodes[id];
    if (!node) return;
    get().mutate((current) =>
      updateNode(current, id, { content, size: estimateSize(content), ...patch }),
    );
  },

  updateMetadata: (id, metadata) => {
    const node = get().nodes[id];
    if (!node) return;
    get().mutate((current) => updateNode(current, id, { metadata: { ...node.metadata, ...metadata } }));
  },

  rename: (id, name) => {
    const nodes = get().nodes;
    const node = nodes[id];
    if (!node) return false;
    const clean = name.trim();
    if (!clean) return false;
    if (node.system && node.parentId === ROOT_ID) return false;
    const existing = getChildren(nodes, node.parentId).find(
      (sibling) => sibling.id !== id && sibling.name.toLowerCase() === clean.toLowerCase(),
    );
    if (existing) return false;
    get().mutate((current) => renameNode(current, id, clean));
    useSystemStore.getState().logActivity({ label: `Renamed to ${clean}`, kind: 'file', appId: 'explorer' });
    return true;
  },

  move: (ids, targetParentId) => {
    get().mutate((current) => {
      let next = current;
      for (const id of ids) next = moveNode(next, id, targetParentId);
      return next;
    });
    if (get().clipboard?.mode === 'cut') set({ clipboard: null });
  },

  copyTo: (ids, targetParentId) => {
    get().mutate((current) => {
      let next = current;
      for (const id of ids) next = copyNode(next, id, targetParentId);
      return next;
    });
  },

  duplicate: (id) => get().mutate((current) => duplicateNode(current, id)),

  softDelete: (ids) => {
    const nodes = get().nodes;
    const names = ids.map((id) => nodes[id]?.name).filter(Boolean);
    get().mutate((current) => {
      let next = current;
      for (const id of ids) {
        if (next[id]?.system && next[id]?.parentId === ROOT_ID) continue;
        next = softDeleteNode(next, id);
      }
      return next;
    });
    if (names.length) {
      useNotificationStore.getState().push({
        appId: 'explorer',
        title: names.length === 1 ? `"${names[0]}" moved to Recycle Bin` : `${names.length} items moved to Recycle Bin`,
        kind: 'info',
      });
      useSystemStore.getState().logActivity({ label: `Deleted ${names.join(', ')}`, kind: 'file', appId: 'explorer' });
    }
  },

  purge: (ids) => {
    get().mutate((current) => {
      let next = current;
      for (const id of ids) next = purgeNode(next, id);
      return next;
    });
  },

  restore: (ids) => {
    get().mutate((current) => {
      let next = current;
      for (const id of ids) next = restoreNode(next, id);
      return next;
    });
    useNotificationStore.getState().push({ appId: 'explorer', title: 'Item restored', kind: 'success' });
  },

  emptyTrash: () => {
    get().mutate((current) => emptyRecycleBin(current));
    useNotificationStore.getState().push({ appId: 'recyclebin', title: 'Recycle Bin emptied', kind: 'success' });
  },

  setClipboard: (payload) => set({ clipboard: payload }),

  paste: (targetParentId) => {
    const clipboard = get().clipboard;
    if (!clipboard) return;
    get().mutate((current) => applyClipboard(current, clipboard, targetParentId));
    if (clipboard.mode === 'cut') set({ clipboard: null });
  },

  setIconPosition: (id, x, y) => {
    const node = get().nodes[id];
    if (!node) return;
    get().mutate((current) => updateNode(current, id, { metadata: { ...node.metadata, iconX: x, iconY: y } }));
  },

  touchRecent: (id) => {
    const recentIds = [id, ...get().recentIds.filter((item) => item !== id)].slice(0, 24);
    set({ recentIds });
    void setKV('fs.recent', recentIds);
  },

  importFiles: async (files, parentId) => {
    if (!files.length) return 0;
    let imported = 0;
    const nodesToAdd: FSNode[] = [];

    for (const file of files) {
      const kind = kindFromFileName(file.name);
      let content: unknown = null;
      const metadata: FSNode['metadata'] = { mime: file.type || undefined };

      try {
        if (kind === 'image') {
          if (file.size <= MAX_INLINE_IMAGE_BYTES) {
            metadata.dataUrl = await readFileAsDataUrl(file);
          } else {
            metadata.dataUrl = undefined;
            metadata.tooLarge = true;
          }
        } else if (kind === 'text' || file.type.startsWith('text/') || /\.(json|csv|md|log|xml|html?)$/i.test(file.name)) {
          if (file.size <= MAX_INLINE_TEXT_BYTES) {
            content = await readFileAsText(file);
          } else {
            metadata.tooLarge = true;
          }
        } else {
          metadata.tooLarge = true;
        }
      } catch (error) {
        console.warn('[Windows 12 Concept] Import failed for', file.name, error);
        metadata.importError = true;
      }

      nodesToAdd.push(
        createNode({
          name: uniqueName(get().nodes, parentId, file.name),
          kind,
          parentId,
          size: file.size,
          content,
          metadata,
        }),
      );
      imported += 1;
    }

    get().mutate((current) => {
      let next = current;
      for (const node of nodesToAdd) next = addNode(next, node);
      return next;
    });

    useNotificationStore.getState().push({
      appId: 'explorer',
      title: imported === 1 ? `Imported "${files[0].name}"` : `Imported ${imported} files`,
      body: `Saved to ${resolvePath(get().nodes, parentId)}`,
      kind: 'success',
    });
    return imported;
  },

  exportNode: (id) => {
    const node = get().nodes[id];
    if (!node) return;
    if (node.metadata.dataUrl) {
      const anchor = document.createElement('a');
      anchor.href = node.metadata.dataUrl;
      anchor.download = node.name;
      anchor.click();
      return;
    }
    const payload = typeof node.content === 'string' ? node.content : JSON.stringify(node.content ?? {}, null, 2);
    const mime = typeof node.content === 'string' ? 'text/plain;charset=utf-8' : 'application/json';
    downloadBlob(new Blob([payload], { type: mime }), node.name);
  },

  exportAll: () => {
    const snapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      files: Object.values(get().nodes),
      settings: useSettingsStore.getState().settings,
    };
    downloadBlob(
      new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }),
      `windows12-concept-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );
    useNotificationStore.getState().push({ appId: 'settings', title: 'Backup exported', kind: 'success' });
  },

  importAll: async (json) => {
    try {
      const parsed = JSON.parse(json) as { files?: FSNode[] };
      const files = parsed.files;
      if (!Array.isArray(files)) return false;
      get().mutate(() => {
        const next: NodeMap = {};
        for (const node of files) {
          if (node && typeof node.id === 'string') next[node.id] = node;
        }
        return Object.keys(next).length ? next : buildSeedNodes();
      });
      useNotificationStore.getState().push({ appId: 'settings', title: 'Backup restored', kind: 'success' });
      return true;
    } catch (error) {
      console.warn('[Windows 12 Concept] Bad backup file', error);
      useNotificationStore.getState().push({ appId: 'settings', title: 'That backup could not be read', kind: 'error' });
      return false;
    }
  },

  resetAll: async () => {
    const seed = buildSeedNodes();
    set({ nodes: seed, clipboard: null, recentIds: [], usedBytes: totalUsedBytes(seed) });
    if (get().storageAvailable) {
      await safeWrite(async () => {
        await db.files.clear();
        await db.files.bulkPut(Object.values(seed));
        await setKV('fs.recent', []);
      });
    }
    useSystemStore.getState().clearActivity();
    useNotificationStore.getState().clearAll();
    useNotificationStore.getState().push({ appId: 'settings', title: 'Simulator reset', body: 'Default files and folders were restored.', kind: 'success' });
  },

  nodeById: (id) => (id ? get().nodes[id] : undefined),
  childrenOf: (parentId) => getChildren(get().nodes, parentId),
  quotaBytes: () => useSettingsStore.getState().settings.storageQuotaMB * 1024 * 1024,
}));

function appIdForKind(kind: FileKind): string | undefined {
  switch (kind) {
    case 'doc':
      return 'word';
    case 'sheet':
      return 'excel';
    case 'slides':
      return 'powerpoint';
    case 'text':
      return 'notepad';
    case 'note':
      return 'notes';
    case 'image':
      return 'photos';
    default:
      return undefined;
  }
}
