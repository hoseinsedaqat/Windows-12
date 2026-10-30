import { useEffect } from 'react';
import { X, Monitor, Plus } from 'lucide-react';
import { desktopOf, useWindowStore } from '../../stores/windowStore';
import { useShellStore } from '../../stores/shellStore';
import { AppIcon } from '../icons/AppIcons';
import { useT } from '../../i18n';
import { playSound } from '../../services/sound';
import { getApp } from '../../core/ApplicationRegistry';

/**
 * Task view: virtual desktop strip (switch, add, remove, drag windows between
 * desktops) plus every window of the active desktop as a focusable card.
 */
export function TaskView() {
  const { t } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const windows = useWindowStore((state) => state.windows);
  const desktops = useWindowStore((state) => state.virtualDesktops);
  const activeDesktop = useWindowStore((state) => state.activeVirtualDesktop);
  const switchVirtualDesktop = useWindowStore((state) => state.switchVirtualDesktop);
  const addVirtualDesktop = useWindowStore((state) => state.addVirtualDesktop);
  const removeVirtualDesktop = useWindowStore((state) => state.removeVirtualDesktop);
  const moveWindowToDesktop = useWindowStore((state) => state.moveWindowToDesktop);
  const focus = useWindowStore((state) => state.focus);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const restoreFromMinimize = useWindowStore((state) => state.restoreFromMinimize);

  useEffect(() => {
    if (panel !== 'taskview') return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, setPanel]);

  if (panel !== 'taskview') return null;

  const current = windows.filter((win) => desktopOf(win) === activeDesktop);

  return (
    <div
      className="fixed inset-0 z-[6500] flex flex-col bg-black/45 p-6 backdrop-blur-2xl"
      onClick={() => setPanel(null)}
      role="dialog"
      aria-label={t('taskview.title')}
    >
      <div className="mb-4 flex items-center justify-between" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-sm font-semibold text-white/85">{t('taskview.title')}</h2>
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          <Monitor size={14} />
          <span>
            {t('taskview.desktops')}: {desktops.length}
          </span>
        </div>
      </div>

      {/* Virtual desktop strip */}
      <div
        className="mb-5 flex flex-wrap items-stretch gap-3"
        onClick={(event) => event.stopPropagation()}
        aria-label={t('taskview.desktops')}
      >
        {desktops.map((desktop) => {
          const count = windows.filter((win) => desktopOf(win) === desktop.id).length;
          const active = desktop.id === activeDesktop;
          return (
            <div
              key={desktop.id}
              role="button"
              tabIndex={0}
              onClick={() => switchVirtualDesktop(desktop.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') switchVirtualDesktop(desktop.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const windowId = event.dataTransfer.getData('text/win12-window');
                if (windowId) {
                  moveWindowToDesktop(windowId, desktop.id);
                  playSound('snap');
                }
              }}
              className={`group relative min-w-[150px] cursor-pointer rounded-xl border px-4 py-3 transition ${
                active ? 'border-white/70 bg-white/20' : 'border-white/15 bg-white/5 hover:border-white/40 hover:bg-white/10'
              }`}
              aria-label={desktop.name}
              aria-current={active}
            >
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-white/90">
                <Monitor size={14} />
                {desktop.name}
              </div>
              <div className="mt-1 text-[10.5px] text-white/55">
                {count} {t('taskview.windowsLabel')}
              </div>
              {desktops.length > 1 ? (
                <button
                  type="button"
                  className="absolute end-1.5 top-1.5 rounded p-0.5 text-white/50 opacity-0 transition hover:bg-white/15 hover:text-white group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeVirtualDesktop(desktop.id);
                  }}
                  title={t('taskview.removeDesktop')}
                  aria-label={t('taskview.removeDesktop')}
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          className="flex min-w-[110px] items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 px-4 py-3 text-[12px] text-white/70 transition hover:border-white/60 hover:bg-white/10 hover:text-white"
          onClick={() => {
            addVirtualDesktop();
            playSound('open');
          }}
          aria-label={t('taskview.addDesktop')}
        >
          <Plus size={15} /> {t('taskview.addDesktop')}
        </button>
      </div>

      <p className="mb-3 text-[10.5px] text-white/45" onClick={(event) => event.stopPropagation()}>
        {t('taskview.dragHint')}
      </p>

      <div
        className="scroll-thin grid flex-1 auto-rows-min gap-4 overflow-y-auto pb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        onClick={(event) => event.stopPropagation()}
      >
        {current.length === 0 ? (
          <p className="col-span-full py-16 text-center text-sm text-white/60">{t('taskview.noWindows')}</p>
        ) : (
          current.map((win) => (
            <article
              key={win.id}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/win12-window', win.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              className="group relative cursor-grab overflow-hidden rounded-xl border border-white/15 bg-white/10 shadow-lg transition hover:border-white/40 hover:bg-white/15 active:cursor-grabbing"
              onClick={() => {
                playSound('open');
                if (win.minimized) restoreFromMinimize(win.id);
                else focus(win.id);
                setPanel(null);
              }}
            >
              <header className="flex items-center gap-2 border-b border-white/10 bg-black/25 px-3 py-2">
                <AppIcon appId={win.appId} size={16} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/85">{win.title}</span>
                <button
                  type="button"
                  className="rounded p-1 text-white/60 opacity-0 transition hover:bg-white/15 hover:text-white group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeWindow(win.id);
                  }}
                  aria-label={t('window.close')}
                >
                  <X size={13} />
                </button>
              </header>
              <div className="flex h-28 items-center justify-center bg-black/20 text-white/40">
                <span className="text-[11px]">{getApp(win.appId)?.name ?? win.appId}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

/** Alt+Tab switcher overlay (candidates of the active virtual desktop). */
export function AltTabOverlay() {
  const { t } = useT();
  const altTab = useWindowStore((state) => state.altTab);
  const windows = useWindowStore((state) => state.windows);
  const activeDesktop = useWindowStore((state) => state.activeVirtualDesktop);
  const ordered = [...windows].filter((win) => desktopOf(win) === activeDesktop).sort((a, b) => b.z - a.z);

  if (!altTab.active || ordered.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[8500] flex items-center justify-center">
      <div className="panel flex max-w-[90vw] flex-wrap items-center justify-center gap-2 p-3">
        {ordered.map((win, index) => (
          <div
            key={win.id}
            className={`flex w-28 flex-col items-center gap-1.5 rounded-lg border p-2.5 transition ${
              index === altTab.index ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--surface-2)]'
            }`}
          >
            <AppIcon appId={win.appId} size={34} />
            <span className="w-full truncate text-center text-[11px]">{win.title}</span>
          </div>
        ))}
        <p className="w-full text-center text-[10.5px] opacity-55">{t('taskbar.taskView')} — Alt+Tab</p>
      </div>
    </div>
  );
}

export default TaskView;
