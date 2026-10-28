import { useCallback, useEffect, useRef, useState } from 'react';

/** Live clock — re-renders on an interval while mounted. */
export function useClock(intervalMs = 1000): Date {
  const [value, setValue] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setValue(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return value;
}

/** Measures an element with ResizeObserver and cleans the observer up. */
export function useElementSize<T extends HTMLElement>(): [React.RefObject<T>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((previous) =>
        Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5
          ? previous
          : { width, height },
      );
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

/** Debounced value — used for search boxes and auto-save. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Calls back whenever the value changes, but not on the first render. */
export function useEffectOnUpdate(effect: () => void, deps: unknown[]): void {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Closes something when a pointer-down happens outside of it. */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void, active = true): React.RefObject<T> {
  const ref = useRef<T>(null);
  const saved = useRef(onOutside);
  saved.current = onOutside;

  useEffect(() => {
    if (!active) return;
    const handler = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && ref.current && !ref.current.contains(target)) saved.current();
    };
    // Capture phase so the panel closes before other handlers run.
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [active]);

  return ref;
}

/** Interval that can be paused; used by Clock, timers and the battery indicator. */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (delayMs === null) return;
    const id = window.setInterval(() => saved.current(), delayMs);
    return () => window.clearInterval(id);
  }, [delayMs]);
}

/** Stable callback identity without re-subscribing effects. */
export function useEvent<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}
