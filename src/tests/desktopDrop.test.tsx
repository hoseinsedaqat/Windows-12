import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Desktop } from '../components/desktop/Desktop';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useShellStore } from '../stores/shellStore';
import { useWindowStore } from '../stores/windowStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createNode, DESKTOP_ID, getChildren } from '../core/FileSystem';

/** Dropping real OS files onto the desktop imports them into the VFS. */
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function dragEvent(type: string, files: File[] = []): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { dataTransfer: { files, types: files.length ? ['Files'] : [] } });
  return event;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useFileSystemStore.setState({
    nodes: { [DESKTOP_ID]: createNode({ id: DESKTOP_ID, name: 'Desktop', kind: 'folder' }) },
    hydrated: true,
    recentIds: [],
  });
  useWindowStore.setState({ windows: [], zTop: 10, virtualDesktops: [{ id: 'vd-main', name: 'Desktop 1' }], activeVirtualDesktop: 'vd-main' });
  useShellStore.setState({ desktopSelection: [], panel: null });
  useSettingsStore.getState().setPersonalization({ desktopIconsVisible: true, desktopIconLayout: 'auto' });
  act(() => {
    root.render(<Desktop />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('desktop file drop', () => {
  it('shows the drop hint while dragging files over', () => {
    act(() => {
      container
        .querySelector('[data-testid="desktop-surface"]')!
        .dispatchEvent(dragEvent('dragover', [new File(['x'], 'hover.txt', { type: 'text/plain' })]));
    });
    expect(container.textContent).toContain('Drop to save on the Desktop');
  });

  it('imports dropped files into the desktop folder', async () => {
    const surface = container.querySelector('[data-testid="desktop-surface"]')!;
    const file = new File(['console.log(1);'], 'dropped.txt', { type: 'text/plain' });
    await act(async () => {
      surface.dispatchEvent(dragEvent('drop', [file]));
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    const names = getChildren(useFileSystemStore.getState().nodes, DESKTOP_ID).map((node) => node.name);
    expect(names).toContain('dropped.txt');
  });
});
