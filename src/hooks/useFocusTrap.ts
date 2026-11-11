import { useEffect, useRef, type RefObject } from 'react';

const AUTOFOCUS_SELECTOR = '[data-autofocus]';
const FIELD_SELECTOR = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Traps keyboard focus inside a container while `active`:
 * - focuses the first focusable element on activation
 * - wraps Tab / Shift+Tab at the container edges
 * - calls onEscape when Escape is pressed
 * - restores focus to the previously focused element on cleanup
 */
export function useFocusTrap<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: { active?: boolean; onEscape?: () => void } = {},
) {
  const { active = true, onEscape } = options;

  // Callers pass inline callbacks; keeping the latest one in a ref lets the
  // effect below depend only on `active`. Re-running it on every render used
  // to yank focus back to the dialog's first button while the user typed.
  const escapeRef = useRef(onEscape);
  useEffect(() => {
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    // Prefer an explicit autofocus target, then the first real field, so the
    // close button never receives the initial focus of a form dialog.
    const initial =
      node.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR) ??
      node.querySelector<HTMLElement>(FIELD_SELECTOR) ??
      focusables()[0];
    if (initial) initial.focus();
    else node.setAttribute('tabindex', '-1'), node.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (escapeRef.current) {
          event.stopPropagation();
          escapeRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      const inside = activeElement !== null && node.contains(activeElement);
      if (event.shiftKey && (!inside || activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ref]);
}
