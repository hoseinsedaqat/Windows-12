import { describe, expect, it } from 'vitest';
import {
  addNode,
  applyClipboard,
  copyNode,
  countDescendants,
  createNode,
  DOCUMENTS_ID,
  DESKTOP_ID,
  duplicateNode,
  emptyRecycleBin,
  estimateSize,
  extensionForKind,
  findIdByPath,
  getChildren,
  getNode,
  isDescendant,
  kindFromFileName,
  moveNode,
  purgeNode,
  recentlyUpdated,
  renameNode,
  resolvePath,
  resolveRelativePath,
  restoreNode,
  ROOT_ID,
  searchNodes,
  softDeleteNode,
  sortNodes,
  totalUsedBytes,
  uniqueName,
  updateNode,
  type NodeMap,
} from '../core/FileSystem';
import { buildSeedNodes } from '../data/seed';

function base(): NodeMap {
  const nodes: NodeMap = {};
  const root = createNode({ id: ROOT_ID, name: 'This PC', kind: 'folder', parentId: null, system: true });
  const desktop = createNode({ id: DESKTOP_ID, name: 'Desktop', kind: 'folder', parentId: ROOT_ID, system: true });
  const documents = createNode({ id: DOCUMENTS_ID, name: 'Documents', kind: 'folder', parentId: ROOT_ID, system: true });
  for (const node of [root, desktop, documents]) nodes[node.id] = node;
  return nodes;
}

function textFile(name: string, parentId: string, content: string) {
  const node = createNode({ name, kind: 'text', parentId, content });
  node.size = estimateSize(content);
  return node;
}

/** The Recycle Bin view is derived from the `deleted` flag, not from a parent id. */
function trash(nodes: NodeMap) {
  return Object.values(nodes).filter((node) => node.deleted && !(node.parentId ? nodes[node.parentId]?.deleted : false));
}

describe('FileSystem core', () => {
  it('creates nodes with stable ids and default metadata', () => {
    const node = textFile('Report.txt', DOCUMENTS_ID, 'hello');
    expect(node.id).toBeTruthy();
    expect(node.parentId).toBe(DOCUMENTS_ID);
    expect(node.deleted).toBe(false);
    expect(node.size).toBe(10);
    expect(node.createdAt).toBeLessThanOrEqual(node.updatedAt);
    expect(estimateSize('hello')).toBe(10);
    expect(estimateSize(null)).toBe(0);
  });

  it('adds, reads and updates nodes without mutating the input map', () => {
    const nodes = base();
    const file = textFile('a.txt', ROOT_ID, 'abc');
    const next = addNode(nodes, file);
    expect(nodes[file.id]).toBeUndefined();
    expect(getNode(next, file.id)?.name).toBe('a.txt');

    const updated = updateNode(next, file.id, { content: 'abcdef' });
    expect(getNode(updated, file.id)?.content).toBe('abcdef');
    expect(getNode(next, file.id)?.content).toBe('abc');
    expect(getNode(updated, file.id)!.updatedAt).toBeGreaterThanOrEqual(file.updatedAt);
    expect(updateNode(updated, 'missing', { name: 'x' })).toBe(updated);
  });

  it('renames and generates collision-free names', () => {
    const nodes = base();
    const a = textFile('note.txt', DESKTOP_ID, 'a');
    let map = addNode(nodes, a);
    const b = createNode({ ...textFile(uniqueName(map, DESKTOP_ID, 'note.txt'), DESKTOP_ID, 'b'), id: undefined });
    map = addNode(map, b);
    expect(b.name).not.toBe(a.name);
    expect(uniqueName(map, DESKTOP_ID, 'note.txt')).not.toBe('note.txt');
    expect(uniqueName(map, DESKTOP_ID, 'note.txt', a.id)).toBeTruthy();

    const renamed = renameNode(map, a.id, 'renamed.txt');
    expect(getNode(renamed, a.id)?.name).toBe('renamed.txt');
    // Renaming never leaves two siblings with the same name.
    expect(getChildren(renamed, DESKTOP_ID).filter((node) => node.name === 'renamed.txt')).toHaveLength(1);
  });

  it('moves, copies and duplicates subtrees correctly', () => {
    let nodes = base();
    const folder = createNode({ name: 'Projects', kind: 'folder', parentId: DESKTOP_ID });
    nodes = addNode(nodes, folder);
    const child = textFile('plan.txt', folder.id, 'plan');
    nodes = addNode(nodes, child);

    expect(isDescendant(nodes, child.id, folder.id)).toBe(true);
    expect(isDescendant(nodes, folder.id, child.id)).toBe(false);
    expect(isDescendant(nodes, folder.id, folder.id)).toBe(false);

    const moved = moveNode(nodes, folder.id, DOCUMENTS_ID);
    expect(getNode(moved, folder.id)?.parentId).toBe(DOCUMENTS_ID);
    expect(isDescendant(moved, child.id, DOCUMENTS_ID)).toBe(true);

    // Moving a folder into its own descendant is refused.
    const cyclic = moveNode(moved, folder.id, child.id);
    expect(getNode(cyclic, folder.id)?.parentId).toBe(DOCUMENTS_ID);

    const copied = copyNode(moved, folder.id, DESKTOP_ID);
    const copies = getChildren(copied, DESKTOP_ID);
    expect(copies).toHaveLength(1);
    expect(copies[0].id).not.toBe(folder.id);
    const copyChildren = getChildren(copied, copies[0].id);
    expect(copyChildren.map((node) => node.name)).toEqual(['plan.txt']);
    expect(copyChildren[0].id).not.toBe(child.id);
    expect(copyChildren[0].content).toBe('plan');
    // The original subtree is untouched by the copy.
    expect(getChildren(copied, folder.id).map((node) => node.id)).toEqual([child.id]);

    const duplicated = duplicateNode(copied, child.id);
    expect(getChildren(duplicated, folder.id)).toHaveLength(2);
  });

  it('soft deletes into the Recycle Bin, restores, purges and empties', () => {
    let nodes = base();
    const folder = createNode({ name: 'Box', kind: 'folder', parentId: DESKTOP_ID });
    nodes = addNode(nodes, folder);
    const file = textFile('temp.txt', folder.id, 'temp');
    nodes = addNode(nodes, file);

    const deleted = softDeleteNode(nodes, folder.id);
    expect(getNode(deleted, folder.id)?.deleted).toBe(true);
    // The whole subtree goes with it.
    expect(getNode(deleted, file.id)?.deleted).toBe(true);
    expect(getChildren(deleted, DESKTOP_ID)).toHaveLength(0);
    expect(trash(deleted).map((node) => node.id)).toEqual([folder.id]);
    expect(getNode(deleted, folder.id)?.metadata.originalPath).toContain('Desktop');

    const restored = restoreNode(deleted, folder.id);
    expect(getNode(restored, folder.id)?.deleted).toBe(false);
    expect(getNode(restored, folder.id)?.parentId).toBe(DESKTOP_ID);
    expect(getChildren(restored, DESKTOP_ID).map((node) => node.id)).toContain(folder.id);

    const purged = purgeNode(restored, folder.id);
    expect(getNode(purged, folder.id)).toBeUndefined();
    expect(getNode(purged, file.id)).toBeUndefined();

    const binned = softDeleteNode(base(), textFile('x.txt', DESKTOP_ID, 'x').id);
    const withTrash = (() => {
      let map = base();
      const victim = textFile('gone.txt', DESKTOP_ID, 'gone');
      map = addNode(map, victim);
      return softDeleteNode(map, victim.id);
    })();
    expect(trash(withTrash)).toHaveLength(1);
    const emptied = emptyRecycleBin(withTrash);
    expect(trash(emptied)).toHaveLength(0);
    expect(binned).toBeTruthy();
  });

  it('resolves paths and relative navigation', () => {
    const nodes = buildSeedNodes();
    expect(resolvePath(nodes, ROOT_ID)).toContain('This PC');
    expect(resolvePath(nodes, DOCUMENTS_ID)).toContain('Documents');

    let working = nodes;
    const folder = createNode({ name: 'Work', kind: 'folder', parentId: DOCUMENTS_ID });
    working = addNode(working, folder);
    expect(resolveRelativePath(working, DOCUMENTS_ID, 'Work')).toBe(folder.id);
    expect(resolveRelativePath(working, folder.id, '..')).toBe(DOCUMENTS_ID);
    expect(resolveRelativePath(working, DOCUMENTS_ID, 'Missing')).toBeNull();
    expect(findIdByPath(working, resolvePath(working, folder.id))).toBe(folder.id);
  });

  it('applies clipboard copy and cut semantics', () => {
    let nodes = base();
    const file = textFile('clip.txt', DESKTOP_ID, 'clip');
    nodes = addNode(nodes, file);

    const pasted = applyClipboard(nodes, { mode: 'copy', ids: [file.id] }, DOCUMENTS_ID);
    expect(getChildren(pasted, DOCUMENTS_ID).map((node) => node.name)).toContain('clip.txt');
    expect(getNode(pasted, file.id)?.parentId).toBe(DESKTOP_ID);

    const cut = applyClipboard(pasted, { mode: 'cut', ids: [file.id] }, DOCUMENTS_ID);
    expect(getNode(cut, file.id)?.parentId).toBe(DOCUMENTS_ID);
    expect(getChildren(cut, DESKTOP_ID).some((node) => node.id === file.id)).toBe(false);

    expect(applyClipboard(nodes, null, DOCUMENTS_ID)).toBe(nodes);
  });

  it('sorts folders first and honours the sort key/direction', () => {
    let nodes = base();
    const folder = createNode({ name: 'zebra', kind: 'folder', parentId: DESKTOP_ID });
    const file = textFile('apple.txt', DESKTOP_ID, 'aaaa');
    nodes = addNode(addNode(nodes, folder), file);

    const asc = sortNodes(getChildren(nodes, DESKTOP_ID), { key: 'name', direction: 'asc' });
    expect(asc[0].kind).toBe('folder');
    expect(asc[1].name).toBe('apple.txt');

    const bySize = sortNodes(getChildren(nodes, DESKTOP_ID), { key: 'size', direction: 'desc', foldersFirst: false });
    expect(bySize[0].size).toBeGreaterThanOrEqual(bySize[bySize.length - 1].size);

    const byKind = sortNodes(getChildren(nodes, DESKTOP_ID), { key: 'kind', direction: 'asc', foldersFirst: false });
    expect(byKind.map((node) => node.kind)).toEqual([...byKind.map((node) => node.kind)].sort());
  });

  it('searches by name, kind and scope, skipping deleted nodes', () => {
    let nodes = buildSeedNodes();
    const a = createNode({ name: 'Zephyr.xlsx', kind: 'sheet', parentId: DOCUMENTS_ID });
    const b = textFile('Zephyr notes.txt', DESKTOP_ID, 'x');
    nodes = addNode(addNode(nodes, a), b);

    const all = searchNodes(nodes, 'zephyr');
    expect(all.map((node) => node.id).sort()).toEqual([a.id, b.id].sort());
    expect(searchNodes(nodes, 'zephyr', { kinds: ['sheet'] }).map((node) => node.id)).toEqual([a.id]);
    expect(searchNodes(nodes, 'zephyr', { scopeId: DESKTOP_ID }).map((node) => node.id)).toEqual([b.id]);
    expect(searchNodes(nodes, '')).toHaveLength(0);
    expect(searchNodes(nodes, 'zephyr', { limit: 1 })).toHaveLength(1);

    const deleted = softDeleteNode(nodes, a.id);
    expect(searchNodes(deleted, 'zephyr').map((node) => node.id)).toEqual([b.id]);
    expect(searchNodes(deleted, 'zephyr', { includeDeleted: true }).map((node) => node.id)).toEqual([a.id]);
  });

  it('counts descendants and reports storage usage', () => {
    let nodes = base();
    const folder = createNode({ name: 'Deep', kind: 'folder', parentId: DESKTOP_ID });
    nodes = addNode(nodes, folder);
    const inner = createNode({ name: 'Inner', kind: 'folder', parentId: folder.id });
    nodes = addNode(nodes, inner);
    nodes = addNode(nodes, textFile('file.txt', inner.id, 'hello world'));

    const counts = countDescendants(nodes, folder.id);
    expect(counts.folders).toBe(1);
    expect(counts.files).toBe(1);
    expect(totalUsedBytes(nodes)).toBe(22);
    expect(recentlyUpdated(nodes, 3).length).toBeLessThanOrEqual(3);
  });

  it('maps file kinds to extensions and back', () => {
    expect(extensionForKind('doc')).toBe('docx');
    expect(extensionForKind('sheet')).toBe('xlsx');
    expect(extensionForKind('slides')).toBe('pptx');
    expect(extensionForKind('text')).toBe('txt');
    expect(kindFromFileName('notes.txt')).toBe('text');
    expect(kindFromFileName('plan.docx')).toBe('doc');
    expect(kindFromFileName('data.xlsx')).toBe('sheet');
    expect(kindFromFileName('deck.pptx')).toBe('slides');
    expect(kindFromFileName('photo.png')).toBe('image');
    expect(kindFromFileName('unknown.xyz')).toBe('other');
  });

  it('seeds a consistent tree with known folders and no orphans', () => {
    const nodes = buildSeedNodes();
    expect(getNode(nodes, ROOT_ID)).toBeTruthy();
    for (const id of [DESKTOP_ID, DOCUMENTS_ID, 'downloads', 'pictures', 'music', 'videos', 'notes', 'recycle-bin', 'onedrive']) {
      expect(getNode(nodes, id), id).toBeTruthy();
    }
    for (const node of Object.values(nodes)) {
      if (node.parentId === null) continue;
      expect(getNode(nodes, node.parentId), `orphan ${node.name}`).toBeTruthy();
    }
    expect(totalUsedBytes(nodes)).toBeGreaterThan(0);
    // Seed content must never be flagged as deleted.
    expect(trash(nodes)).toHaveLength(0);
  });
});
