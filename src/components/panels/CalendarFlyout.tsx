import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useCalendarStore, EVENT_COLORS } from '../../stores/calendarStore';
import { useT } from '../../i18n';
import { useClickOutside, useClock } from '../../hooks/useUi';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { isoDate } from '../../services/format';
import { useSettingsStore } from '../../stores/settingsStore';
import { launchApp } from '../../services/launcher';

/** Clock/calendar flyout opened from the taskbar clock. */
export function CalendarFlyout() {
  const { t, isRTL } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const events = useCalendarStore((state) => state.events);
  const addEvent = useCalendarStore((state) => state.addEvent);
  const locale = useSettingsStore((state) => state.settings.locale);
  const now = useClock(1000);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => isoDate(new Date()));
  const open = panel === 'calendar';
  const ref = useClickOutside<HTMLDivElement>(() => open && setPanel(null), open);

  const calendar = useMemo(
    () => new Intl.DateTimeFormat(locale.language === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US', {
      year: 'numeric',
      month: 'long',
    }),
    [locale.language],
  );

  const grid = useMemo(() => buildMonthGrid(cursor, locale.firstDayOfWeek), [cursor, locale.firstDayOfWeek]);
  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale.language === 'fa' ? 'fa-IR' : 'en-US', { day: 'numeric' }),
    [locale.language],
  );
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale.language === 'fa' ? 'fa-IR' : 'en-US', { weekday: 'short' }),
    [locale.language],
  );

  if (!open) return null;

  const selectedEvents = events.filter((event) => event.date === selected);

  return (
    <div
      ref={ref}
      className="panel animate-slide-up fixed z-[7000] w-[min(360px,calc(100vw-20px))] p-3"
      style={{ bottom: TASKBAR_HEIGHT + 10, [isRTL ? 'left' : 'right']: 10 } as React.CSSProperties}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={t('app.calendar')}
    >
      <div className="mb-2 text-center">
        <p className="text-[26px] font-light leading-none tabular-nums">
          {new Intl.DateTimeFormat(locale.language === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(now)}
        </p>
        <p className="mt-1 text-[11.5px] opacity-70">
          {new Intl.DateTimeFormat(locale.language === 'fa' ? 'fa-IR' : 'en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(now)}
        </p>
      </div>

      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          className="icon-button h-7 w-7 rounded"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label={t('common.back')}
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[12px] font-semibold">{calendar.format(cursor)}</span>
        <button
          type="button"
          className="icon-button h-7 w-7 rounded"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label={t('common.forward')}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {Array.from({ length: 7 }, (_, index) => {
          const date = new Date(2024, 0, 7 + ((locale.firstDayOfWeek + index) % 7));
          return (
            <span key={index} className="py-1 text-[10px] font-semibold uppercase opacity-50">
              {weekdayFormatter.format(date)}
            </span>
          );
        })}
        {grid.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const key = isoDate(day);
          const isToday = key === isoDate(now);
          const isSelected = key === selected;
          const hasEvents = events.some((event) => event.date === key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              onDoubleClick={() => {
                setPanel(null);
                launchApp('calendar', { date: key });
              }}
              className={`relative flex h-8 items-center justify-center rounded-md text-[11.5px] tabular-nums transition ${
                isSelected ? 'bg-[var(--accent)] text-white' : isToday ? 'bg-[var(--accent-soft)] font-semibold' : 'hover:bg-[var(--hover)]'
              } ${day.getMonth() !== cursor.getMonth() ? 'opacity-35' : ''}`}
            >
              {dayFormatter.format(day)}
              {hasEvents ? <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[var(--accent)]'}`} /> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-[var(--border)] pt-2">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11.5px] font-semibold opacity-70">{selected}</p>
          <button
            type="button"
            className="win-button gap-1 px-2 py-0.5 text-[11px]"
            onClick={() =>
              void addEvent({ title: 'New event', date: selected, time: '09:00', durationMinutes: 30, color: EVENT_COLORS[events.length % EVENT_COLORS.length] })
            }
          >
            <Plus size={12} /> {t('cal.newEvent')}
          </button>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="py-2 text-center text-[11px] opacity-50">{t('cal.noEvents')}</p>
        ) : (
          <div className="space-y-1">
            {selectedEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2 py-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: event.color }} />
                <span className="min-w-0 flex-1 truncate text-[11.5px]">{event.title}</span>
                {event.time ? <span className="shrink-0 text-[10.5px] tabular-nums opacity-60">{event.time}</span> : null}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="win-button mt-2 w-full text-[11px]"
          onClick={() => {
            setPanel(null);
            launchApp('calendar', { date: selected });
          }}
        >
          {t('common.open')} {t('app.calendar')}
        </button>
      </div>
    </div>
  );
}

function buildMonthGrid(cursor: Date, firstDayOfWeek: number): (Date | null)[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - firstDayOfWeek + 7) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i += 1) {
    cells.push(new Date(year, month, i - offset + 1));
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1];
    if (!last) break;
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    if (cells.length >= 42) break;
  }
  return cells.slice(0, 42);
}

export default CalendarFlyout;
