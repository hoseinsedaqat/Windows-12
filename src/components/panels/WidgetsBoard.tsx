import { useMemo, useState, useEffect } from 'react';
import { Clock, StickyNote, HardDrive, CalendarDays, Timer } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useSystemStore } from '../../stores/systemStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useCalendarStore } from '../../stores/calendarStore';
import { useWindowStore } from '../../stores/windowStore';
import { useClickOutside } from '../../hooks/useUi';
import { getWeather } from '../../services/weather';
import { formatBytes } from '../../services/format';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { useT } from '../../i18n';
import type { NoteDocument } from '../../types';

/** Widgets board: live glanceable tiles (clock, weather, notes, storage, agenda). */
export function WidgetsBoard() {
  const { t, isRTL } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const open = panel === 'widgets';
  const ref = useClickOutside<HTMLDivElement>(() => open && setPanel(null), open);
  const [now, setNow] = useState(() => new Date());
  const nodes = useFileSystemStore((state) => state.nodes);
  const usedBytes = useFileSystemStore((state) => state.usedBytes);
  const sessionStartedAt = useSystemStore((state) => state.sessionStartedAt);
  const windowCount = useWindowStore((state) => state.windows.length);
  const events = useCalendarStore((state) => state.events);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const weather = useMemo(() => getWeather(t('weather.location'), now.getTime()), [t, now]);
  const notes = useMemo(
    () =>
      Object.values(nodes)
        .filter((node) => node && !node.deleted && node.kind === 'note' && node.content && typeof node.content === 'object')
        .map((node) => node!.content as unknown as NoteDocument)
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
        .slice(0, 3),
    [nodes],
  );
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcoming = useMemo(
    () => events.filter((event) => event.date >= todayKey).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    [events, todayKey],
  );
  const uptime = Math.max(0, Math.floor((now.getTime() - sessionStartedAt) / 60000));

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`panel scroll-thin fixed z-[6200] max-h-[min(560px,calc(100vh-80px))] w-[min(380px,calc(100vw-24px))] overflow-y-auto p-3 ${isRTL ? 'right-3' : 'left-3'}`}
      style={{ bottom: TASKBAR_HEIGHT + 8 }}
      role="dialog"
      aria-label={t('taskbar.widgets')}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div>
            <p className="text-[34px] font-light leading-none tabular-nums">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="mt-1 text-[11px] opacity-60">
              {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Clock size={26} className="opacity-40" />
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide opacity-55">
            <Timer size={11} /> {t('weather.title')}
          </p>
          <p className="mt-1 text-[24px] font-light tabular-nums leading-none">{Math.round(weather.now.tempC)}°C</p>
          <p className="mt-1 text-[11px] opacity-70">{t(`weather.${weather.now.condition}`)} · {t('weather.location')}</p>
          <p className="mt-0.5 text-[10px] opacity-45">{t('weather.simulated')}</p>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide opacity-55">
            <HardDrive size={11} /> {t('widgets.system')}
          </p>
          <dl className="mt-1.5 space-y-1 text-[11.5px]">
            <div className="flex justify-between gap-2"><dt className="opacity-60">{t('widgets.storage')}</dt><dd className="tabular-nums">{formatBytes(usedBytes)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="opacity-60">{t('widgets.openWindows')}</dt><dd className="tabular-nums">{windowCount}</dd></div>
            <div className="flex justify-between gap-2"><dt className="opacity-60">{t('widgets.uptime')}</dt><dd className="tabular-nums">{uptime < 60 ? `${uptime}m` : `${Math.floor(uptime / 60)}h ${uptime % 60}m`}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide opacity-55">
            <StickyNote size={11} /> {t('widgets.notes')}
          </p>
          {notes.length === 0 ? (
            <p className="mt-1.5 text-[11px] opacity-50">{t('widgets.empty')}</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {notes.map((note) => (
                <li key={note.title + note.updatedAt} className="rounded-md px-2 py-1.5 text-[11px] leading-snug text-slate-900" style={{ background: note.color }}>
                  <span className="block font-semibold">{note.title}</span>
                  <span className="line-clamp-2 opacity-75">{note.body}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide opacity-55">
            <CalendarDays size={11} /> {t('widgets.agenda')}
          </p>
          {upcoming.length === 0 ? (
            <p className="mt-1.5 text-[11px] opacity-50">{t('widgets.empty')}</p>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {upcoming.map((event) => (
                <li key={event.id} className="text-[11.5px]">
                  <span className="block truncate font-medium">{event.title}</span>
                  <span className="text-[10px] tabular-nums opacity-55" dir="ltr">{event.date}{event.time ? ` · ${event.time}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default WidgetsBoard;
