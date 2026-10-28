import { searchApps, getApp } from './ApplicationRegistry';
import { useWindowStore } from '../stores/windowStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useSystemStore } from '../stores/systemStore';
import { launchApp, openNode, SHELL_FOLDERS } from '../services/launcher';
import { resolveRelativePath, ROOT_ID } from './FileSystem';

/**
 * Command Manager — resolves what the Run dialog and Start search typed.
 *
 * Only in-simulator targets are reachable: apps, virtual folders and a handful
 * of classic shell aliases. There is deliberately no path to the host OS.
 */

export interface CommandResult {
  ok: boolean;
  /** What happened, for logging / notifications. */
  message?: string;
}

const SHELL_ALIASES: Record<string, () => CommandResult> = {
  control: () => (launchApp('settings') ? { ok: true, message: 'Settings' } : { ok: false }),
  'control panel': () => (launchApp('settings') ? { ok: true, message: 'Settings' } : { ok: false }),
  settings: () => (launchApp('settings') ? { ok: true, message: 'Settings' } : { ok: false }),
  cmd: () => (launchApp('terminal') ? { ok: true, message: 'Terminal' } : { ok: false }),
  terminal: () => (launchApp('terminal') ? { ok: true, message: 'Terminal' } : { ok: false }),
  taskmgr: () => (launchApp('taskmanager') ? { ok: true, message: 'Task Manager' } : { ok: false }),
  explorer: () => (launchApp('explorer', { path: ROOT_ID }) ? { ok: true, message: 'File Explorer' } : { ok: false }),
  notepad: () => (launchApp('notepad') ? { ok: true, message: 'Notepad' } : { ok: false }),
  calc: () => (launchApp('calculator') ? { ok: true, message: 'Calculator' } : { ok: false }),
  mspaint: () => (launchApp('paint') ? { ok: true, message: 'Paint' } : { ok: false }),
  paint: () => (launchApp('paint') ? { ok: true, message: 'Paint' } : { ok: false }),
  chrome: () => (launchApp('chrome') ? { ok: true, message: 'Google Chrome' } : { ok: false }),
  word: () => (launchApp('word') ? { ok: true, message: 'Word' } : { ok: false }),
  excel: () => (launchApp('excel') ? { ok: true, message: 'Excel' } : { ok: false }),
  powerpnt: () => (launchApp('powerpoint') ? { ok: true, message: 'PowerPoint' } : { ok: false }),
  powerpoint: () => (launchApp('powerpoint') ? { ok: true, message: 'PowerPoint' } : { ok: false }),
  accounting: () => (launchApp('accounting') ? { ok: true, message: 'Accounting' } : { ok: false }),
  photos: () => (launchApp('photos') ? { ok: true, message: 'Photos' } : { ok: false }),
  clock: () => (launchApp('clock') ? { ok: true, message: 'Clock' } : { ok: false }),
  calendar: () => (launchApp('calendar') ? { ok: true, message: 'Calendar' } : { ok: false }),
  notes: () => (launchApp('notes') ? { ok: true, message: 'Notes' } : { ok: false }),
  winver: () => {
    launchApp('settings', { section: 'about' });
    return { ok: true, message: 'About Windows 12 Concept' };
  },
  shutdown: () => {
    useSystemStore.getState().shutdown();
    return { ok: true, message: 'Shutting down' };
  },
  'shutdown /r': () => {
    useSystemStore.getState().restart();
    return { ok: true, message: 'Restarting' };
  },
  restart: () => {
    useSystemStore.getState().restart();
    return { ok: true, message: 'Restarting' };
  },
  logoff: () => {
    useSystemStore.getState().signOut();
    return { ok: true, message: 'Signing out' };
  },
  lock: () => {
    useSystemStore.getState().lock();
    return { ok: true, message: 'Locked' };
  },
  '.': () => {
    launchApp('explorer', { path: ROOT_ID });
    return { ok: true, message: 'This PC' };
  },
};

export function runCommand(raw: string): CommandResult {
  const input = raw.trim();
  if (!input) return { ok: false, message: 'Nothing to run' };
  const key = input.toLowerCase();

  const alias = SHELL_ALIASES[key];
  if (alias) return alias();

  const folder = SHELL_FOLDERS[key];
  if (folder) {
    if (folder === 'recycle-bin') launchApp('recyclebin');
    else launchApp('explorer', { path: folder });
    return { ok: true, message: folder };
  }

  // A path inside the virtual file system?
  const fs = useFileSystemStore.getState();
  const resolved = resolveRelativePath(fs.nodes, ROOT_ID, input);
  if (resolved) {
    openNode(fs.nodes[resolved]);
    return { ok: true, message: input };
  }

  // A registered app (by id or fuzzy name)?
  const direct = getApp(key);
  if (direct) {
    launchApp(direct.id);
    return { ok: true, message: direct.name };
  }
  const hits = searchApps(input).filter((hit) => hit.app.listed !== false);
  if (hits.length) {
    launchApp(hits[0].app.id);
    return { ok: true, message: hits[0].app.name };
  }

  return { ok: false, message: input };
}

/** Window-level commands used by keyboard shortcuts and the taskbar menu. */
export const WindowCommands = {
  minimizeActive: () => {
    const windows = useWindowStore.getState();
    const active = [...windows.windows].filter((win) => !win.minimized).sort((a, b) => b.z - a.z)[0];
    if (active) windows.minimize(active.id);
  },
  maximizeActive: () => {
    const windows = useWindowStore.getState();
    const active = [...windows.windows].filter((win) => !win.minimized).sort((a, b) => b.z - a.z)[0];
    if (active) windows.toggleMaximize(active.id);
  },
  closeActive: () => {
    const windows = useWindowStore.getState();
    const active = [...windows.windows].filter((win) => !win.minimized).sort((a, b) => b.z - a.z)[0];
    if (active) windows.closeWindow(active.id);
  },
};
