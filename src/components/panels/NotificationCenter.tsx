import { useMemo } from 'react';
import { AlertTriangle, BellOff, CheckCircle2, Info, Settings2, Trash2, X, XCircle } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShellStore } from '../../stores/shellStore';
import { useT } from '../../i18n';
import { useClickOutside } from '../../hooks/useUi';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { formatDate, formatTime } from '../../services/format';
import { launchApp } from '../../services/launcher';
import type { NotificationKind } from '../../types';

const KIND_ICON: Record<NotificationKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const KIND_COLOR: Record<NotificationKind, string> = {
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

/** Notification centre flyout (history + controls). */
export function NotificationCenter() {
  const { t, isRTL } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const clearAll = useNotificationStore((state) => state.clearAll);
  const enabled = useSettingsStore((state) => state.settings.privacy.notificationsEnabled);
  const setPrivacy = useSettingsStore((state) => state.setPrivacy);
  const focusAssist = useSettingsStore((state) => state.settings.privacy.focusAssist);
  const open = panel === 'notifications';
  const ref = useClickOutside<HTMLDivElement>(() => open && setPanel(null), open);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof notifications>();
    for (const item of notifications) {
      const day = new Date(item.createdAt).toDateString();
      map.set(day, [...(map.get(day) ?? []), item]);
    }
    return [...map.entries()];
  }, [notifications]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="panel animate-slide-up fixed z-[7000] flex flex-col overflow-hidden"
      style={{
        bottom: TASKBAR_HEIGHT + 10,
        [isRTL ? 'left' : 'right']: 10,
        width: 'min(400px, calc(100vw - 20px))',
        height: 'min(600px, calc(100vh - 100px))',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={t('notif.title')}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <h2 className="text-[13px] font-semibold">{t('notif.title')}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="icon-button h-7 w-7 rounded-md"
            onClick={() => setPrivacy({ focusAssist: !focusAssist })}
            title={t('settings.focus')}
            aria-label={t('settings.focus')}
            aria-pressed={focusAssist}
          >
            <BellOff size={14} className={focusAssist ? 'text-[var(--accent)]' : ''} />
          </button>
          <button
            type="button"
            className="icon-button h-7 w-7 rounded-md"
            onClick={() => {
              setPanel(null);
              launchApp('settings', { section: 'notifications' });
            }}
            title={t('settings.notifications')}
            aria-label={t('settings.notifications')}
          >
            <Settings2 size={14} />
          </button>
          <button type="button" className="icon-button h-7 w-7 rounded-md" onClick={clearAll} title={t('notif.clearAll')} aria-label={t('notif.clearAll')}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!enabled ? (
        <div className="border-b border-[var(--border)] bg-amber-500/10 px-3 py-2 text-[11.5px]">
          <p className="font-medium">{t('notif.enable')}</p>
          <button
            type="button"
            className="mt-1 text-[var(--accent)] underline"
            onClick={() => {
              setPrivacy({ notificationsEnabled: true });
              setPanel(null);
              launchApp('settings', { section: 'notifications' });
            }}
          >
            {t('notif.enableInSettings')}
          </button>
        </div>
      ) : null}
      {focusAssist ? <p className="border-b border-[var(--border)] px-3 py-1.5 text-[11px] opacity-70">{t('notif.focusOn')}</p> : null}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <p className="py-10 text-center text-xs opacity-55">{t('notif.empty')}</p>
        ) : (
          grouped.map(([day, items]) => (
            <section key={day} className="mb-3">
              <h3 className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wide opacity-50">{formatDate(day)}</h3>
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = KIND_ICON[item.kind];
                  return (
                    <article key={item.id} className="group relative rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                      <div className="flex items-start gap-2">
                        <Icon size={15} className={`mt-0.5 shrink-0 ${KIND_COLOR[item.kind]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold">{item.title}</p>
                          {item.body ? <p className="mt-0.5 text-[11.5px] leading-snug opacity-75">{item.body}</p> : null}
                          <p className="mt-1 text-[10px] opacity-45">
                            {item.appName} · {formatTime(item.createdAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="icon-button h-6 w-6 shrink-0 rounded opacity-0 transition group-hover:opacity-100"
                          onClick={() => dismiss(item.id)}
                          aria-label={t('common.close')}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

/** Toasts that slide in from the corner of the desktop. */
export function Toasts() {
  const { isRTL } = useT();
  const notifications = useNotificationStore((state) => state.notifications);
  const dismiss = useNotificationStore((state) => state.dismiss);
  const active = notifications.filter((item) => item.active).slice(-3);

  if (!active.length) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-[calc(var(--taskbar-height)+14px)] z-[7500] flex flex-col gap-2 ${
        isRTL ? 'left-3' : 'right-3'
      }`}
      style={{ maxWidth: 'min(360px, calc(100vw - 24px))' }}
    >
      {active.map((item) => {
        const Icon = KIND_ICON[item.kind];
        return (
          <div key={item.id} className="panel pointer-events-auto animate-slide-in-right p-3" role="status">
            <div className="flex items-start gap-2.5">
              <Icon size={16} className={`mt-0.5 shrink-0 ${KIND_COLOR[item.kind]}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold">{item.title}</p>
                {item.body ? <p className="mt-0.5 text-[11.5px] leading-snug opacity-75">{item.body}</p> : null}
                <p className="mt-1 text-[10px] opacity-45">{item.appName}</p>
              </div>
              <button type="button" className="icon-button h-6 w-6 shrink-0 rounded" onClick={() => dismiss(item.id)} aria-label="Dismiss">
                <X size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default NotificationCenter;
