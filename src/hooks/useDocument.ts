import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileKind, FSNode } from '../types';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useWindowStore } from '../stores/windowStore';
import { useNotificationStore } from '../stores/notificationStore';
import { DOCUMENTS_ID } from '../core/FileSystem';
import { estimateSize } from '../core/FileSystem';
import { createNode } from '../core/FileSystem';

export interface UseDocumentOptions<T> {
  /** File id passed through the window props (undefined → a new, unsaved document). */
  fileId?: string;
  kind: FileKind;
  /** App id used for activity + notifications. */
  appId: string;
  factory: (title: string) => T;
  validate: (content: unknown) => content is T;
  /** Window title resolver. */
  titleOf?: (doc: T, node?: FSNode) => string;
  autosave?: boolean;
  autosaveDelay?: number;
  defaultFolder?: string;
  defaultName?: string;
}

export interface UseDocument<T> {
  doc: T;
  node: FSNode | undefined;
  fileId: string | undefined;
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  externalChange: boolean;
  title: string;
  setDoc: (updater: T | ((previous: T) => T)) => void;
  save: (options?: { silent?: boolean }) => Promise<string | null>;
  saveAs: (name: string, parentId: string) => Promise<string | null>;
  reloadFromDisk: () => void;
  keepMine: () => void;
  renameFile: (name: string) => void;
  setFileId: (id: string | undefined) => void;
}

/**
 * Shared document lifecycle for the Office-style apps:
 * load → edit → (auto)save, with conflict detection so two windows editing the
 * same file never silently overwrite each other.
 */
export function useDocument<T>(options: UseDocumentOptions<T>): UseDocument<T> {
  const {
    fileId: initialFileId,
    kind,
    appId,
    factory,
    validate,
    titleOf,
    autosave = true,
    autosaveDelay = 1200,
    defaultFolder = DOCUMENTS_ID,
    defaultName,
  } = options;

  const nodes = useFileSystemStore((state) => state.nodes);
  const updateContent = useFileSystemStore((state) => state.updateContent);
  const rename = useFileSystemStore((state) => state.rename);
  const mutate = useFileSystemStore((state) => state.mutate);
  const touchRecent = useFileSystemStore((state) => state.touchRecent);
  const setWindowTitle = useWindowStore((state) => state.setWindowTitle);

  const [fileId, setFileIdState] = useState<string | undefined>(initialFileId);
  const node = fileId ? nodes[fileId] : undefined;

  const [doc, setDocState] = useState<T>(() => {
    const candidate = initialFileId ? nodes[initialFileId] : undefined;
    if (candidate && validate(candidate.content)) return candidate.content;
    return factory(defaultName ?? candidate?.name ?? 'Untitled');
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [externalChange, setExternalChange] = useState(false);

  const lastSeenUpdate = useRef<number>(node?.updatedAt ?? 0);
  const writingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  /* Switch document when the window is re-used for another file. */
  useEffect(() => {
    if (initialFileId === fileId) return;
    const next = initialFileId ? nodes[initialFileId] : undefined;
    setFileIdState(initialFileId);
    if (next && validate(next.content)) {
      setDocState(next.content);
      lastSeenUpdate.current = next.updatedAt;
    } else {
      setDocState(factory(defaultName ?? 'Untitled'));
      lastSeenUpdate.current = 0;
    }
    setDirty(false);
    setExternalChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFileId]);

  /* Detect writes made by another window/app. */
  useEffect(() => {
    if (!node) return;
    if (writingRef.current) {
      writingRef.current = false;
      lastSeenUpdate.current = node.updatedAt;
      return;
    }
    if (lastSeenUpdate.current && node.updatedAt > lastSeenUpdate.current) {
      setExternalChange(true);
    }
    lastSeenUpdate.current = node.updatedAt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.updatedAt]);

  const title = useMemo(() => {
    const base = titleOf ? titleOf(doc, node) : (node?.name ?? defaultName ?? 'Untitled');
    return `${dirty ? '• ' : ''}${base}`;
  }, [doc, node, dirty, titleOf, defaultName]);

  /* Keep the window title in sync. */
  useEffect(() => {
    const windows = useWindowStore.getState().windows;
    const target = windows.find((win) => win.appId === appId && win.props.fileId === fileId);
    if (target && target.title !== title) setWindowTitle(target.id, title);
    else if (!fileId) {
      const fresh = windows.filter((win) => win.appId === appId).sort((a, b) => b.openedAt - a.openedAt)[0];
      if (fresh && fresh.title !== title) setWindowTitle(fresh.id, title);
    }
  }, [title, appId, fileId, setWindowTitle]);

  const persist = useCallback(
    async (targetId: string, payload: T, silent: boolean) => {
      setSaving(true);
      writingRef.current = true;
      const withStamp = (() => {
        if (payload && typeof payload === 'object' && 'updatedAt' in (payload as Record<string, unknown>)) {
          return { ...(payload as Record<string, unknown>), updatedAt: Date.now() } as T;
        }
        return payload;
      })();
      updateContent(targetId, withStamp);
      lastSeenUpdate.current = Date.now();
      touchRecent(targetId);
      setDirty(false);
      setSavedAt(Date.now());
      setSaving(false);
      if (!silent) {
        useNotificationStore.getState().push({ appId, title: 'Saved', body: nodes[targetId]?.name, kind: 'success', duration: 2600 });
      }
      return targetId;
    },
    [appId, nodes, touchRecent, updateContent],
  );

  const save = useCallback(
    async (saveOptions: { silent?: boolean } = {}) => {
      const silent = saveOptions.silent ?? false;
      if (fileId && nodes[fileId]) {
        return persist(fileId, doc, silent);
      }
      // First save of a new document: create the node.
      const baseName = defaultName ?? titleOf?.(doc, undefined) ?? 'Untitled';
      const extension = kind === 'doc' ? '.docx' : kind === 'sheet' ? '.xlsx' : kind === 'slides' ? '.pptx' : kind === 'note' ? '.note' : '.txt';
      const name = baseName.toLowerCase().endsWith(extension) ? baseName : `${baseName}${extension}`;
      const id = createInFolder(mutate, nodes, name, kind, defaultFolder, doc, appId);
      setFileIdState(id);
      writingRef.current = true;
      lastSeenUpdate.current = Date.now();
      setDirty(false);
      setSavedAt(Date.now());
      touchRecent(id);
      if (!silent) {
        useNotificationStore.getState().push({ appId, title: 'Saved', body: name, kind: 'success', duration: 2600 });
      }
      return id;
    },
    [appId, defaultFolder, defaultName, doc, fileId, kind, mutate, nodes, persist, titleOf, touchRecent],
  );

  const saveAs = useCallback(
    async (name: string, parentId: string) => {
      const id = createInFolder(mutate, nodes, name, kind, parentId, doc, appId);
      setFileIdState(id);
      writingRef.current = true;
      lastSeenUpdate.current = Date.now();
      setDirty(false);
      setSavedAt(Date.now());
      touchRecent(id);
      useNotificationStore.getState().push({ appId, title: 'Saved a copy', body: name, kind: 'success', duration: 2600 });
      return id;
    },
    [appId, doc, kind, mutate, nodes, touchRecent],
  );

  const setDoc = useCallback((updater: T | ((previous: T) => T)) => {
    setDocState((previous) => (typeof updater === 'function' ? (updater as (prev: T) => T)(previous) : updater));
    setDirty(true);
  }, []);

  /* Auto-save */
  useEffect(() => {
    if (!autosave || !dirty || !fileId || externalChange) return undefined;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void persist(fileId, doc, true);
    }, autosaveDelay);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [autosave, dirty, doc, fileId, autosaveDelay, persist, externalChange]);

  /* Warn before losing unsaved work. */
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const reloadFromDisk = useCallback(() => {
    if (node && validate(node.content)) {
      setDocState(node.content);
      lastSeenUpdate.current = node.updatedAt;
      setDirty(false);
      setExternalChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.updatedAt, node?.content]);

  const keepMine = useCallback(() => {
    setExternalChange(false);
    if (fileId) void persist(fileId, doc, true);
  }, [doc, fileId, persist]);

  const renameFile = useCallback(
    (name: string) => {
      if (fileId) rename(fileId, name);
    },
    [fileId, rename],
  );

  const setFileId = useCallback((id: string | undefined) => {
    setFileIdState(id);
    const next = id ? useFileSystemStore.getState().nodes[id] : undefined;
    if (next && validate(next.content)) {
      setDocState(next.content);
      lastSeenUpdate.current = next.updatedAt;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    doc,
    node,
    fileId,
    dirty,
    saving,
    savedAt,
    externalChange,
    title,
    setDoc,
    save,
    saveAs,
    reloadFromDisk,
    keepMine,
    renameFile,
    setFileId,
  };
}

function createInFolder<T>(
  mutate: ReturnType<typeof useFileSystemStore.getState>['mutate'],
  nodes: Record<string, FSNode>,
  name: string,
  kind: FileKind,
  parentId: string,
  content: T,
  appId: string,
): string {
  const siblings = Object.values(nodes).filter((node) => node.parentId === parentId && !node.deleted);
  const taken = new Set(siblings.map((node) => node.name.toLowerCase()));
  let finalName = name;
  if (taken.has(finalName.toLowerCase())) {
    const dot = finalName.lastIndexOf('.');
    const base = dot > 0 ? finalName.slice(0, dot) : finalName;
    const ext = dot > 0 ? finalName.slice(dot) : '';
    let index = 2;
    while (taken.has(`${base} (${index})${ext}`.toLowerCase())) index += 1;
    finalName = `${base} (${index})${ext}`;
  }
  const node = createNode({
    name: finalName,
    kind,
    parentId,
    content,
    size: estimateSize(content),
    metadata: { appId },
  });
  mutate((current) => ({ ...current, [node.id]: node }));
  return node.id;
}
