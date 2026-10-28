import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NotificationKind, SystemNotification } from '../types';
import { useSettingsStore } from './settingsStore';
import { getApp } from '../core/ApplicationRegistry';
import { playSound } from '../services/sound';
import { uid } from '../services/id';

export interface PushNotificationInput {
  appId?: string;
  title: string;
  body?: string;
  kind?: NotificationKind;
  /** Toast lifetime in ms (0 keeps it until dismissed). */
  duration?: number;
}

export interface NotificationState {
  notifications: SystemNotification[];
  push: (input: PushNotificationInput) => string | null;
  dismiss: (id: string) => void;
  clearAll: () => void;
  removeApp: (appId: string) => void;
  unreadCount: () => number;
}

const TOAST_LIMIT = 3;
const HISTORY_LIMIT = 60;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      push: (input) => {
        const { notificationsEnabled, focusAssist } = useSettingsStore.getState().settings.privacy;
        if (!notificationsEnabled) return null;

        const appId = input.appId ?? 'system';
        const app = getApp(appId);
        const notification: SystemNotification = {
          id: uid('ntf'),
          appId,
          appName: app?.name ?? 'Windows 12 Concept',
          title: input.title,
          body: input.body,
          kind: input.kind ?? 'info',
          createdAt: Date.now(),
          // Focus assist keeps the notification in the centre but hides the toast.
          active: !focusAssist,
        };

        const activeCount = get().notifications.filter((item) => item.active).length;
        set((state) => ({
          notifications: [
            ...(activeCount >= TOAST_LIMIT
              ? state.notifications.map((item, index) =>
                  index === state.notifications.findIndex((n) => n.active) ? { ...item, active: false } : item,
                )
              : state.notifications),
            notification,
          ].slice(0, HISTORY_LIMIT),
        }));

        if (notification.active) {
          playSound(input.kind === 'error' ? 'error' : 'notify');
          const duration = input.duration ?? 5200;
          if (duration > 0) {
            window.setTimeout(() => get().dismiss(notification.id), duration);
          }
        }
        return notification.id;
      },

      dismiss: (id) =>
        set((state) => ({
          notifications: state.notifications.map((item) => (item.id === id ? { ...item, active: false } : item)),
        })),

      clearAll: () => set((state) => ({ notifications: state.notifications.map((item) => ({ ...item, active: false })) })),

      removeApp: (appId) => set((state) => ({ notifications: state.notifications.filter((item) => item.appId !== appId) })),

      unreadCount: () => get().notifications.filter((item) => item.active).length,
    }),
    {
      name: 'win12-concept.notifications',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ notifications: state.notifications.map((item) => ({ ...item, active: false })) }),
    },
  ),
);

/** Convenience helper for one-off system messages. */
export function notify(title: string, body?: string, kind: NotificationKind = 'info', appId = 'system'): void {
  useNotificationStore.getState().push({ title, body, kind, appId });
}
