import { create } from 'zustand';
import type { CalendarEvent } from '../types';
import { db, initDatabase, safeWrite } from '../services/db';
import { uid } from '../services/id';
import { isoDate } from '../services/format';

export interface CalendarState {
  events: CalendarEvent[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<string>;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  eventsOn: (date: string) => CalendarEvent[];
}

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];

function seedEvents(): CalendarEvent[] {
  const today = new Date();
  const plus = (days: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return isoDate(date);
  };
  return [
    { id: uid('evt'), title: 'Concept review', date: plus(0), time: '10:00', durationMinutes: 45, color: COLORS[0] },
    { id: uid('evt'), title: 'Ship window manager', date: plus(2), time: '14:30', durationMinutes: 60, color: COLORS[3] },
    { id: uid('evt'), title: 'Accounting demo', date: plus(5), time: '09:00', durationMinutes: 30, color: COLORS[1] },
  ];
}

export const useCalendarStore = create<CalendarState>()((set, get) => ({
  events: [],
  hydrated: false,

  hydrate: async () => {
    const available = await initDatabase();
    if (!available) {
      const events = seedEvents();
      set({ events, hydrated: true });
      return;
    }
    const rows = await db.events.toArray();
    if (rows.length === 0) {
      const events = seedEvents();
      await safeWrite(() => db.events.bulkPut(events));
      set({ events, hydrated: true });
      return;
    }
    set({ events: rows, hydrated: true });
  },

  addEvent: async (event) => {
    const record: CalendarEvent = { ...event, id: uid('evt') };
    set((state) => ({ events: [...state.events, record] }));
    await safeWrite(() => db.events.put(record));
    return record.id;
  },

  updateEvent: async (id, patch) => {
    set((state) => ({ events: state.events.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
    const updated = get().events.find((item) => item.id === id);
    if (updated) await safeWrite(() => db.events.put(updated));
  },

  removeEvent: async (id) => {
    set((state) => ({ events: state.events.filter((item) => item.id !== id) }));
    await safeWrite(() => db.events.delete(id));
  },

  eventsOn: (date) => get().events.filter((event) => event.date === date),
}));

export const EVENT_COLORS = COLORS;
