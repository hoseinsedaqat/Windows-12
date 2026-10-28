import { useEffect } from 'react';
import { X, Monitor } from 'lucide-react';
import { useWindowStore } from '../../stores/windowStore';
import { useShellStore } from '../../stores/shellStore';
import { AppIcon } from '../icons/AppIcons';
import { useT } from '../../i18n';
import { playSound } from '../../services/sound';
import { getApp } from '../../core/ApplicationRegistry';

/** Task view: every open window as a card you can focus or close. */
export function TaskView() {
  const { t } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const windows = useWindowStore((state) => state.windows);
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
          <span>{t('taskview.desktops')}: 1</span>
        </div>
      </div>

      <div
        className="scroll-thin grid flex-1 auto-rows-min gap-4 overflow-y-auto pb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        onClick={(event) => event.stopPropagation()}
      >
        {windows.length === 0 ? (
          <p className="col-span-full py-16 text-center text-sm text-white/60">{t('taskview.noWindows')}</p>
        ) : (
          windows.map((win) => (
            <article
              key={win.id}
              className="group relative overflow-hidden rounded-xl border border-white/15 bg-white/10 shadow-lg transition hover:border-white/40 hover:bg-white/15"
              onClick={() => {
                playSound('open');
                if (win.minimized) restoreFromMinimize(win.id);
                else focus(win.id);
                setPanel(null);
              }}
            >
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <AppIcon appId={win.appId} size={16} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/90">{win.title}</span>
                <button
                  type="button"
                  className="icon-button h-6 w-6 rounded text-white/70 hover:bg-white/20 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeWindow(win.id);
                  }}
                  aria-label={t('window.close')}
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-white/10 to-transparent">
                <AppIcon appId={win.appId} size={72} className="opacity-80" />
              </div>
              <p className="px-3 py-1.5 text-[10.5px] text-white/55">
                {getApp(win.appId)?.name ?? win.appId} · {win.minimized ? t('window.minimize') : t('tm.running')}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

/** Alt+Tab switcher overlay. */
export function AltTabOverlay() {
  const { t } = useT();
  const altTab = useWindowStore((state) => state.altTab);
  const windows = useWindowStore((state) => state.windows);
  const ordered = [...windows].sort((a, b) => b.z - a.z);

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
