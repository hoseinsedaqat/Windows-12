import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { useSystemStore } from '../stores/systemStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useWindowStore } from '../stores/windowStore';
import { useShellStore } from '../stores/shellStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import { useQuickSettingsStore } from '../stores/quickSettingsStore';
import { DESKTOP_ID } from '../core/FileSystem';

/**
 * Integration smoke test: renders the real shell (boot → desktop → windows →
 * panels) and asserts that nothing crashes into the error boundary.
 */
let container: HTMLDivElement;
let root: Root;

function text(): string {
  return container.textContent ?? '';
}

async function settle(ms = 60): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeAll(async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(async () => {
  localStorage.clear();
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  useSystemStore.setState({ power: 'off', bootStage: 'blank', bootProgress: 0 });
  useWindowStore.setState({ windows: [], zTop: 10, showDesktop: false, hiddenByShowDesktop: [], altTab: { active: false, index: 0 }, snapPreview: null });
  useShellStore.setState({ panel: null, contextMenu: null, dialog: null, propertiesNodeId: null, desktopSelection: [], explorerSelection: [], dragging: false });
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

describe('shell integration', () => {
  it('boots without crashing and reaches the lock screen', async () => {
    await settle(120);
    expect(text()).not.toContain('Something went wrong');
    // Boot is running (or already finished into the lock screen).
    expect(useSystemStore.getState().power).not.toBe('off');

    await act(async () => {
      useSystemStore.getState().setPower('lock');
    });
    await settle();
    expect(text()).not.toContain('Something went wrong');
    expect(useSystemStore.getState().power).toBe('lock');
  });

  it('signs in and renders the desktop with icons and the taskbar', async () => {
    await act(async () => {
      useSystemStore.getState().unlock();
    });
    await settle(150);

    expect(useSystemStore.getState().power).toBe('desktop');
    expect(text()).not.toContain('Something went wrong');
    expect(container.querySelector('[aria-label="Taskbar"]')).toBeTruthy();
    // Seeded desktop icons are rendered from the real file system.
    const icons = useFileSystemStore.getState().childrenOf(DESKTOP_ID);
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons.slice(0, 3)) {
      expect(text()).toContain(icon.name.replace(/\.[a-z0-9]+$/i, ''));
    }
  });

  it('opens, focuses, minimizes and closes real app windows', async () => {
    await act(async () => {
      useSystemStore.getState().unlock();
    });
    await settle(80);

    let calculatorId: string | null = null;
    let notepadId: string | null = null;
    await act(async () => {
      calculatorId = useWindowStore.getState().openApp('calculator');
      notepadId = useWindowStore.getState().openApp('notepad');
    });
    await settle(250);

    expect(calculatorId).toBeTruthy();
    expect(notepadId).toBeTruthy();
    expect(useWindowStore.getState().windows).toHaveLength(2);
    expect(text()).not.toContain('Something went wrong');
    // The lazily loaded app content is on screen.
    expect(text()).toMatch(/Calculator|Machine|حساب/);

    await act(async () => {
      useWindowStore.getState().minimize(calculatorId!);
    });
    await settle();
    expect(useWindowStore.getState().windows.find((win) => win.id === calculatorId)!.minimized).toBe(true);

    await act(async () => {
      useWindowStore.getState().focus(notepadId!);
      useWindowStore.getState().toggleMaximize(notepadId!);
    });
    await settle();
    const notepad = useWindowStore.getState().windows.find((win) => win.id === notepadId)!;
    expect(notepad.maximized).toBe(true);
    expect(notepad.z).toBe(useWindowStore.getState().zTop);

    await act(async () => {
      useWindowStore.getState().closeWindow(calculatorId!);
    });
    await settle();
    expect(useWindowStore.getState().windows.map((win) => win.id)).toEqual([notepadId]);
    expect(text()).not.toContain('Something went wrong');
  });

  it('opens the heavy document and business apps without crashing', async () => {
    await act(async () => {
      useSystemStore.getState().unlock();
    });
    await settle(60);

    for (const appId of ['explorer', 'settings', 'accounting', 'excel', 'word', 'chrome', 'terminal']) {
      await act(async () => {
        useWindowStore.getState().openApp(appId);
      });
      await settle(120);
      expect(text(), appId).not.toContain('Something went wrong');
    }
    expect(useWindowStore.getState().windows.length).toBeGreaterThanOrEqual(6);
  });

  it('shows the shell panels: start, quick settings, notifications, task view', async () => {
    await act(async () => {
      useSystemStore.getState().unlock();
    });
    await settle(80);

    for (const panel of ['start', 'quick', 'notifications', 'taskview', 'calendar'] as const) {
      await act(async () => {
        useShellStore.getState().setPanel(panel);
      });
      await settle(60);
      expect(useShellStore.getState().panel).toBe(panel);
      expect(text(), panel).not.toContain('Something went wrong');
    }

    await act(async () => {
      useShellStore.getState().setPanel(null);
    });
    expect(useShellStore.getState().panel).toBeNull();
  });

  it('applies brightness, theme and language changes live', async () => {
    await act(async () => {
      useSystemStore.getState().unlock();
    });
    await settle(60);

    await act(async () => {
      useSettingsStore.getState().setDisplay({ brightness: 30, nightLight: true });
      useSettingsStore.getState().setTheme('dark');
      useSettingsStore.getState().setAccent('#22c55e');
    });
    await settle();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()).toBe('#22c55e');
    expect(text()).not.toContain('Something went wrong');

    await act(async () => {
      useSettingsStore.getState().setLanguage('fa');
    });
    await settle();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('fa');

    await act(async () => {
      useSettingsStore.getState().setLanguage('en');
      useSettingsStore.getState().setDisplay({ brightness: 100, nightLight: false });
    });
    await settle();
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('opens a context menu and a dialog through the shell store', async () => {
    await act(async () => {
      useSystemStore.getState().unlock();
    });
    await settle(60);

    await act(async () => {
      useShellStore.getState().openContextMenu({
        x: 100,
        y: 100,
        items: [{ id: 'one', label: 'Test entry' }],
      });
    });
    await settle();
    expect(text()).toContain('Test entry');

    await act(async () => {
      useShellStore.getState().openDialog({ kind: 'alert', title: 'Hello dialog', message: 'Dialog body text' });
    });
    await settle();
    expect(text()).toContain('Hello dialog');
    expect(text()).toContain('Dialog body text');
    expect(useShellStore.getState().dialog).toBeTruthy();

    await act(async () => {
      useShellStore.getState().closeDialog();
      useShellStore.getState().closeContextMenu();
    });
    await settle();
    expect(useShellStore.getState().dialog).toBeNull();
    expect(useShellStore.getState().contextMenu).toBeNull();
    expect(text()).not.toContain('Hello dialog');
    expect(text()).not.toContain('Something went wrong');
  });

  it('keeps quick settings consistent with the settings store', async () => {
    await act(async () => {
      useSystemStore.getState().unlock();
      useShellStore.getState().setPanel('quick');
    });
    await settle(120);

    // Tiles control what the quick panel shows; the radios live in the settings store.
    const before = useQuickSettingsStore.getState().tiles.length;
    await act(async () => {
      useQuickSettingsStore.getState().toggleTile('project');
    });
    await settle();
    expect(useQuickSettingsStore.getState().tiles).toHaveLength(before + 1);
    await act(async () => {
      useQuickSettingsStore.getState().toggleTile('project');
    });
    await settle();
    expect(useQuickSettingsStore.getState().tiles).toHaveLength(before);

    // Flipping the real setting is reflected everywhere (Quick Settings ↔ Settings app).
    const wifi = useSettingsStore.getState().settings.network.wifiEnabled;
    await act(async () => {
      useSettingsStore.getState().setNetwork({ wifiEnabled: !wifi });
    });
    await settle();
    expect(useSettingsStore.getState().settings.network.wifiEnabled).toBe(!wifi);
    expect(text()).not.toContain('Something went wrong');
  });
});
