import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { useSystemStore } from '../stores/systemStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useWindowStore } from '../stores/windowStore';
import { useShellStore } from '../stores/shellStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import { openNode } from '../services/launcher';

/**
 * Regression: every seeded file (docs, sheets, slides, text, notes, images,
 * shortcuts) must open in its app without tripping the error boundary.
 */
let container: HTMLDivElement;
let root: Root;

async function settle(ms = 80): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  localStorage.clear();
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  useSystemStore.setState({ power: 'off', bootStage: 'blank', bootProgress: 0 });
  useWindowStore.setState({ windows: [], zTop: 10, showDesktop: false, hiddenByShowDesktop: [], altTab: { active: false, index: 0 }, snapPreview: null });
  useShellStore.setState({ panel: null, contextMenu: null, dialog: null, propertiesNodeId: null, desktopSelection: [], explorerSelection: [], dragging: false, searchQuery: '', searchOpen: false, searchSource: 'pill' });
  useFileSystemStore.setState({ nodes: {}, hydrated: false, usedBytes: 0, recentIds: [], clipboard: null });
  await useFileSystemStore.getState().hydrate();
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe('open every seeded file', () => {
  it('no error boundary for any node', async () => {
    await settle(120);
    await act(async () => {
      useSystemStore.getState().unlock();
    });
    await settle(150);
    const nodes = Object.values(useFileSystemStore.getState().nodes).filter(
      (node) => node && !node.deleted && node.kind !== 'folder',
    );
    const bad: string[] = [];
    for (const node of nodes) {
      await act(async () => {
        openNode(node);
      });
      await settle(120);
      if ((container.textContent ?? '').includes('Something went wrong')) {
        bad.push(`${node.kind}:${node.name}`);
        // dismiss the crashed window to keep going
        const wins = useWindowStore.getState().windows;
        if (wins.length) {
          await act(async () => {
            useWindowStore.getState().closeWindow(wins[wins.length - 1].id);
          });
        }
      }
    }
    console.log('OPENED', nodes.length, 'NODES; BAD:', bad.join(', ') || 'none');
    expect(bad).toEqual([]);
  }, 120000);
});
