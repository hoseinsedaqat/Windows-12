import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, CalendarDays, Clock3 } from 'lucide-react';
import type { AppWindowProps } from '../registry';
import type { CalendarEvent } from '../../types';
import { useCalendarStore, EVENT_COLORS } from '../../stores/calendarStore';
import { useT } from '../../i18n';
import { Modal, Field, EmptyState, Badge } from '../../components/ui/Controls';
import { useSettingsStore } from '../../stores/settingsStore';
import { isoDate, formatDate } from '../../services/format';
import { notify } from '../../stores/notificationStore';

interface DraftEvent {
  id?: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  color: string;
  notes: string;
}

const emptyDraft = (date: string): DraftEvent => ({
  title: '',
  date,
  time: '09:00',
  durationMinutes: 30,
  color: EVENT_COLORS[0],
  notes: '',
});

export function CalendarApp({ props }: AppWindowProps) {
  const { t, bcp47, isRTL } = useT();
  const locale = useSettingsStore((state) => state.settings.locale);
  const events = useCalendarStore((state) => state.events);
  const hydrate = useCalendarStore((state) => state.hydrate);
  const addEvent = useCalendarStore((state) => state.addEvent);
  const updateEvent = useCalendarStore((state) => state.updateEvent);
  const removeEvent = useCalendarStore((state) => state.removeEvent);
  const hydrated = useCalendarStore((state) => state.hydrated);

  const initial = (props.date as string | undefined) ?? isoDate(new Date());
  const [cursor, setCursor] = useState(() => new Date(`${initial}T12:00:00`));
  const [selected, setSelected] = useState<string>(initial);
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [weekStart, setWeekStart] = useState<number>(locale.firstDayOfWeek);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => setWeekStart(locale.firstDayOfWeek), [locale.firstDayOfWeek]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(bcp47, { month: 'long', year: 'numeric' }).format(cursor),
    [bcp47, cursor],
  );

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() - weekStart + 7) % 7;
    const start = new Date(year, month, 1 - startOffset);
    const days: { date: Date; iso: string; inMonth: boolean }[] = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      days.push({ date, iso: isoDate(date), inMonth: date.getMonth() === month });
    }
    return days;
  }, [month, weekStart, year]);

  const weekdayLabels = useMemo(() => {
    // 2024-06-02 is a Sunday, so add the week-start offset to walk the week.
    const formatter = new Intl.DateTimeFormat(bcp47, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(2024, 5, 2 + ((weekStart + index) % 7))));
  }, [bcp47, weekStart]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    return map;
  }, [events]);

  const selectedEvents = eventsByDate.get(selected) ?? [];
  const todayIso = isoDate(new Date());

  const goToday = () => {
    const today = new Date();
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(isoDate(today));
  };

  const shiftMonth = (delta: number) => setCursor(new Date(year, month + delta, 1));

  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) return;
    const payload = {
      title: draft.title.trim(),
      date: draft.date,
      time: draft.time || undefined,
      durationMinutes: draft.durationMinutes,
      color: draft.color,
      notes: draft.notes.trim() || undefined,
    };
    if (draft.id) {
      await updateEvent(draft.id, payload);
      notify(t('cal.eventUpdated'), payload.title, 'success', 'calendar');
    } else {
      await addEvent(payload);
      notify(t('cal.eventAdded'), `${payload.title} · ${payload.date}`, 'success', 'calendar');
    }
    setDraft(null);
  };

  const deleteEvent = async (event: CalendarEvent) => {
    await removeEvent(event.id);
    notify(t('cal.eventDeleted'), event.title, 'info', 'calendar');
  };

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
        <CalendarDays size={17} className="text-[var(--accent)]" />
        <h2 className="text-[14px] font-semibold">{t('app.calendar')}</h2>
        <div className="ms-2 flex items-center gap-1">
          <button type="button" className="icon-button h-7 w-7" onClick={() => shiftMonth(-1)} aria-label={t('cal.previousMonth')}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="icon-button h-7 w-7" onClick={() => shiftMonth(1)} aria-label={t('cal.nextMonth')}>
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="min-w-40 text-[13.5px] font-medium">{monthLabel}</span>
        <button type="button" className="win-button px-2 py-1 text-[11.5px]" onClick={goToday}>
          {t('cal.today')}
        </button>
        <button type="button" className="win-button win-button-accent ms-auto flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => setDraft(emptyDraft(selected))}>
          <Plus size={14} /> {t('cal.newEvent')}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Month grid */}
        <div className="flex min-w-0 flex-1 flex-col p-2">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {weekdayLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="px-1 text-center text-[11px] font-semibold uppercase tracking-wide opacity-55">
                {label}
              </span>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1">
            {grid.map((day) => {
              const dayEvents = eventsByDate.get(day.iso) ?? [];
              const isSelected = day.iso === selected;
              const isToday = day.iso === todayIso;
              return (
                <button
                  key={day.iso}
                  type="button"
                  className={`flex min-h-0 flex-col overflow-hidden rounded-lg border p-1 text-start transition ${
                    isSelected ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : day.inMonth ? 'border-[var(--border)] hover:bg-[var(--hover)]' : 'border-transparent opacity-40 hover:bg-[var(--hover)]'
                  }`}
                  onClick={() => setSelected(day.iso)}
                  onDoubleClick={() => setDraft(emptyDraft(day.iso))}
                >
                  <span className={`mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11.5px] font-semibold tabular-nums ${isToday ? 'bg-[var(--accent)] text-white' : ''}`}>
                    {day.date.getDate()}
                  </span>
                  <span className="scroll-thin min-h-0 flex-1 space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span key={event.id} className="flex items-center gap-1 truncate text-[10.5px] leading-tight">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
                        <span className="truncate">
                          {event.time ? `${event.time} ` : ''}
                          {event.title}
                        </span>
                      </span>
                    ))}
                    {dayEvents.length > 3 ? <span className="block text-[10px] opacity-55">+{dayEvents.length - 3} more</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day panel */}
        <aside className="scroll-thin flex w-72 shrink-0 flex-col overflow-y-auto border-s border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="text-[13px] font-semibold">{formatDate(selected, false)}</p>
          <p className="mb-3 text-[11px] opacity-55">
            {new Intl.DateTimeFormat(bcp47, { weekday: 'long' }).format(new Date(`${selected}T12:00:00`))} · {selectedEvents.length} {t('cal.events')}
          </p>

          {selectedEvents.length === 0 ? (
            <EmptyState icon={<Clock3 size={30} />} title={t('cal.noEvents')} message={t('cal.noEventsHint')} />
          ) : null}

          {selectedEvents.map((event) => (
            <div key={event.id} className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-2.5" style={{ borderInlineStart: `4px solid ${event.color}` }}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium">{event.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] opacity-60">
                    {event.time ? (
                      <>
                        <Clock3 size={11} />
                        <span dir="ltr">
                          {event.time}
                          {event.durationMinutes ? ` · ${event.durationMinutes} min` : ''}
                        </span>
                      </>
                    ) : (
                      t('cal.allDay')
                    )}
                  </p>
                  {event.notes ? <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug opacity-70">{event.notes}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    className="icon-button h-6 w-6"
                    aria-label={t('common.edit')}
                    onClick={() =>
                      setDraft({
                        id: event.id,
                        title: event.title,
                        date: event.date,
                        time: event.time ?? '',
                        durationMinutes: event.durationMinutes ?? 30,
                        color: event.color,
                        notes: event.notes ?? '',
                      })
                    }
                  >
                    <Pencil size={12} />
                  </button>
                  <button type="button" className="icon-button h-6 w-6 text-red-500" aria-label={t('common.delete')} onClick={() => void deleteEvent(event)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-auto pt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('cal.upcoming')}</p>
            {events
              .filter((event) => event.date >= todayIso)
              .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
              .slice(0, 5)
              .map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="list-row w-full gap-2 text-[11.5px]"
                  onClick={() => {
                    setSelected(event.date);
                    setCursor(new Date(`${event.date}T12:00:00`));
                  }}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: event.color }} />
                  <span className="min-w-0 flex-1 truncate text-start">{event.title}</span>
                  <span className="shrink-0 font-mono text-[10.5px] opacity-55" dir="ltr">
                    {event.date}
                  </span>
                </button>
              ))}
            <p className="mt-3 flex items-center gap-1.5 text-[10.5px] opacity-50">
              <Badge tone="neutral">{isRTL ? 'RTL' : 'LTR'}</Badge>
              {t('cal.simulatedNote')}
            </p>
          </div>
        </aside>
      </div>

      {/* Event dialog */}
      <Modal
        open={Boolean(draft)}
        title={draft?.id ? t('cal.editEvent') : t('cal.newEvent')}
        onClose={() => setDraft(null)}
        footer={
          <>
            <button type="button" className="win-button" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="win-button win-button-accent" onClick={() => void saveDraft()} disabled={!draft?.title.trim()}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <Field label={t('cal.eventTitle')}>
              <input className="win-input" value={draft.title} autoFocus placeholder={t('cal.eventTitlePlaceholder')} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('cal.date')}>
                <input type="date" className="win-input" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              </Field>
              <Field label={t('cal.time')} hint={t('cal.timeHint')}>
                <input type="time" className="win-input" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
              </Field>
              <Field label={t('cal.duration')}>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  step={5}
                  className="win-input"
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) || 30 })}
                />
              </Field>
              <Field label={t('cal.color')}>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {EVENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-6 w-6 rounded-full border ${draft.color === color ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border-strong)]'}`}
                      style={{ background: color }}
                      onClick={() => setDraft({ ...draft, color })}
                      aria-label={color}
                    />
                  ))}
                </div>
              </Field>
            </div>
            <Field label={t('cal.notes')}>
              <textarea className="win-input min-h-20 resize-y text-[12px]" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default CalendarApp;
