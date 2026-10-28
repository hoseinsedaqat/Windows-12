import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WindowLayer from '../components/window/WindowLayer';
import { useWindowStore } from '../stores/windowStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import { useShellStore } from '../stores/shellStore';

/**
 * Regression tests for window chrome input: closing/minimizing via titlebar
 * buttons must work, frames must opt into pointer events explicitly, and the
 * layer must not wrap windows in a click-swallowing overlay.
 */
let container: HTMLDivElement;
let root: Root;

async function settle(ms = 40): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  useShellStore.setState({ panel: null, contextMenu: null, dialog: null });
  useWindowStore.setState({ windows: [], zTop: 10, showDesktop: false, hiddenByShowDesktop: [], altTab: { active: false, index: 0 }, snapPreview: null });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<WindowLayer />);
  });
  act(() => {
    useWindowStore.getState().openApp('notepad');
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function button(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`button[aria-label="${label}"]`);
  if (!found) throw new Error(`titlebar button not found: ${label}`);
  return found;
}

function fire(el: Element, type: string, init: { clientX?: number; clientY?: number } = {}): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 0, clientY: 0, ...init });
  Object.assign(event, { pointerId: 1, isPrimary: true, pointerType: 'mouse' });
  act(() => {
    el.dispatchEvent(event);
  });
}

describe('window chrome', () => {
  it('closes the window from the titlebar close button', async () => {
    await settle();
    expect(useWindowStore.getState().windows).toHaveLength(1);
    fire(button('Close'), 'click');
    await settle();
    expect(useWindowStore.getState().windows).toHaveLength(0);
  });

  it('minimizes the window from the titlebar minimize button', async () => {
    await settle();
    fire(button('Minimize'), 'click');
    await settle();
    expect(useWindowStore.getState().windows[0].minimized).toBe(true);
  });

  it('pins the frame to pointer-events auto so clicks always land inside apps', async () => {
    await settle();
    const frame = container.querySelector<HTMLElement>('section.window-frame');
    expect(frame).not.toBeNull();
    expect(frame!.style.pointerEvents).toBe('auto');
  });

  it('renders windows without a full-screen overlay wrapper (desktop stays clickable)', async () => {
    await settle();
    const layer = container.querySelector('section.window-frame')!.parentElement!;
    // The window's parent must be the test container itself, not an inset-0 div.
    expect(layer).toBe(container);
  });

  it('starts a titlebar drag only after real movement, leaving button clicks intact', async () => {
    await settle();
    const titlebar = container.querySelector<HTMLElement>('header.titlebar')!;
    fire(titlebar, 'pointerdown', { clientX: 100, clientY: 12 });
    expect(document.body.classList.contains('dragging-global')).toBe(false);
    fire(titlebar, 'pointermove', { clientX: 120, clientY: 30 });
    expect(document.body.classList.contains('dragging-global')).toBe(true);
    fire(titlebar, 'pointerup', { clientX: 120, clientY: 30 });
    expect(document.body.classList.contains('dragging-global')).toBe(false);
  });
});
