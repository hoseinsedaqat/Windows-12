import { beforeEach, describe, expect, it } from 'vitest';
import { useWindowStore } from '../stores/windowStore';

/** Snap layouts: fractional zones, groups, group restore. */
beforeEach(() => {
  useWindowStore.setState({
    windows: [],
    zTop: 10,
    desktop: { width: 1200, height: 800 },
    showDesktop: false,
    hiddenByShowDesktop: [],
    altTab: { active: false, index: 0 },
    snapPreview: null,
    virtualDesktops: [{ id: 'vd-main', name: 'Desktop 1' }],
    activeVirtualDesktop: 'vd-main',
  });
});

const zone = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe('snap layouts', () => {
  it('snaps a window to a fractional zone of the work area', () => {
    const store = useWindowStore.getState();
    const id = store.openApp('notepad')!;
    useWindowStore.getState().snapToZone(id, zone(0.5, 0, 0.5, 1), 'sg-1');
    const win = useWindowStore.getState().windows.find((item) => item.id === id)!;
    expect(win.bounds.x).toBe(600);
    expect(win.bounds.width).toBe(600);
    expect(win.bounds.height).toBe(800 - 52);
    expect(win.snapGroup).toBe('sg-1');
  });

  it('keeps windows of a group and restores them together', () => {
    const store = useWindowStore.getState();
    const a = store.openApp('notepad')!;
    const b = store.openApp('calculator')!;
    const state = useWindowStore.getState();
    state.snapToZone(a, zone(0, 0, 0.5, 1), 'sg-2');
    useWindowStore.getState().snapToZone(b, zone(0.5, 0, 0.5, 1), 'sg-2');
    useWindowStore.getState().minimize(a);
    useWindowStore.getState().minimize(b);
    useWindowStore.getState().restoreSnapGroup('sg-2');
    const after = useWindowStore.getState().windows;
    expect(after.every((win) => !win.minimized)).toBe(true);
  });
});
