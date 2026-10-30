import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMenuHost } from '../components/menu/ContextMenu';
import { useShellStore } from '../stores/shellStore';
import type { ContextMenuItem } from '../types';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<ContextMenuHost />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  useShellStore.setState({ contextMenu: null });
});

const open = (items: ContextMenuItem[]) => {
  act(() => {
    useShellStore.getState().openContextMenu({ x: 120, y: 80, items });
  });
};

describe('context menu host', () => {
  it('survives pointerdown inside the menu so item clicks still fire', () => {
    const action = vi.fn();
    open([{ id: 'a', label: 'Act', action }]);
    const button = container.querySelector('button[role="menuitem"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    act(() => {
      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });
    expect(useShellStore.getState().contextMenu).not.toBeNull();
    act(() => {
      button.click();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(useShellStore.getState().contextMenu).toBeNull();
  });

  it('closes on pointerdown outside the menu', () => {
    open([{ id: 'a', label: 'Act' }]);
    act(() => {
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });
    expect(useShellStore.getState().contextMenu).toBeNull();
  });

  it('opens submenus anchored beside the parent item (absolute, not fixed)', () => {
    open([
      { id: 'sub', label: 'Parent', submenu: [{ id: 's1', label: 'Child', action: () => undefined }] },
    ]);
    const parentButton = container.querySelector('button[role="menuitem"]') as HTMLButtonElement;
    act(() => {
      parentButton.click();
    });
    const surfaces = container.querySelectorAll('[data-context-menu-surface]');
    expect(surfaces.length).toBe(2);
    const nested = surfaces[1] as HTMLElement;
    expect(nested.className).toContain('absolute');
    expect(nested.className).not.toContain('fixed');
    // the wrapper anchors it to the inline-end edge of the parent row
    const wrapper = nested.parentElement as HTMLElement;
    expect(wrapper.className).toContain('absolute');
    expect(wrapper.style.insetInlineStart === '100%' || wrapper.style.insetInlineEnd === '100%').toBe(true);
  });
});
