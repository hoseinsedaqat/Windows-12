import type { ClipboardPayload, ExplorerView, FileKind, FSNode, SortDirection, SortKey } from '../types';
import { uid } from '../services/id';

/**
 * Virtual file system core.
 *
 * Every function here is pure: it takes a node map and returns a new node map.
 * That keeps the logic testable without IndexedDB and lets the store stay thin.
 * Nodes are identified by a stable id — a path is only a *view* of the tree.
 */

export type NodeMap = Record<string, FSNode>;

/** Well-known folder ids created on first run. */
export const ROOT_ID = 'root';
export const DESKTOP_ID = 'desktop';
export const DOCUMENTS_ID = 'documents';
export const DOWNLOADS_ID = 'downloads';
export const PICTURES_ID = 'pictures';
export const MUSIC_ID = 'music';
export const VIDEOS_ID = 'videos';
export const NOTES_ID = 'notes';
export const ONEDRIVE_ID = 'onedrive';
export const RECYCLE_BIN_ID = 'recycle-bin';
export const THIS_PC_ID = 'this-pc';

export const KNOWN_FOLDERS: { id: string; name: string; parentId: string | null }[] = [
  { id: DESKTOP_ID, name: 'Desktop', parentId: ROOT_ID },
  { id: DOCUMENTS_ID, name: 'Documents', parentId: ROOT_ID },
  { id: DOWNLOADS_ID, name: 'Downloads', parentId: ROOT_ID },
  { id: PICTURES_ID, name: 'Pictures', parentId: ROOT_ID },
  { id: MUSIC_ID, name: 'Music', parentId: ROOT_ID },
  { id: VIDEOS_ID, name: 'Videos', parentId: ROOT_ID },
  { id: NOTES_ID, name: 'Notes', parentId: ROOT_ID },
  { id: ONEDRIVE_ID, name: 'OneDrive', parentId: ROOT_ID },
  { id: RECYCLE_BIN_ID, name: 'Recycle Bin', parentId: ROOT_ID },
];

export const KIND_LABELS: Record<FileKind, string> = {
  folder: 'File folder',
  doc: 'Word Document',
  sheet: 'Excel Workbook',
  slides: 'PowerPoint Presentation',
  text: 'Text Document',
  note: 'Note',
  image: 'Picture',
  audio: 'Audio file',
  video: 'Video file',
  pdf: 'PDF Document',
  shortcut: 'Shortcut',
  archive: 'Compressed archive',
  other: 'File',
};

export const KIND_EXTENSIONS: Partial<Record<FileKind, string>> = {
  doc: 'docx',
  sheet: 'xlsx',
  slides: 'pptx',
  text: 'txt',
  note: 'note',
  image: 'png',
  pdf: 'pdf',
};

export function extensionForKind(kind: FileKind): string {
  return KIND_EXTENSIONS[kind] ?? '';
}

export function kindFromFileName(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'doc':
    case 'docx':
      return 'doc';
    case 'xls':
    case 'xlsx':
    case 'csv':
      return 'sheet';
    case 'ppt':
    case 'pptx':
      return 'slides';
    case 'txt':
    case 'md':
    case 'json':
    case 'log':
    case 'xml':
    case 'html':
    case 'css':
    case 'ts':
    case 'js':
      return 'text';
    case 'note':
      return 'note';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'avif':
      return 'image';
    case 'mp3':
    case 'wav':
    case 'ogg':
    case 'flac':
    case 'm4a':
      return 'audio';
    case 'mp4':
    case 'webm':
    case 'mov':
    case 'mkv':
    case 'avi':
      return 'video';
    case 'pdf':
      return 'pdf';
    case 'zip':
    case 'rar':
    case '7z':
    case 'tar':
    case 'gz':
      return 'archive';
    case 'lnk':
      return 'shortcut';
    default:
      return 'other';
  }
}

export function createNode(partial: Partial<FSNode> & { name: string; kind: FileKind }): FSNode {
  const now = Date.now();
  return {
    id: partial.id ?? uid(partial.kind === 'folder' ? 'fld' : 'fil'),
    name: partial.name,
    kind: partial.kind,
    parentId: partial.parentId ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    size: partial.size ?? 0,
    content: partial.content ?? null,
    metadata: partial.metadata ?? {},
    deleted: partial.deleted ?? false,
    deletedAt: partial.deletedAt,
    system: partial.system,
  };
}

export function getNode(nodes: NodeMap, id: string | null | undefined): FSNode | undefined {
  if (!id) return undefined;
  return nodes[id];
}

export function getChildren(nodes: NodeMap, parentId: string | null, includeDeleted = false): FSNode[] {
  return Object.values(nodes).filter(
    (node) => node.parentId === parentId && (includeDeleted || !node.deleted),
  );
}

export function isDescendant(nodes: NodeMap, candidateId: string, ancestorId: string): boolean {
  let current = getNode(nodes, candidateId);
  const guard = new Set<string>();
  while (current && current.parentId) {
    if (guard.has(current.id)) return false;
    guard.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = getNode(nodes, current.parentId);
  }
  return false;
}

/** Absolute-ish path, e.g. `This PC › Documents › Report.docx`. */
export function resolvePath(nodes: NodeMap, id: string | null): string {
  if (!id) return 'This PC';
  if (id === ROOT_ID) return 'This PC';
  const parts: string[] = [];
  let current = getNode(nodes, id);
  const guard = new Set<string>();
  while (current && current.id !== ROOT_ID) {
    if (guard.has(current.id)) break;
    guard.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? getNode(nodes, current.parentId) : undefined;
  }
  return parts.length ? `This PC › ${parts.join(' › ')}` : 'This PC';
}

export function pathSegments(nodes: NodeMap, id: string | null): FSNode[] {
  const segments: FSNode[] = [];
  let current = id ? getNode(nodes, id) : undefined;
  const guard = new Set<string>();
  while (current && current.id !== ROOT_ID) {
    if (guard.has(current.id)) break;
    guard.add(current.id);
    segments.unshift(current);
    current = current.parentId ? getNode(nodes, current.parentId) : undefined;
  }
  return segments;
}

/** `Documents\Projects` style relative path used by Terminal / Run. */
export function relativePath(nodes: NodeMap, id: string | null): string {
  return pathSegments(nodes, id)
    .map((node) => node.name)
    .join('/');
}

export function resolveRelativePath(nodes: NodeMap, cwdId: string | null, input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return cwdId;
  const normalized = trimmed.replace(/\\/g, '/');
  if (normalized === '/' || normalized === 'C:' || normalized === 'C:/') return ROOT_ID;
  const absolute = normalized.startsWith('/');
  const parts = (absolute ? normalized.slice(1) : `${relativePath(nodes, cwdId)}/${normalized}`)
    .split('/')
    .filter((part) => part.length > 0 && part !== '.');

  let currentId: string | null = ROOT_ID;
  for (const part of parts) {
    if (part === '..') {
      const current = getNode(nodes, currentId);
      currentId = current?.parentId ?? ROOT_ID;
      continue;
    }
    const children = getChildren(nodes, currentId, true);
    const match = children.find((child) => child.name.toLowerCase() === part.toLowerCase());
    if (!match) return null;
    currentId = match.id;
  }
  return currentId;
}

/** `Report`, `Report (2)`, `Report (3)` … */
export function uniqueName(nodes: NodeMap, parentId: string | null, desired: string, ignoreId?: string): string {
  const siblings = getChildren(nodes, parentId, true).filter((node) => node.id !== ignoreId);
  const taken = new Set(siblings.map((node) => node.name.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) return desired;

  const dotIndex = desired.lastIndexOf('.');
  const hasExtension = dotIndex > 0 && dotIndex < desired.length - 1;
  const base = hasExtension ? desired.slice(0, dotIndex) : desired;
  const extension = hasExtension ? desired.slice(dotIndex) : '';
  let index = 2;
  let candidate = `${base} (${index})${extension}`;
  while (taken.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base} (${index})${extension}`;
  }
  return candidate;
}

export function nodeSize(nodes: NodeMap, node: FSNode): number {
  if (node.kind !== 'folder') return node.size || 0;
  let total = 0;
  const stack = [node.id];
  const seen = new Set<string>();
  while (stack.length) {
    const currentId = stack.pop()!;
    if (seen.has(currentId)) continue;
    seen.add(currentId);
    for (const child of getChildren(nodes, currentId)) {
      if (child.kind === 'folder') stack.push(child.id);
      else total += child.size || 0;
    }
  }
  return total;
}

export function totalUsedBytes(nodes: NodeMap): number {
  return Object.values(nodes)
    .filter((node) => node.kind !== 'folder' && node.parentId !== RECYCLE_BIN_ID)
    .reduce((sum, node) => sum + (node.size || 0), 0);
}

export function countDescendants(nodes: NodeMap, id: string): { folders: number; files: number } {
  let folders = 0;
  let files = 0;
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const currentId = stack.pop()!;
    if (seen.has(currentId)) continue;
    seen.add(currentId);
    for (const child of getChildren(nodes, currentId)) {
      if (child.kind === 'folder') {
        folders += 1;
        stack.push(child.id);
      } else {
        files += 1;
      }
    }
  }
  return { folders, files };
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function addNode(nodes: NodeMap, node: FSNode): NodeMap {
  return { ...nodes, [node.id]: node };
}

export function updateNode(nodes: NodeMap, id: string, patch: Partial<FSNode>): NodeMap {
  const existing = nodes[id];
  if (!existing) return nodes;
  return { ...nodes, [id]: { ...existing, ...patch, updatedAt: patch.updatedAt ?? Date.now() } };
}

export function renameNode(nodes: NodeMap, id: string, nextName: string): NodeMap {
  const node = nodes[id];
  if (!node) return nodes;
  const clean = nextName.trim();
  if (!clean || clean === node.name) return nodes;
  return updateNode(nodes, id, { name: clean });
}

export interface MoveOptions {
  /** Skip the "cannot move a folder into itself" guard (never used by the UI). */
  force?: boolean;
}

export function moveNode(nodes: NodeMap, id: string, targetParentId: string | null, options: MoveOptions = {}): NodeMap {
  const node = nodes[id];
  if (!node || node.id === targetParentId) return nodes;
  if (!options.force && node.kind === 'folder' && isDescendant(nodes, targetParentId ?? '', node.id)) {
    return nodes;
  }
  if (node.system && targetParentId !== node.parentId && targetParentId !== RECYCLE_BIN_ID) {
    // System folders stay where they are.
    if (node.parentId === ROOT_ID) return nodes;
  }
  const name = uniqueName(nodes, targetParentId, node.name, node.id);
  return updateNode(nodes, id, { parentId: targetParentId, name });
}

export function copyNode(nodes: NodeMap, id: string, targetParentId: string | null): NodeMap {
  const source = nodes[id];
  if (!source) return nodes;
  let next: NodeMap = nodes;
  const cloneId = uid(source.kind === 'folder' ? 'fld' : 'fil');
  const clone = createNode({
    ...source,
    id: cloneId,
    parentId: targetParentId,
    name: uniqueName(nodes, targetParentId, source.name),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deleted: false,
    system: false,
    content: source.content === null || source.content === undefined ? null : structuredCloneSafe(source.content),
    metadata: { ...source.metadata, iconX: undefined, iconY: undefined },
  });
  next = addNode(next, clone);

  if (source.kind === 'folder') {
    for (const child of getChildren(nodes, source.id)) {
      next = copyNode(next, child.id, cloneId);
    }
  }
  return next;
}

function structuredCloneSafe<T>(value: T): T {
  try {
    return typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);
  } catch {
    return value;
  }
}

export function duplicateNode(nodes: NodeMap, id: string): NodeMap {
  const node = nodes[id];
  if (!node) return nodes;
  return copyNode(nodes, id, node.parentId);
}

/** Soft delete → the node (and its subtree) becomes visible in the Recycle Bin. */
export function softDeleteNode(nodes: NodeMap, id: string): NodeMap {
  const node = nodes[id];
  if (!node || node.deleted) return nodes;
  let next = updateNode(nodes, id, {
    deleted: true,
    deletedAt: Date.now(),
    metadata: { ...node.metadata, originalPath: resolvePath(nodes, node.parentId) },
  });
  for (const child of getChildren(nodes, id)) {
    next = softDeleteNode(next, child.id);
  }
  return next;
}

export function restoreNode(nodes: NodeMap, id: string): NodeMap {
  const node = nodes[id];
  if (!node || !node.deleted) return nodes;
  const originalParent = node.metadata.originalPath
    ? findIdByPath(nodes, node.metadata.originalPath)
    : ROOT_ID;
  const target = originalParent && nodes[originalParent] && !nodes[originalParent].deleted ? originalParent : ROOT_ID;
  let next = updateNode(nodes, id, {
    deleted: false,
    deletedAt: undefined,
    parentId: target,
    name: uniqueName(nodes, target, node.name, node.id),
  });
  for (const child of getChildren(nodes, id, true).filter((c) => c.deleted)) {
    next = restoreNode(next, child.id);
  }
  return next;
}

export function findIdByPath(nodes: NodeMap, path: string): string | null {
  const label = path.replace(/^This PC\s*›\s*/, '').trim();
  if (!label) return ROOT_ID;
  const parts = label.split('›').map((part) => part.trim()).filter(Boolean);
  let currentId: string | null = ROOT_ID;
  for (const part of parts) {
    const match: FSNode | undefined = getChildren(nodes, currentId, true).find((node) => node.name === part);
    if (!match) return null;
    currentId = match.id;
  }
  return currentId;
}

/** Hard delete: removes the node and every descendant. */
export function purgeNode(nodes: NodeMap, id: string): NodeMap {
  const next: NodeMap = { ...nodes };
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length) {
    const currentId = stack.pop()!;
    if (seen.has(currentId)) continue;
    seen.add(currentId);
    for (const child of Object.values(next).filter((node) => node.parentId === currentId)) {
      stack.push(child.id);
    }
    delete next[currentId];
  }
  return next;
}

export function emptyRecycleBin(nodes: NodeMap): NodeMap {
  let next = nodes;
  for (const node of Object.values(nodes).filter((item) => item.deleted)) {
    next = purgeNode(next, node.id);
  }
  return next;
}

export function applyClipboard(nodes: NodeMap, clipboard: ClipboardPayload | null, targetParentId: string | null): NodeMap {
  if (!clipboard || !clipboard.ids.length) return nodes;
  let next = nodes;
  for (const id of clipboard.ids) {
    if (clipboard.mode === 'copy') {
      next = copyNode(next, id, targetParentId);
    } else if (id !== targetParentId) {
      next = moveNode(next, id, targetParentId);
    }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export interface SortOptions {
  key: SortKey;
  direction: SortDirection;
  foldersFirst?: boolean;
}

export function sortNodes(items: FSNode[], options: SortOptions): FSNode[] {
  const { key, direction, foldersFirst = true } = options;
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (foldersFirst && (a.kind === 'folder') !== (b.kind === 'folder')) {
      return a.kind === 'folder' ? -1 : 1;
    }
    switch (key) {
      case 'size':
        return (a.size - b.size) * factor;
      case 'kind':
        return a.kind.localeCompare(b.kind) * factor;
      case 'createdAt':
        return (a.createdAt - b.createdAt) * factor;
      case 'updatedAt':
        return (a.updatedAt - b.updatedAt) * factor;
      case 'name':
      default:
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) * factor;
    }
  });
}

export interface SearchOptions {
  kinds?: FileKind[];
  limit?: number;
  includeDeleted?: boolean;
  scopeId?: string | null;
}

export function searchNodes(nodes: NodeMap, query: string, options: SearchOptions = {}): FSNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const { kinds, limit = 200, includeDeleted = false, scopeId } = options;
  const results: FSNode[] = [];
  for (const node of Object.values(nodes)) {
    if (node.id === ROOT_ID) continue;
    if (!includeDeleted && node.deleted) continue;
    if (includeDeleted && !node.deleted) continue;
    if (kinds?.length && !kinds.includes(node.kind)) continue;
    if (scopeId && scopeId !== ROOT_ID && !isDescendant(nodes, node.id, scopeId) && node.id !== scopeId) continue;
    const haystack = `${node.name} ${String(node.metadata.appId ?? '')}`.toLowerCase();
    if (haystack.includes(needle)) results.push(node);
  }
  return results.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

export function recentlyUpdated(nodes: NodeMap, limit = 8): FSNode[] {
  return Object.values(nodes)
    .filter((node) => !node.deleted && node.kind !== 'folder' && node.id !== ROOT_ID)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function viewLabel(view: ExplorerView): string {
  return view === 'grid' ? 'Grid' : view === 'list' ? 'List' : 'Details';
}

/** Best-effort byte size for arbitrary JSON content. */
export function estimateSize(content: unknown): number {
  if (content === null || content === undefined) return 0;
  if (typeof content === 'string') return content.length * 2;
  try {
    return JSON.stringify(content).length * 2;
  } catch {
    return 0;
  }
}
