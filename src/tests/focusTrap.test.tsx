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
