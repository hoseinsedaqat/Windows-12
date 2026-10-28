import { useEffect, useRef } from 'react';
import { useWindowStore } from '../stores/windowStore';
import { useShellStore } from '../stores/shellStore';
import { useSystemStore } from '../stores/systemStore';
import { launchApp } from '../services/launcher';
import { playSound } from '../services/sound';

/**
 * Global keyboard shortcuts.
 *
 * Browsers and operating systems reserve some combinations (Win+L, Alt+Tab,
 * Ctrl+Shift+Esc …), so every shortcut also has a browser-friendly alias.
 * Text-entry surfaces keep normal typing behaviour: only modifier combos and
 * Escape are handled while an input has focus.
 */

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}

function activeWindowId(): string | null {
  const state = useWindowStore.getState();
  const visible = state.windows.filter((win) => !win.minimized);
  if (!visible.length) return null;
  return visible.reduce((top, win) => (win.z > top.z ? win : top), visible[0]).id;
}

export function useShellShortcuts(enabled: boolean): void {
  const metaAlone = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target);
      const key = event.key.toLowerCase();
      const meta = event.metaKey;
      const ctrl = event.ctrlKey;
      const alt = event.altKey;
      const shift = event.shiftKey;

      // Track a lone Meta press so releasing it opens Start (when the OS lets us see it).
      if (key === 'meta' && !ctrl && !alt && !shift) {
        metaAlone.current = true;
        return;
      }
      if (metaAlone.current && (ctrl || alt || shift)) metaAlone.current = false;

      const combo = (letters: string[], withMeta: boolean, withCtrlAlt: boolean) =>
        letters.includes(key) && ((withMeta && meta) || (withCtrlAlt && ctrl && alt));

      // Escape closes transient surfaces everywhere.
      if (key === 'escape') {
        const shell = useShellStore.getState();
        if (shell.contextMenu) {
          shell.closeContextMenu();
          event.preventDefault();
          return;
        }
        if (shell.dialog) {
          shell.cancelDialog();
          event.preventDefault();
          return;
        }
        if (shell.propertiesNodeId) {
          shell.setProperties(null);
          event.preventDefault();
          return;
        }
        if (shell.panel) {
          shell.closePanels();
          event.preventDefault();
          return;
        }
        if (useWindowStore.getState().altTab.active) {
          useWindowStore.getState().setAltTab(false);
          event.preventDefault();
        }
        return;
      }

      if (typing && !meta && !(ctrl && alt)) return;

      // Start menu: Win, Ctrl+Esc
      if ((metaAlone.current && key === 'meta') || (ctrl && key === 'escape')) {
        event.preventDefault();
        useShellStore.getState().togglePanel('start');
        playSound('click');
        return;
      }

      if (combo(['e'], true, true)) {
        event.preventDefault();
        launchApp('explorer', {});
        useShellStore.getState().closePanels();
        return;
      }
      if (combo(['l'], true, true)) {
        event.preventDefault();
        useSystemStore.getState().lock();
        return;
      }
      if (combo(['i'], true, true)) {
        event.preventDefault();
        launchApp('settings');
        useShellStore.getState().closePanels();
        return;
      }
      if (combo(['r'], true, true)) {
        event.preventDefault();
        launchApp('run');
        useShellStore.getState().closePanels();
        return;
      }
      if (combo(['d'], true, true)) {
        event.preventDefault();
        playSound('minimize');
        useWindowStore.getState().toggleShowDesktop();
        return;
      }
      if (combo(['s'], true, true)) {
        event.preventDefault();
        useShellStore.getState().openSearch('button');
        return;
      }
      if ((ctrl && shift && key === 'escape') || (ctrl && alt && key === 't')) {
        event.preventDefault();
        launchApp('taskmanager');
        return;
      }

      // Alt+Tab (and browser-friendly Ctrl+Alt+Tab) window cycling.
      if ((alt && !ctrl && key === 'tab') || (ctrl && alt && key === 'tab')) {
        event.preventDefault();
        useWindowStore.getState().cycle(shift ? -1 : 1);
        return;
      }

      // Window snapping: Win+Arrow / Ctrl+Alt+Arrow
      if (combo(['arrowleft', 'arrowright', 'arrowup', 'arrowdown'], true, true)) {
        const id = activeWindowId();
        if (!id) return;
        event.preventDefault();
        const store = useWindowStore.getState();
        if (key === 'arrowleft') store.snapWindow(id, alt || shift ? 'top-left' : 'left');
        else if (key === 'arrowright') store.snapWindow(id, alt || shift ? 'top-right' : 'right');
        else if (key === 'arrowup') store.maximize(id);
        else store.restore(id);
        playSound('snap');
        return;
      }

      // Ctrl+Alt+W closes the active window (browsers reserve Ctrl+W).
      if (ctrl && alt && key === 'w') {
        const id = activeWindowId();
        if (id) {
          event.preventDefault();
          useWindowStore.getState().closeWindow(id);
          playSound('close');
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Meta' && metaAlone.current) {
        metaAlone.current = false;
        useShellStore.getState().togglePanel('start');
        playSound('click');
      }
    };

    const onBlur = () => {
      metaAlone.current = false;
      const store = useWindowStore.getState();
      if (store.altTab.active) store.setAltTab(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled]);
}

/** Human-readable list rendered in Settings → Keyboard. */
export const SHORTCUT_LIST: { keys: string; action: string; actionFa: string }[] = [
  { keys: 'Win / Ctrl+Esc', action: 'Open or close Start', actionFa: 'باز و بسته کردن منوی شروع' },
  { keys: 'Win+E / Ctrl+Alt+E', action: 'File Explorer', actionFa: 'مدیریت فایل' },
  { keys: 'Win+I / Ctrl+Alt+I', action: 'Settings', actionFa: 'تنظیمات' },
  { keys: 'Win+R / Ctrl+Alt+R', action: 'Run', actionFa: 'پنجره اجرا' },
  { keys: 'Win+L / Ctrl+Alt+L', action: 'Lock the simulator', actionFa: 'قفل کردن شبیه‌ساز' },
  { keys: 'Win+D / Ctrl+Alt+D', action: 'Show desktop', actionFa: 'نمایش دسکتاپ' },
  { keys: 'Win+S / Ctrl+Alt+S', action: 'Search', actionFa: 'جست‌وجو' },
  { keys: 'Alt+Tab', action: 'Switch apps', actionFa: 'جابجایی بین برنامه‌ها' },
  { keys: 'Win+← / →', action: 'Snap window left / right', actionFa: 'چسباندن پنجره به چپ یا راست' },
  { keys: 'Win+↑ / ↓', action: 'Maximize / restore window', actionFa: 'بزرگ‌نمایی یا بازگرداندن پنجره' },
  { keys: 'Ctrl+Shift+Esc / Ctrl+Alt+T', action: 'Task Manager', actionFa: 'مدیر وظایف' },
  { keys: 'Ctrl+Alt+W', action: 'Close active window', actionFa: 'بستن پنجره فعال' },
  { keys: 'F2', action: 'Rename selected item', actionFa: 'تغییر نام مورد انتخاب‌شده' },
  { keys: 'Delete', action: 'Move selection to Recycle Bin', actionFa: 'انتقال به سطل بازیافت' },
  { keys: 'Ctrl+A', action: 'Select all items', actionFa: 'انتخاب همه' },
  { keys: 'Escape', action: 'Close menus and panels', actionFa: 'بستن منوها و پنل‌ها' },
];
