import { beforeEach, describe, expect, it } from 'vitest';
import { desktopOf, useWindowStore, windowsOnDesktop } from '../stores/windowStore';

/** Virtual desktops: isolation, switching, moving windows, removal merge. */
beforeEach(() => {
  useWindowStore.setState({
    windows: [],
    zTop: 10,
    showDesktop: false,
    hiddenByShowDesktop: [],
    altTab: { active: false, index: 0 },
    snapPreview: null,
    virtualDesktops: [{ id: 'vd-main', name: 'Desktop 1' }],
    activeVirtualDesktop: 'vd-main',
  });
});

describe('virtual desktops', () => {
  it('opens apps on the active desktop', () => {
    const store = useWindowStore.getState();
    store.openApp('notepad');
    expect(desktopOf(useWindowStore.getState().windows[0]!)).toBe('vd-main');
  });

  it('isolates windows per desktop and switches between them', () => {
    const store = useWindowStore.getState();
    store.openApp('notepad');
    const second = store.addVirtualDesktop();
    expect(useWindowStore.getState().activeVirtualDesktop).toBe(second);
    useWindowStore.getState().openApp('calculator');
    const state = useWindowStore.getState();
    expect(windowsOnDesktop(state, 'vd-main').map((win) => win.appId)).toEqual(['notepad']);
    expect(windowsOnDesktop(state, second).map((win) => win.appId)).toEqual(['calculator']);
    useWindowStore.getState().switchVirtualDesktop('vd-main');
    expect(useWindowStore.getState().activeVirtualDesktop).toBe('vd-main');
  });

  it('moves a window between desktops', () => {
    const store = useWindowStore.getState();
    const id = store.openApp('notepad')!;
    const second = store.addVirtualDesktop();
    useWindowStore.getState().moveWindowToDesktop(id, second);
    expect(desktopOf(useWindowStore.getState().windows[0]!)).toBe(second);
  });

  it('removing a desktop merges its windows into the neighbour', () => {
    const store = useWindowStore.getState();
    store.openApp('notepad');
    const second = store.addVirtualDesktop();
    useWindowStore.getState().openApp('calculator');
    useWindowStore.getState().removeVirtualDesktop(second);
    const state = useWindowStore.getState();
    expect(state.virtualDesktops).toHaveLength(1);
    expect(state.activeVirtualDesktop).toBe('vd-main');
    expect(windowsOnDesktop(state, 'vd-main')).toHaveLength(2);
  });

  it('never removes the last desktop', () => {
    useWindowStore.getState().removeVirtualDesktop('vd-main');
    expect(useWindowStore.getState().virtualDesktops).toHaveLength(1);
  });
});
