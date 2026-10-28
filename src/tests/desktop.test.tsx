import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Desktop } from '../components/desktop/Desktop';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useShellStore } from '../stores/shellStore';
import { useWindowStore } from '../stores/windowStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createNode, DESKTOP_ID } from '../core/FileSystem';

/** Desktop icon interaction: single click selects, double click opens. */

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function pointer(el: Element, type: string) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 10, clientY: 10 });
  act(() => {
    el.dispatchEvent(event);
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const folder = createNode({ id: 'test-folder', name: 'Projects', kind: 'folder', parentId: DESKTOP_ID });
  useFileSystemStore.setState({
    nodes: { [DESKTOP_ID]: createNode({ id: DESKTOP_ID, name: 'Desktop', kind: 'folder' }), [folder.id]: folder },
    hydrated: true,
  });
  useWindowStore.setState({ windows: [], zTop: 10 });
  useShellStore.setState({ desktopSelection: [], panel: null });
  useSettingsStore.getState().setPersonalization({ desktopIconsVisible: true, desktopIconLayout: 'auto' });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('desktop icons', () => {
  it('renders desktop icons from the file system', async () => {
    await act(async () => {
      root.render(<Desktop />);
    });
    const icon = container.querySelector('[data-node-id="test-folder"]');
    expect(icon).not.toBeNull();
  });

  it('selects on a single click without opening', async () => {
    await act(async () => {
      root.render(<Desktop />);
    });
    const icon = container.querySelector('[data-node-id="test-folder"]') as Element;
    pointer(icon, 'pointerdown');
    pointer(icon, 'pointerup');
    expect(useShellStore.getState().desktopSelection).toContain('test-folder');
    expect(useWindowStore.getState().windows).toHaveLength(0);
  });

  it('opens on a double click (two clean clicks)', async () => {
    await act(async () => {
      root.render(<Desktop />);
    });
    const icon = container.querySelector('[data-node-id="test-folder"]') as Element;
    pointer(icon, 'pointerdown');
    pointer(icon, 'pointerup');
    pointer(icon, 'pointerdown');
    pointer(icon, 'pointerup');
    const windows = useWindowStore.getState().windows;
    expect(windows).toHaveLength(1);
    expect(windows[0].appId).toBe('explorer');
  });

  it('opens when an already-selected icon is clicked again (slow double click)', async () => {
    await act(async () => {
      root.render(<Desktop />);
    });
    const icon = container.querySelector('[data-node-id="test-folder"]') as Element;
    pointer(icon, 'pointerdown');
    pointer(icon, 'pointerup');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    pointer(icon, 'pointerdown');
    pointer(icon, 'pointerup');
    const windows = useWindowStore.getState().windows;
    expect(windows).toHaveLength(1);
    expect(windows[0].appId).toBe('explorer');
  });

  it('opens in one click when the icon was selected beforehand', async () => {
    useShellStore.setState({ desktopSelection: ['test-folder'] });
    await act(async () => {
      root.render(<Desktop />);
    });
    const icon = container.querySelector('[data-node-id="test-folder"]') as Element;
    pointer(icon, 'pointerdown');
    pointer(icon, 'pointerup');
    expect(useWindowStore.getState().windows).toHaveLength(1);
  });
});
