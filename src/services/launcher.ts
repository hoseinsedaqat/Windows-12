import type { FileKind, FSNode } from '../types';
import { getApp, defaultAppForKind } from '../core/ApplicationRegistry';
import { useWindowStore } from '../stores/windowStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useSystemStore } from '../stores/systemStore';
import { useNotificationStore } from '../stores/notificationStore';
import { playSound } from './sound';
import { ROOT_ID, RECYCLE_BIN_ID, DESKTOP_ID, DOCUMENTS_ID, DOWNLOADS_ID, PICTURES_ID, MUSIC_ID, VIDEOS_ID, NOTES_ID, ONEDRIVE_ID } from '../core/FileSystem';

/** Central launch logic: everything the shell can open goes through here. */

export function launchApp(appId: string, props: Record<string, unknown> = {}, title?: string): string | null {
  const app = getApp(appId);
  if (!app) {
    useNotificationStore.getState().push({ title: 'App not found', body: appId, kind: 'error' });
    return null;
  }
  const windowId = useWindowStore.getState().openApp(appId, props, title ? { title } : undefined);
  if (windowId) {
    playSound('open');
    useSystemStore.getState().logActivity({ label: `Opened ${app.name}`, kind: 'app', appId });
  }
  return windowId;
}

/** Open a file-system node with its default app (resolving shortcuts). */
export function openNode(node: FSNode | undefined, forceNew = false): void {
  if (!node) return;
  const fs = useFileSystemStore.getState();

  if (node.kind === 'shortcut') {
    const appId = node.metadata.appId as string | undefined;
    const targetId = node.metadata.targetId as string | undefined;
    const shortcutProps = (node.metadata.props as Record<string, unknown> | undefined) ?? {};
    if (targetId) {
      const target = fs.nodes[targetId];
      if (!target) {
        useNotificationStore.getState().push({ title: 'Broken shortcut', body: node.name, kind: 'warning' });
        return;
      }
      if (targetId === RECYCLE_BIN_ID) {
        launchApp('recyclebin');
        return;
      }
      launchApp('explorer', { path: targetId });
      return;
    }
    if (appId) {
      launchApp(appId, shortcutProps);
      return;
    }
    useNotificationStore.getState().push({ title: 'Broken shortcut', body: node.name, kind: 'warning' });
    return;
  }

  if (node.kind === 'folder') {
    launchApp('explorer', { path: node.id });
    return;
  }

  const appId = defaultAppForKind(node.kind);
  if (!appId) {
    useNotificationStore.getState().push({ title: 'No app can open this file', body: node.name, kind: 'warning' });
    return;
  }
  fs.touchRecent(node.id);
  launchApp(appId, { fileId: node.id }, forceNew ? `${node.name}` : undefined);
}

export function openWith(node: FSNode, appId: string): void {
  if (!node) return;
  useFileSystemStore.getState().touchRecent(node.id);
  launchApp(appId, { fileId: node.id });
}

/** Well-known shell folders used by Start shortcuts, Run and the sidebar. */
export const SHELL_FOLDERS: Record<string, string> = {
  home: ROOT_ID,
  root: ROOT_ID,
  'this pc': ROOT_ID,
  thispc: ROOT_ID,
  desktop: DESKTOP_ID,
  documents: DOCUMENTS_ID,
  downloads: DOWNLOADS_ID,
  pictures: PICTURES_ID,
  music: MUSIC_ID,
  videos: VIDEOS_ID,
  notes: NOTES_ID,
  onedrive: ONEDRIVE_ID,
  'recycle bin': RECYCLE_BIN_ID,
  recyclebin: RECYCLE_BIN_ID,
  trash: RECYCLE_BIN_ID,
};

/** Create a file of the given kind and immediately open it in its app. */
export function createAndOpen(kind: FileKind, parentId: string | null, name?: string): string | null {
  const fs = useFileSystemStore.getState();
  const id = fs.createFile(kind, parentId, name);
  const node = fs.nodes[id] ?? useFileSystemStore.getState().nodes[id];
  const appId = defaultAppForKind(kind);
  if (appId) {
    fs.touchRecent(id);
    launchApp(appId, { fileId: id });
  }
  void node;
  return id;
}
