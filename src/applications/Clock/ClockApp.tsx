import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Play, Pause, RotateCcw, Flag, Bell, Globe2, Timer as TimerIcon, Timer, X } from 'lucide-react';
import { useT } from '../../i18n';
import { Segmented, Field, Modal, EmptyState, Toggle } from '../../components/ui/Controls';
import { notify } from '../../stores/notificationStore';
import { playSound } from '../../services/sound';
import { getKV, setKV } from '../../services/db';
import { formatNumber } from '../../services/format';

const CITY_KEY = 'clock.cities.v1';
const ALARM_KEY = 'clock.alarms.v1';

interface City {
  id: string;
  name: string;
  timeZone: string;
}

interface Alarm {
  id: string;
  label: string;
  time: string; // HH:MM
  enabled: boolean;
  firedOn?: string;
}

const DEFAULT_CITIES: City[] = [
  { id: 'local', name: 'Local time', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { id: 'london', name: 'London', timeZone: 'Europe/London' },
  { id: 'newyork', name: 'New York', timeZone: 'America/New_York' },
  { id: 'tokyo', name: 'Tokyo', timeZone: 'Asia/Tokyo' },
  { id: 'sydney', name: 'Sydney', timeZone: 'Australia/Sydney' },
  { id: 'dubai', name: 'Dubai', timeZone: 'Asia/Dubai' },
];

const AVAILABLE_CITIES: City[] = [
  { id: 'tehran', name: 'Tehran', timeZone: 'Asia/Tehran' },
  { id: 'berlin', name: 'Berlin', timeZone: 'Europe/Berlin' },
  { id: 'paris', name: 'Paris', timeZone: 'Europe/Paris' },
  { id: 'moscow', name: 'Moscow', timeZone: 'Europe/Moscow' },
  { id: 'delhi', name: 'New Delhi', timeZone: 'Asia/Kolkata' },
  { id: 'singapore', name: 'Singapore', timeZone: 'Asia/Singapore' },
  { id: 'losangeles', name: 'Los Angeles', timeZone: 'America/Los_Angeles' },
  { id: 'saopaulo', name: 'São Paulo', timeZone: 'America/Sao_Paulo' },
  { id: 'istanbul', name: 'Istanbul', timeZone: 'Europe/Istanbul' },
];

type Tab = 'world' | 'timer' | 'stopwatch' | 'alarms';

function timeIn(timeZone: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

function dateIn(timeZone: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  } catch {
    return date.toDateString();
  }
}

function offsetHours(timeZone: string, date = new Date()): number {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const target = new Date(utc);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(target);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return Math.round(((hour * 60 + minute - (target.getHours() * 60 + target.getMinutes())) / 60) * 10) / 10;
}

export function ClockApp() {
  const { t, bcp47 } = useT();
  const [tab, setTab] = useState<Tab>('world');
  const [now, setNow] = useState(() => new Date());
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES.slice(0, 5));
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [addCityOpen, setAddCityOpen] = useState(false);
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [alarmDraft, setAlarmDraft] = useState({ label: '', time: '07:00' });

  /* Timer */
  const [timerTotal, setTimerTotal] = useState(5 * 60);
  const [timerLeft, setTimerLeft] = useState(5 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerEnd = useRef<number | null>(null);

  /* Timer */
  const [swElapsed, setSwElapsed] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const swStart = useRef<number | null>(null);

  useEffect(() => {
    void getKV<City[]>(CITY_KEY).then((stored) => {
      if (Array.isArray(stored) && stored.length) setCities(stored);
    });
    void getKV<Alarm[]>(ALARM_KEY).then((stored) => {
      if (Array.isArray(stored)) setAlarms(stored);
    });
  }, []);

  /* One shared 250 ms tick drives the clock, the timer and the stopwatch. */
  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = new Date();
      setNow(current);

      if (timerRunning && timerEnd.current !== null) {
        const left = Math.max(0, Math.round((timerEnd.current - current.getTime()) / 1000));
        setTimerLeft(left);
        if (left === 0) {
          timerEnd.current = null;
          setTimerRunning(false);
          playSound('notify');
          notify(t('clock.timerDone'), t('clock.timerDoneBody'), 'success', 'clock');
        }
      }

      if (swRunning && swStart.current !== null) {
        setSwElapsed(current.getTime() - swStart.current);
      }

      /* Alarms */
      const stamp = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
      const hhmm = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
      const due = alarms.filter((alarm) => alarm.enabled && alarm.time === hhmm && alarm.firedOn !== stamp);
      if (due.length) {
        setAlarms((list) => {
          const next = list.map((alarm) => (due.some((item) => item.id === alarm.id) ? { ...alarm, firedOn: stamp } : alarm));
          void setKV(ALARM_KEY, next);
          return next;
        });
        due.forEach((alarm) => {
          playSound('notify');
          notify(t('clock.alarmRinging'), alarm.label || alarm.time, 'info', 'clock');
        });
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [alarms, swRunning, t, timerRunning]);

  const startTimer = useCallback(() => {
    if (timerLeft <= 0) return;
    timerEnd.current = Date.now() + timerLeft * 1000;
    setTimerRunning(true);
  }, [timerLeft]);

  const startStopwatch = () => {
    swStart.current = Date.now() - swElapsed;
    setSwRunning(true);
  };

  const lap = () => setLaps((current) => [swElapsed, ...current]);

  const setTimerParts = (hours: number, minutes: number, seconds: number) => {
    const total = Math.max(0, hours * 3600 + minutes * 60 + seconds);
    setTimerTotal(total);
    setTimerLeft(total);
    setTimerRunning(false);
    timerEnd.current = null;
  };

  const saveAlarm = () => {
    const alarm: Alarm = { id: `alarm-${Date.now()}`, label: alarmDraft.label.trim(), time: alarmDraft.time, enabled: true };
    const next = [...alarms, alarm];
    setAlarms(next);
    void setKV(ALARM_KEY, next);
    setAlarmOpen(false);
    setAlarmDraft({ label: '', time: '07:00' });
  };

  const removeAlarm = (id: string) => {
    const next = alarms.filter((alarm) => alarm.id !== id);
    setAlarms(next);
    void setKV(ALARM_KEY, next);
  };

  const toggleAlarm = (id: string) => {
    const next = alarms.map((alarm) => (alarm.id === id ? { ...alarm, enabled: !alarm.enabled, firedOn: undefined } : alarm));
    setAlarms(next);
    void setKV(ALARM_KEY, next);
  };

  const addCity = (city: City) => {
    const next = [...cities, city];
    setCities(next);
    void setKV(CITY_KEY, next);
    setAddCityOpen(false);
  };

  const removeCity = (id: string) => {
    const next = cities.filter((city) => city.id !== id);
    setCities(next);
    void setKV(CITY_KEY, next);
  };

  const timerParts = useMemo(() => {
    const hours = Math.floor(timerLeft / 3600);
    const minutes = Math.floor((timerLeft % 3600) / 60);
    const seconds = timerLeft % 60;
    return { hours, minutes, seconds };
  }, [timerLeft]);

  const swParts = useMemo(() => {
    const minutes = Math.floor(swElapsed / 60000);
    const seconds = Math.floor((swElapsed % 60000) / 1000);
    const centis = Math.floor((swElapsed % 1000) / 10);
    return { minutes, seconds, centis };
  }, [swElapsed]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          options={[
            { value: 'world', label: <span className="flex items-center gap-1.5"><Globe2 size={13} /> {t('clock.world')}</span> },
            { value: 'timer', label: <span className="flex items-center gap-1.5"><TimerIcon size={13} /> {t('clock.timer')}</span> },
            { value: 'stopwatch', label: <span className="flex items-center gap-1.5"><Timer size={13} /> {t('clock.stopwatch')}</span> },
            { value: 'alarms', label: <span className="flex items-center gap-1.5"><Bell size={13} /> {t('clock.alarms')}</span> },
          ]}
        />
        <span className="ms-auto text-[11px] opacity-55">{t('clock.simulatedNote')}</span>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'world' ? (
          <div className="space-y-2">
            {cities.map((city) => {
              const delta = offsetHours(city.timeZone, now);
              return (
                <div key={city.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{city.name}</p>
                    <p className="truncate text-[11px] opacity-55">{dateIn(city.timeZone, now)}</p>
                  </div>
                  <span className="text-[11px] opacity-60 tabular-nums" dir="ltr">
                    {delta === 0 ? t('clock.same') : `${delta > 0 ? '+' : ''}${formatNumber(delta, { locale: bcp47 })} h`}
                  </span>
                  <span className="text-[22px] font-semibold tabular-nums" dir="ltr">
                    {timeIn(city.timeZone, now)}
                  </span>
                  <button type="button" className="icon-button h-7 w-7" onClick={() => removeCity(city.id)} aria-label={t('common.remove')} disabled={cities.length <= 1}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
            <button type="button" className="win-button flex w-full items-center justify-center gap-1.5 py-2" onClick={() => setAddCityOpen(true)}>
              <Plus size={14} /> {t('clock.addCity')}
            </button>
          </div>
        ) : null}

        {tab === 'timer' ? (
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <div className="relative flex h-52 w-52 items-center justify-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={2 * Math.PI * 45 * (1 - (timerTotal ? timerLeft / timerTotal : 0))}
                  style={{ transition: 'stroke-dashoffset 240ms linear' }}
                />
              </svg>
              <span className="text-[34px] font-semibold tabular-nums" dir="ltr">
                {String(timerParts.hours).padStart(2, '0')}:{String(timerParts.minutes).padStart(2, '0')}:{String(timerParts.seconds).padStart(2, '0')}
              </span>
            </div>

            <div className="flex items-end gap-2">
              {([
                { label: t('clock.hours'), value: Math.floor(timerTotal / 3600), index: 0 },
                { label: t('clock.minutes'), value: Math.floor((timerTotal % 3600) / 60), index: 1 },
                { label: t('clock.seconds'), value: timerTotal % 60, index: 2 },
              ] as const).map((part) => (
                <label key={part.label} className="block text-center">
                  <span className="mb-1 block text-[10.5px] uppercase opacity-55">{part.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={part.index === 0 ? 99 : 59}
                    className="win-input w-16 text-center text-[14px] tabular-nums"
                    value={part.value}
                    disabled={timerRunning}
                    onChange={(event) => {
                      const next = Number(event.target.value) || 0;
                      if (part.index === 0) setTimerParts(next, Math.floor((timerTotal % 3600) / 60), timerTotal % 60);
                      else if (part.index === 1) setTimerParts(Math.floor(timerTotal / 3600), next, timerTotal % 60);
                      else setTimerParts(Math.floor(timerTotal / 3600), Math.floor((timerTotal % 3600) / 60), next);
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              {timerRunning ? (
                <button type="button" className="win-button flex items-center gap-1.5" onClick={() => { setTimerRunning(false); timerEnd.current = null; }}>
                  <Pause size={14} /> {t('clock.pause')}
                </button>
              ) : (
                <button type="button" className="win-button win-button-accent flex items-center gap-1.5" onClick={startTimer} disabled={timerLeft <= 0}>
                  <Play size={14} /> {timerLeft === timerTotal ? t('clock.start') : t('clock.resume')}
                </button>
              )}
              <button
                type="button"
                className="win-button flex items-center gap-1.5"
                onClick={() => {
                  setTimerRunning(false);
                  timerEnd.current = null;
                  setTimerLeft(timerTotal);
                }}
              >
                <RotateCcw size={14} /> {t('clock.reset')}
              </button>
            </div>

            <div className="flex gap-1.5">
              {[1, 3, 5, 10, 25].map((minutes) => (
                <button key={minutes} type="button" className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11.5px] transition hover:bg-[var(--hover)]" onClick={() => setTimerParts(0, minutes, 0)}>
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {tab === 'stopwatch' ? (
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <span className="text-[46px] font-semibold tabular-nums" dir="ltr">
              {String(swParts.minutes).padStart(2, '0')}:{String(swParts.seconds).padStart(2, '0')}
              <span className="text-[24px] opacity-60">.{String(swParts.centis).padStart(2, '0')}</span>
            </span>
            <div className="flex gap-2">
              {swRunning ? (
                <button type="button" className="win-button flex items-center gap-1.5" onClick={() => { setSwRunning(false); swStart.current = null; }}>
                  <Pause size={14} /> {t('clock.pause')}
                </button>
              ) : (
                <button type="button" className="win-button win-button-accent flex items-center gap-1.5" onClick={startStopwatch}>
                  <Play size={14} /> {swElapsed ? t('clock.resume') : t('clock.start')}
                </button>
              )}
              <button type="button" className="win-button flex items-center gap-1.5" onClick={lap} disabled={!swRunning}>
                <Flag size={14} /> {t('clock.lap')}
              </button>
              <button
                type="button"
                className="win-button flex items-center gap-1.5"
                onClick={() => {
                  setSwRunning(false);
                  swStart.current = null;
                  setSwElapsed(0);
                  setLaps([]);
                }}
              >
                <RotateCcw size={14} /> {t('clock.reset')}
              </button>
            </div>
            {laps.length ? (
              <div className="scroll-thin max-h-52 w-full max-w-sm overflow-y-auto rounded-lg border border-[var(--border)]">
                {laps.map((lapValue, lapIndex) => (
                  <div key={`${lapValue}-${lapIndex}`} className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5 text-[12px] last:border-0">
                    <span className="opacity-60">
                      {t('clock.lap')} {laps.length - lapIndex}
                    </span>
                    <span className="font-mono tabular-nums" dir="ltr">
                      {String(Math.floor(lapValue / 60000)).padStart(2, '0')}:{String(Math.floor((lapValue % 60000) / 1000)).padStart(2, '0')}.
                      {String(Math.floor((lapValue % 1000) / 10)).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-[11px] opacity-50 tabular-nums" dir="ltr">
                      Δ{' '}
                      {(() => {
                        const previous = laps[lapIndex + 1] ?? 0;
                        const diff = lapValue - previous;
                        return `${String(Math.floor(diff / 60000)).padStart(2, '0')}:${String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')}`;
                      })()}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'alarms' ? (
          <div className="space-y-2">
            {alarms.length === 0 ? (
              <EmptyState icon={<Bell size={36} />} title={t('clock.noAlarms')} message={t('clock.noAlarmsHint')} />
            ) : null}
            {alarms.map((alarm) => (
              <div key={alarm.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{alarm.label || t('clock.alarm')}</p>
                  <p className="text-[11px] opacity-55">{alarm.enabled ? t('clock.alarmOn') : t('clock.alarmOff')}</p>
                </div>
                <span className="text-[20px] font-semibold tabular-nums" dir="ltr">
                  {alarm.time}
                </span>
                <Toggle checked={alarm.enabled} onChange={() => toggleAlarm(alarm.id)} label={alarm.label} />
                <button type="button" className="icon-button h-7 w-7 text-red-500" onClick={() => removeAlarm(alarm.id)} aria-label={t('common.delete')}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="win-button flex w-full items-center justify-center gap-1.5 py-2" onClick={() => setAlarmOpen(true)}>
              <Plus size={14} /> {t('clock.addAlarm')}
            </button>
            <p className="pt-1 text-[10.5px] leading-relaxed opacity-55">{t('clock.alarmNote')}</p>
          </div>
        ) : null}
      </div>

      {/* Add city */}
      <Modal open={addCityOpen} title={t('clock.addCity')} onClose={() => setAddCityOpen(false)}>
        <div className="grid grid-cols-2 gap-2">
          {[...DEFAULT_CITIES, ...AVAILABLE_CITIES]
            .filter((city) => !cities.some((existing) => existing.timeZone === city.timeZone))
            .map((city) => (
              <button key={city.id} type="button" className="list-row justify-between text-[12px]" onClick={() => addCity(city)}>
                <span>{city.name}</span>
                <span className="font-mono text-[11.5px] tabular-nums opacity-60" dir="ltr">
                  {timeIn(city.timeZone, now)}
                </span>
              </button>
            ))}
        </div>
      </Modal>

      {/* Add alarm */}
      <Modal
        open={alarmOpen}
        title={t('clock.addAlarm')}
        onClose={() => setAlarmOpen(false)}
        footer={
          <>
            <button type="button" className="win-button" onClick={() => setAlarmOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="win-button win-button-accent" onClick={saveAlarm}>
              {t('common.add')}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('clock.alarmTime')}>
            <input type="time" className="win-input" value={alarmDraft.time} onChange={(event) => setAlarmDraft((draft) => ({ ...draft, time: event.target.value }))} />
          </Field>
          <Field label={t('common.name')}>
            <input className="win-input" value={alarmDraft.label} placeholder={t('clock.alarm')} onChange={(event) => setAlarmDraft((draft) => ({ ...draft, label: event.target.value }))} />
          </Field>
          <p className="text-[11px] opacity-60">{t('clock.alarmNote')}</p>
        </div>
      </Modal>
    </div>
  );
}

export default ClockApp;
