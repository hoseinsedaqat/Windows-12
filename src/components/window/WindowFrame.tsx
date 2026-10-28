import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Minus, Square, Copy, X, Grid2x2, RefreshCw } from 'lucide-react';
import type { SnapPosition, WindowBounds, WindowInstance } from '../../types';
import { useWindowStore, snapBounds, workArea } from '../../stores/windowStore';
import { getApp } from '../../core/ApplicationRegistry';
import { getAppComponent } from '../../applications/registry';
import { AppIcon } from '../icons/AppIcons';
import { ErrorBoundary } from '../system/ErrorBoundary';
import { useShellStore } from '../../stores/shellStore';
import { useT } from '../../i18n';
import { playSound } from '../../services/sound';
import { useSettingsStore } from '../../stores/settingsStore';

type ResizeDirection = 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';

const SNAP_LAYOUTS: { id: string; zones: SnapPosition[]; label: string }[] = [
  { id: 'halves', zones: ['left', 'right'], label: '1/2 + 1/2' },
  { id: 'quarters', zones: ['top-left', 'top-right', 'bottom-left', 'bottom-right'], label: '1/4 ×4' },
];

interface Props {
  window: WindowInstance;
}

export function WindowFrame({ window: win }: Props) {
  const { t } = useT();
  const app = getApp(win.appId);
  const desktop = useWindowStore((state) => state.desktop);
  const focus = useWindowStore((state) => state.focus);
  const minimize = useWindowStore((state) => state.minimize);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const setBounds = useWindowStore((state) => state.setBounds);
  const snapWindow = useWindowStore((state) => state.snapWindow);
  const setSnapPreview = useWindowStore((state) => state.setSnapPreview);
  const openContextMenu = useShellStore((state) => state.openContextMenu);
  const animations = useSettingsStore((state) => state.settings.display.animations);

  const [liveBounds, setLiveBounds] = useState<WindowBounds | null>(null);
  const [snapHint, setSnapHint] = useState<SnapPosition | null>(null);
  const [layoutsOpen, setLayoutsOpen] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const dragState = useRef<{
    mode: 'move' | ResizeDirection;
    startX: number;
    startY: number;
    origin: WindowBounds;
    pointerId: number;
    frame: number | null;
    pending: WindowBounds | null;
  } | null>(null);

  const bounds = liveBounds ?? win.bounds;
  const Component = useMemo(() => getAppComponent(win.appId), [win.appId]);
  const isMaximized = win.maximized;

  const stop = useCallback(() => {
    const state = dragState.current;
    if (!state) return;
    if (state.frame) cancelAnimationFrame(state.frame);
    dragState.current = null;
    document.body.classList.remove('dragging-global');
    setSnapPreview(null);
    setSnapHint(null);
  }, [setSnapPreview]);

  const commitDrag = useCallback(() => {
    const state = dragState.current;
    if (!state) return;
    if (state.mode === 'move' && snapHint && snapHint !== 'none') {
      playSound('snap');
      snapWindow(win.id, snapHint);
      setLiveBounds(null);
    } else if (state.pending) {
      setBounds(win.id, state.pending);
      setLiveBounds(null);
    }
    stop();
  }, [snapHint, snapWindow, win.id, setBounds, stop]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const state = dragState.current;
      if (!state || event.pointerId !== state.pointerId) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      let next: WindowBounds = { ...state.origin };

      if (state.mode === 'move') {
        next = { ...state.origin, x: state.origin.x + dx, y: state.origin.y + dy };
        const area = workArea(desktop);
        let hint: SnapPosition | null = null;
        if (event.clientY <= 4) hint = 'maximize';
        else if (event.clientX <= 4) hint = event.clientY > area.height * 0.72 ? 'bottom-left' : event.clientY < area.height * 0.28 ? 'top-left' : 'left';
        else if (event.clientX >= desktop.width - 4)
          hint = event.clientY > area.height * 0.72 ? 'bottom-right' : event.clientY < area.height * 0.28 ? 'top-right' : 'right';
        if (hint !== snapHint) {
          setSnapHint(hint);
          setSnapPreview(hint ? { position: hint, windowId: win.id } : null);
        }
      } else {
        const dir = state.mode;
        if (dir.includes('e')) next.width = Math.max(app?.minSize.width ?? 320, state.origin.width + dx);
        if (dir.includes('s')) next.height = Math.max(app?.minSize.height ?? 240, state.origin.height + dy);
        if (dir.includes('w')) {
          const width = Math.max(app?.minSize.width ?? 320, state.origin.width - dx);
          next = { ...next, width, x: state.origin.x + (state.origin.width - width) };
        }
        if (dir.includes('n')) {
          const height = Math.max(app?.minSize.height ?? 240, state.origin.height - dy);
          next = { ...next, height, y: state.origin.y + (state.origin.height - height) };
        }
      }

      state.pending = next;
      if (state.frame === null) {
        state.frame = requestAnimationFrame(() => {
          state.frame = null;
          if (state.pending) setLiveBounds(state.pending);
        });
      }
    },
    [app?.minSize.height, app?.minSize.width, desktop, setSnapPreview, snapHint, win.id],
  );

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, mode: 'move' | ResizeDirection) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      focus(win.id);
      let origin = { ...bounds };

      // Dragging a maximised window restores it under the cursor.
      if (mode === 'move' && isMaximized) {
        const ratio = (event.clientX - win.bounds.x) / Math.max(1, win.bounds.width);
        origin = { ...win.restoreBounds };
        origin.x = Math.round(event.clientX - origin.width * ratio);
        origin.y = Math.max(0, event.clientY - 16);
        useWindowStore.setState((state) => ({
          windows: state.windows.map((item) => (item.id === win.id ? { ...item, maximized: false, bounds: origin } : item)),
        }));
        setLiveBounds(origin);
      }

      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      document.body.classList.add('dragging-global');
      document.body.style.cursor = mode === 'move' ? 'default' : '';
      dragState.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        origin,
        pointerId: event.pointerId,
        frame: null,
        pending: null,
      };
    },
    [bounds, desktop, focus, isMaximized, win.bounds, win.id, win.restoreBounds],
  );

  useEffect(() => () => stop(), [stop]);

  const onTitlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!dragState.current) return;
      (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
      commitDrag();
    },
    [commitDrag],
  );

  const titleBarMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: win.title,
      items: [
        {
          id: 'restore',
          label: t('window.restore'),
          icon: 'Copy',
          disabled: !isMaximized && win.snap === 'none',
          action: () => useWindowStore.getState().restore(win.id),
        },
        { id: 'minimize', label: t('window.minimize'), icon: 'Minus', action: () => minimize(win.id) },
        {
          id: 'maximize',
          label: isMaximized ? t('window.restore') : t('window.maximize'),
          icon: 'Square',
          action: () => toggleMaximize(win.id),
        },
        { id: 'sep1', label: '', separator: true },
        { id: 'snap-left', label: t('window.snapLeft'), action: () => snapWindow(win.id, 'left') },
        { id: 'snap-right', label: t('window.snapRight'), action: () => snapWindow(win.id, 'right') },
        { id: 'sep2', label: '', separator: true },
        { id: 'close', label: t('window.close'), shortcut: 'Alt+F4', danger: true, icon: 'X', action: () => closeWindow(win.id) },
      ],
    });
  };

  const style: React.CSSProperties = {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    zIndex: win.z,
  };

  if (win.minimized) return null;

  return (
    <>
      <section
        className={`window-frame absolute flex flex-col bg-[var(--surface-solid)] ${isMaximized ? 'maximized' : ''} ${
          animations ? 'animate-window-open' : ''
        } ${win.closing ? 'pointer-events-none opacity-0 transition-opacity duration-150' : ''}`}
        style={style}
        onPointerDown={() => focus(win.id)}
        aria-label={`${app?.name ?? win.appId} window`}
      >
        <header
          className="titlebar flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] pl-3 pr-0 backdrop-blur-xl"
          onPointerDown={(event) => beginDrag(event, 'move')}
          onPointerMove={onPointerMove}
          onPointerUp={onTitlePointerUp}
          onPointerCancel={onTitlePointerUp}
          onDoubleClick={() => {
            playSound(isMaximized ? 'minimize' : 'maximize');
            toggleMaximize(win.id);
          }}
          onContextMenu={titleBarMenu}
          style={{ touchAction: 'none', cursor: isMaximized ? 'default' : 'grab' }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <AppIcon appId={win.appId} size={16} className="shrink-0" />
            <h2 className="truncate text-[12.5px] font-medium text-[var(--text)]" dir="auto">
              {win.title}
            </h2>
          </div>

          <div className="flex h-full items-stretch self-stretch">
            <div className="relative flex items-center">
              <button
                type="button"
                className="icon-button h-full w-9 rounded-none hover:bg-[var(--hover)]"
                onMouseEnter={() => setLayoutsOpen(true)}
                onFocus={() => setLayoutsOpen(true)}
                onClick={() => setLayoutsOpen((value) => !value)}
                title={t('window.snapLayouts')}
                aria-label={t('window.snapLayouts')}
                tabIndex={-1}
              >
                <Grid2x2 size={14} />
              </button>
              {layoutsOpen ? (
                <div
                  className="panel absolute right-0 top-full z-50 mt-1 w-64 p-2"
                  onMouseLeave={() => setLayoutsOpen(false)}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">
                    {t('window.snapLayouts')}
                  </p>
                  <div className="space-y-2">
                    {SNAP_LAYOUTS.map((layout) => (
                      <div key={layout.id} className="flex gap-2">
                        {layout.zones.map((zone) => (
                          <button
                            key={zone}
                            type="button"
                            onClick={() => {
                              snapWindow(win.id, zone);
                              setLayoutsOpen(false);
                              playSound('snap');
                            }}
                            className="h-12 flex-1 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                            title={zone}
                          />
                        ))}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        snapWindow(win.id, 'maximize');
                        setLayoutsOpen(false);
                      }}
                      className="win-button w-full text-xs"
                    >
                      {t('window.maximize')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="icon-button h-full w-11 rounded-none hover:bg-[var(--hover)]"
              onClick={(event) => {
                event.stopPropagation();
                playSound('minimize');
                minimize(win.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              title={t('window.minimize')}
              aria-label={t('window.minimize')}
            >
              <Minus size={15} />
            </button>
            <button
              type="button"
              className="icon-button h-full w-11 rounded-none hover:bg-[var(--hover)]"
              onClick={(event) => {
                event.stopPropagation();
                playSound(isMaximized ? 'minimize' : 'maximize');
                toggleMaximize(win.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              title={isMaximized ? t('window.restore') : t('window.maximize')}
              aria-label={isMaximized ? t('window.restore') : t('window.maximize')}
            >
              {isMaximized ? <Copy size={14} /> : <Square size={13} />}
            </button>
            <button
              type="button"
              className="icon-button h-full w-11 rounded-none hover:bg-[#c42b1c] hover:text-white"
              onClick={(event) => {
                event.stopPropagation();
                playSound('close');
                closeWindow(win.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              title={t('window.close')}
              aria-label={t('window.close')}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="window-body relative min-h-0 flex-1 overflow-hidden">
          {crashed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <RefreshCw size={26} className="opacity-60" />
              <p className="text-sm font-semibold">{t('window.crashed')}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="win-button"
                  onClick={() => {
                    setCrashed(false);
                    setReloadKey((key) => key + 1);
                  }}
                >
                  {t('window.reloadApp')}
                </button>
                <button type="button" className="win-button" onClick={() => closeWindow(win.id)}>
                  {t('window.close')}
                </button>
              </div>
            </div>
          ) : (
            <ErrorBoundary
              onError={() => setCrashed(true)}
              fallback={(error, reset) => (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm font-semibold">{t('error.boundaryTitle')}</p>
                  <p className="max-w-md text-xs opacity-70">{t('error.boundaryBody')}</p>
                  <code className="max-w-md truncate rounded bg-black/10 px-2 py-1 text-[11px] opacity-70">{error.message}</code>
                  <div className="flex gap-2">
                    <button type="button" className="win-button" onClick={reset}>
                      {t('error.retry')}
                    </button>
                    <button type="button" className="win-button" onClick={() => closeWindow(win.id)}>
                      {t('error.closeApp')}
                    </button>
                  </div>
                </div>
              )}
            >
              <Suspense fallback={<WindowLoading />}>
                {Component ? (
                  <Component key={`${win.id}-${reloadKey}`} windowId={win.id} props={win.props} />
                ) : (
                  <div className="p-6 text-sm opacity-70">Unknown application: {win.appId}</div>
                )}
              </Suspense>
            </ErrorBoundary>
          )}
        </div>

        {isMaximized ? null : (
          <>
            <div className="resize-handle resize-n" onPointerDown={(e) => beginDrag(e, 'n')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
            <div className="resize-handle resize-s" onPointerDown={(e) => beginDrag(e, 's')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
            <div className="resize-handle resize-w" onPointerDown={(e) => beginDrag(e, 'w')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
            <div className="resize-handle resize-e" onPointerDown={(e) => beginDrag(e, 'e')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
            <div className="resize-handle resize-nw" onPointerDown={(e) => beginDrag(e, 'nw')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
            <div className="resize-handle resize-ne" onPointerDown={(e) => beginDrag(e, 'ne')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
            <div className="resize-handle resize-sw" onPointerDown={(e) => beginDrag(e, 'sw')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
            <div className="resize-handle resize-se" onPointerDown={(e) => beginDrag(e, 'se')} onPointerMove={onPointerMove} onPointerUp={onTitlePointerUp} onPointerCancel={onTitlePointerUp} />
          </>
        )}
      </section>
    </>
  );
}

function WindowLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 text-xs opacity-60">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      Loading…
    </div>
  );
}

/** Overlay that shows where a dragged window will snap. */
export function SnapPreviewOverlay() {
  const preview = useWindowStore((state) => state.snapPreview);
  const desktop = useWindowStore((state) => state.desktop);
  if (!preview) return null;
  const bounds =
    preview.position === 'maximize' ? workArea(desktop) : snapBounds(preview.position, desktop);
  return (
    <div
      className="pointer-events-none fixed z-[5000] rounded-lg border-2 border-[var(--accent)] bg-[var(--accent-soft)] transition-all duration-150"
      style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }}
    />
  );
}

export default WindowFrame;
