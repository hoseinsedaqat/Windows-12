import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

// @ts-expect-error test env flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function TrapDemo({ onEscape }: { onEscape: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap(ref, { onEscape });
  return (
    <div ref={ref} data-testid="trap">
      <button id="first" type="button">first</button>
      <button id="second" type="button">second</button>
      <button id="last" type="button">last</button>
    </div>
  );
}

/** Mirrors the Accounting "New contact" dialog: close button first in DOM,
 *  then form fields; typing re-renders the dialog with a fresh inline
 *  onEscape callback every time. */
function FormDialog({ value, onChange, onClose }: { value: string; onChange: (next: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap(ref, { onEscape: onClose });
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <button id="close" type="button" onClick={onClose} aria-label="Close">
        x
      </button>
      <input id="name" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

describe('useFocusTrap', () => {
  let container: HTMLDivElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('focuses the first element and wraps Tab at the edges', async () => {
    let escaped = 0;
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrapDemo onEscape={() => { escaped += 1; }} />);
    });
    expect(document.activeElement?.id).toBe('first');

    const tab = (shift = false) => {
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true }));
      });
    };
    // focus last, press Tab -> wraps to first
    (document.getElementById('last') as HTMLElement).focus();
    tab(false);
    expect(document.activeElement?.id).toBe('first');
    // from first, Shift+Tab -> wraps to last
    tab(true);
    expect(document.activeElement?.id).toBe('last');

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(escaped).toBe(1);
    await act(async () => root.unmount());
  });

  it('keeps focus in the field while typing re-renders the dialog (accounting regression)', async () => {
    let value = '';
    const root = createRoot(container);
    const render = async () => {
      await act(async () => {
        root.render(
          <FormDialog
            value={value}
            onChange={(next) => {
              value = next;
              void render();
            }}
            onClose={() => undefined}
          />,
        );
      });
    };
    await render();
    // initial focus goes to the first field, not the close button
    expect(document.activeElement?.id).toBe('name');

    const input = document.getElementById('name') as HTMLInputElement;
    await act(async () => {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // simulate the user typing a character (state update -> re-render with a
    // brand-new inline onEscape, exactly like the Accounting modal)
    value = 's';
    await render();
    expect(document.activeElement?.id).toBe('name');
    value = 'st';
    await render();
    expect(document.activeElement?.id).toBe('name');
    await act(async () => root.unmount());
  });

  it('restores focus to the previously focused element on unmount', async () => {
    const outside = document.createElement('button');
    outside.id = 'outside';
    document.body.appendChild(outside);
    outside.focus();
    const root = createRoot(container);
    await act(async () => {
      root.render(<TrapDemo onEscape={() => undefined} />);
    });
    expect(document.activeElement?.id).toBe('first');
    await act(async () => root.unmount());
    expect(document.activeElement?.id).toBe('outside');
  });
});
