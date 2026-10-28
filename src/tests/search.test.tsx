import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SearchPill, SearchFlyout } from '../components/panels/SearchPanel';
import { useShellStore } from '../stores/shellStore';
import { useWindowStore } from '../stores/windowStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import type { FSNode } from '../types';

/**
 * The taskbar search must stay inline: focusing the pill shows nothing until
 * you type, results live in a compact flyout (never a full-height window) and
 * keyboard/outside-click dismissal works.
 */
let container: HTMLDivElement;
let root: Root;

const helloJs: FSNode = {
  id: 'file-hello',
  parentId: 'documents',
  kind: 'text',
  name: 'hello.js',
  createdAt: 1,
  updatedAt: 2,
  size: 12,
  content: 'console.log(1);',
  metadata: { mime: 'text/javascript' },
  deleted: false,
};

async function settle(ms = 40): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function dialog(): HTMLElement | null {
  return container.querySelector('div[role="dialog"]');
}

function pillInput(): HTMLInputElement {
  const input = container.querySelector('div[data-search-root] input');
  if (!input) throw new Error('taskbar search pill input missing');
  return input as HTMLInputElement;
}

function type(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  act(() => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function key(input: HTMLElement, keyName: string): void {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }));
  });
}

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  useShellStore.setState({ panel: null, searchQuery: '', searchOpen: false, searchSource: 'pill' });
  useWindowStore.setState({ windows: [], zTop: 10, showDesktop: false, hiddenByShowDesktop: [], altTab: { active: false, index: 0 }, snapPreview: null });
  useFileSystemStore.setState({ nodes: { [helloJs.id]: helloJs }, hydrated: true, usedBytes: 0, recentIds: [helloJs.id], clipboard: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <>
        <SearchPill />
        <SearchFlyout />
      </>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('inline taskbar search', () => {
  it('shows nothing when the pill is focused with an empty query', async () => {
    await settle();
    act(() => {
      pillInput().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    await settle();
    expect(useShellStore.getState().searchOpen).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('opens a compact flyout (not a full-height window) once you type', async () => {
    await settle();
    type(pillInput(), 'hello');
    await settle(180);
    const box = dialog();
    expect(box).not.toBeNull();
    expect(box!.textContent).toContain('hello.js');
    expect(box!.style.maxHeight).toContain('420px');
    expect(box!.style.width).toContain('600px');
    expect(box!.style.height).toBe('');
  });

  it('offers a web fallback row for free-text queries', async () => {
    await settle();
    type(pillInput(), 'zzz nonexistent');
    await settle(180);
    expect(dialog()!.textContent).toContain('Search the web for');
  });

  it('opens the highlighted result with Enter and closes the flyout', async () => {
    await settle();
    type(pillInput(), 'hello');
    await settle(180);
    key(pillInput(), 'Enter');
    await settle();
    expect(useShellStore.getState().searchOpen).toBe(false);
    expect(useWindowStore.getState().windows.length).toBeGreaterThanOrEqual(1);
  });

  it('dismisses with Escape and with outside pointer-down', async () => {
    await settle();
    type(pillInput(), 'hello');
    await settle(180);
    key(pillInput(), 'Escape');
    expect(useShellStore.getState().searchOpen).toBe(false);

    type(pillInput(), 'hello');
    await settle(180);
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(useShellStore.getState().searchOpen).toBe(false);
  });

  it('compact flyout with its own input + recents when opened from the small-screen button', async () => {
    await settle();
    act(() => {
      useShellStore.getState().openSearch('button');
    });
    await settle();
    const box = dialog();
    expect(box).not.toBeNull();
    expect(box!.textContent).toContain('Recently opened');
    expect(box!.textContent).toContain('hello.js');
    expect(box!.querySelector('input')).not.toBeNull();
  });
});
