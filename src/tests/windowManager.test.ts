import { beforeEach, describe, expect, it } from 'vitest';
import { snapBounds, TASKBAR_HEIGHT, useWindowStore, workArea } from '../stores/windowStore';
import { getApp } from '../core/ApplicationRegistry';

const DESKTOP = { width: 1440, height: 900 };

function store() {
  return useWindowStore.getState();
}

beforeEach(() => {
  // Reset to a clean session — the store persists to localStorage between tests otherwise.
  useWindowStore.setState({ windows: [], zTop: 10, showDesktop: false, hiddenByShowDesktop: [], altTab: { active: false, index: 0 }, snapPreview: null });
  store().setDesktopSize(DESKTOP);
});

describe('window manager', () => {
  it('opens an app and gives every window a unique id', () => {
    const first = store().openApp('notepad');
    const second = store().openApp('notepad');
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);

    const windows = store().windows;
    expect(windows).toHaveLength(2);
    expect(new Set(windows.map((win) => win.id)).size).toBe(2);
    expect(windows.every((win) => win.appId === 'notepad')).toBe(true);
  });

  it('refuses unknown apps', () => {
    expect(store().openApp('does-not-exist')).toBeNull();
    expect(store().windows).toHaveLength(0);
  });

  it('reuses a singleton window and focuses it, unless forceNew is set', () => {
    const app = getApp('settings');
    expect(app?.singleton).toBe(true);

    const first = store().openApp('settings');
    const again = store().openApp('settings');
    expect(again).toBe(first);
    expect(store().windows).toHaveLength(1);

    // Opening a singleton with different props reuses the window and merges props.
    store().openApp('settings', { section: 'display' });
    store().openApp('settings', { section: 'colors' });
    expect(store().windows).toHaveLength(1);
    expect(store().windows[0].props.section).toBe('colors');

    const forced = store().openApp('settings', {}, { forceNew: true });
    expect(forced).not.toBe(first);
    expect(store().windows).toHaveLength(2);
  });

  it('places windows inside the work area and clamps them', () => {
    const id = store().openApp('explorer')!;
    const win = store().windows.find((item) => item.id === id)!;
    expect(win.bounds.x).toBeGreaterThanOrEqual(0);
    expect(win.bounds.y).toBeGreaterThanOrEqual(0);
    expect(win.bounds.width).toBeLessThanOrEqual(DESKTOP.width);
    expect(win.bounds.height).toBeLessThanOrEqual(DESKTOP.height - TASKBAR_HEIGHT);

    // Dragging far off-screen still leaves a reachable title bar.
    store().setBounds(id, { x: 99999, y: 99999 });
    const moved = store().windows.find((item) => item.id === id)!;
    expect(moved.bounds.x).toBeLessThanOrEqual(DESKTOP.width - 48);
    expect(moved.bounds.y).toBeLessThanOrEqual(DESKTOP.height - TASKBAR_HEIGHT - 40);

    store().setBounds(id, { x: -99999, y: -99999 });
    const pulled = store().windows.find((item) => item.id === id)!;
    expect(pulled.bounds.x).toBeGreaterThan(-pulled.bounds.width);
    expect(pulled.bounds.y).toBeGreaterThanOrEqual(0);

    // Moving a window clears maximize/snap state.
    store().maximize(id);
    store().setBounds(id, { x: 40, y: 40 });
    const afterMove = store().windows.find((item) => item.id === id)!;
    expect(afterMove.maximized).toBe(false);
    expect(afterMove.snap).toBe('none');
  });

  it('minimizes, restores and keeps window content', () => {
    const id = store().openApp('word', { fileId: 'doc-1' })!;
    const before = store().windows.find((win) => win.id === id)!;

    store().minimize(id);
    expect(store().windows.find((win) => win.id === id)!.minimized).toBe(true);
    // The window instance survives minimising — no content loss.
    expect(store().windows.find((win) => win.id === id)!.props).toEqual(before.props);
    expect(store().windows.find((win) => win.id === id)!.bounds).toEqual(before.bounds);

    store().restoreFromMinimize(id);
    const after = store().windows.find((win) => win.id === id)!;
    expect(after.minimized).toBe(false);
    expect(after.z).toBe(store().zTop);
  });

  it('maximizes and restores the previous size', () => {
    const id = store().openApp('excel')!;
    store().setBounds(id, { x: 100, y: 80, width: 700, height: 500 });
    const restoreBounds = store().windows.find((win) => win.id === id)!.bounds;

    store().toggleMaximize(id);
    let win = store().windows.find((item) => item.id === id)!;
    expect(win.maximized).toBe(true);
    expect(win.bounds).toEqual(workArea(DESKTOP));

    store().toggleMaximize(id);
    win = store().windows.find((item) => item.id === id)!;
    expect(win.maximized).toBe(false);
    expect(win.bounds).toEqual(restoreBounds);
  });

  it('raises z-order on focus and un-minimizes', () => {
    const a = store().openApp('notepad')!;
    const b = store().openApp('terminal')!;
    expect(store().windows.find((win) => win.id === b)!.z).toBeGreaterThan(store().windows.find((win) => win.id === a)!.z);

    store().focus(a);
    const raised = store().windows.find((win) => win.id === a)!;
    expect(raised.z).toBe(store().zTop);
    expect(store().windows.find((win) => win.id === b)!.z).toBeLessThan(raised.z);

    store().minimize(a);
    store().focus(a);
    expect(store().windows.find((win) => win.id === a)!.minimized).toBe(false);
  });

  it('snaps to halves and corners and restores the previous size', () => {
    const id = store().openApp('notepad')!;
    store().setBounds(id, { x: 200, y: 120, width: 600, height: 420 });
    const previous = store().windows.find((win) => win.id === id)!.bounds;

    store().snapWindow(id, 'left');
    let win = store().windows.find((item) => item.id === id)!;
    expect(win.snap).toBe('left');
    expect(win.bounds).toEqual(snapBounds('left', DESKTOP));
    expect(win.bounds.width).toBe(Math.round(DESKTOP.width / 2));

    store().snapWindow(id, 'top-right');
    win = store().windows.find((item) => item.id === id)!;
    expect(win.snap).toBe('top-right');
    expect(win.bounds).toEqual(snapBounds('top-right', DESKTOP));
    // The unsnapped size is preserved across snap changes.
    expect(win.restoreBounds).toEqual(previous);

    store().snapWindow(id, 'none');
    win = store().windows.find((item) => item.id === id)!;
    expect(win.snap).toBe('none');
    expect(win.bounds).toEqual(previous);

    store().snapWindow(id, 'maximize');
    expect(store().windows.find((item) => item.id === id)!.maximized).toBe(true);
  });

  it('keeps snapped and maximized windows valid when the desktop is resized', () => {
    const snapped = store().openApp('notepad')!;
    store().snapWindow(snapped, 'right');
    const normal = store().openApp('terminal')!;
    store().setBounds(normal, { x: 1200, y: 700, width: 500, height: 400 });

    store().setDesktopSize({ width: 1024, height: 700 });

    const snapWin = store().windows.find((win) => win.id === snapped)!;
    expect(snapWin.bounds).toEqual(snapBounds('right', { width: 1024, height: 700 }));
    expect(snapWin.bounds.x + snapWin.bounds.width).toBeLessThanOrEqual(1024);

    const normalWin = store().windows.find((win) => win.id === normal)!;
    expect(normalWin.bounds.x).toBeLessThanOrEqual(1024 - 48);
    expect(normalWin.bounds.y).toBeLessThanOrEqual(700 - TASKBAR_HEIGHT - 40);
  });

  it('shows the desktop and brings the same windows back', () => {
    const a = store().openApp('notepad')!;
    const b = store().openApp('clock')!;
    store().minimize(b);

    store().toggleShowDesktop();
    expect(store().showDesktop).toBe(true);
    expect(store().windows.every((win) => win.minimized)).toBe(true);
    expect(store().hiddenByShowDesktop).toEqual([a]);

    store().toggleShowDesktop();
    expect(store().showDesktop).toBe(false);
    expect(store().windows.find((win) => win.id === a)!.minimized).toBe(false);
    // The window the user had minimized before stays minimized.
    expect(store().windows.find((win) => win.id === b)!.minimized).toBe(true);
  });

  it('cycles through windows with Alt+Tab order', () => {
    const a = store().openApp('notepad')!;
    const b = store().openApp('terminal')!;
    const c = store().openApp('calculator')!;

    store().cycle(1);
    expect(store().altTab.active).toBe(true);
    const order = [...store().windows].sort((x, y) => y.z - x.z).map((win) => win.id);
    expect(store().altTab.index).toBe(1);

    store().cycle(1);
    expect(store().altTab.index).toBe(2);
    store().cycle(-1);
    expect(store().altTab.index).toBe(1);

    store().setAltTab(false);
    expect(store().altTab.active).toBe(false);
    const focusedId = order[1];
    expect(store().windows.find((win) => win.id === focusedId)!.z).toBe(store().zTop);
    expect([a, b, c]).toContain(focusedId);
  });

  it('closes one window, ends a whole app, and closes everything', () => {
    const a = store().openApp('notepad')!;
    const b = store().openApp('notepad')!;
    const c = store().openApp('terminal')!;

    store().closeWindow(a);
    expect(store().windows.map((win) => win.id)).toEqual([b, c]);

    store().endTask('notepad');
    expect(store().windows.map((win) => win.id)).toEqual([c]);

    store().openApp('clock');
    store().closeAllWindows();
    expect(store().windows).toHaveLength(0);
    expect(store().showDesktop).toBe(false);
  });

  it('updates titles and props without recreating the window', () => {
    const id = store().openApp('word')!;
    store().setWindowTitle(id, 'Report.docx •');
    expect(store().windows.find((win) => win.id === id)!.title).toBe('Report.docx •');

    store().setWindowProps(id, { fileId: 'f-1' });
    store().setWindowProps(id, { dirty: true });
    expect(store().windows.find((win) => win.id === id)!.props).toEqual({ fileId: 'f-1', dirty: true });
    expect(store().windows).toHaveLength(1);
  });

  it('pins and unpins taskbar apps', () => {
    const pinnedBefore = store().pinnedApps.length;
    store().togglePin('clock');
    expect(store().pinnedApps).toContain('clock');
    expect(store().pinnedApps).toHaveLength(pinnedBefore + 1);
    store().togglePin('clock');
    expect(store().pinnedApps).not.toContain('clock');
  });

  it('lists windows per app and exposes the snap preview', () => {
    const a = store().openApp('notepad')!;
    store().openApp('notepad');
    expect(store().windowsForApp('notepad')).toHaveLength(2);
    expect(store().windowsForApp('notepad').map((win) => win.id)).toContain(a);
    expect(store().windowsForApp('clock')).toHaveLength(0);

    store().setSnapPreview({ position: 'left', windowId: a });
    expect(store().snapPreview?.windowId).toBe(a);
    store().snapWindow(a, 'left');
    expect(store().snapPreview).toBeNull();
  });

  it('computes the work area from the taskbar height', () => {
    expect(workArea(DESKTOP)).toEqual({ x: 0, y: 0, width: 1440, height: 900 - TASKBAR_HEIGHT });
    expect(snapBounds('left', DESKTOP).width).toBe(720);
    expect(snapBounds('right', DESKTOP).x).toBe(720);
    expect(snapBounds('bottom-left', DESKTOP).y).toBeGreaterThan(0);
  });
});
