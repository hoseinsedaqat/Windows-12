import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  LayoutGrid,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Volume1,
  Battery,
  BatteryCharging,
  Bell,
  ChevronUp,
  Power,
  X,
} from 'lucide-react';
import { useWindowStore, selectTaskbarApps, TASKBAR_HEIGHT } from '../../stores/windowStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSystemStore } from '../../stores/systemStore';
import { useShellStore } from '../../stores/shellStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { AppIcon, ConceptLogo } from '../icons/AppIcons';
import { useT } from '../../i18n';
import { useClock } from '../../hooks/useAppearance';
import { formatDate, formatTime } from '../../services/format';
import { launchApp } from '../../services/launcher';
import { playSound } from '../../services/sound';
import { getApp } from '../../core/ApplicationRegistry';

const ICON_SIZES = { small: 26, medium: 32, large: 38 } as const;

export function Taskbar() {
  const { t, isRTL } = useT();
  const taskbarApps = useWindowStore(selectTaskbarApps);
  const windows = useWindowStore((state) => state.windows);
  const openApp = useWindowStore((state) => state.openApp);
  const focus = useWindowStore((state) => state.focus);
  const minimize = useWindowStore((state) => state.minimize);
  const restoreFromMinimize = useWindowStore((state) => state.restoreFromMinimize);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const toggleShowDesktop = useWindowStore((state) => state.toggleShowDesktop);
  const showDesktop = useWindowStore((state) => state.showDesktop);
  const togglePin = useWindowStore((state) => state.togglePin);

  const personalization = useSettingsStore((state) => state.settings.personalization);
  const network = useSettingsStore((state) => state.settings.network);
  const sound = useSettingsStore((state) => state.settings.sound);
  const battery = useSystemStore((state) => state.battery);
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const openContextMenu = useShellStore((state) => state.openContextMenu);
  const notifications = useNotificationStore((state) => state.notifications);

  const [hovered, setHovered] = useState(false);
  const [previewApp, setPreviewApp] = useState<string | null>(null);
  const [powerOpen, setPowerOpen] = useState(false);
  const now = useClock(1000);
  const barRef = useRef<HTMLElement>(null);

  const iconSize = ICON_SIZES[personalization.taskbarIconSize];
  const autoHide = personalization.autoHideTaskbar && !panel && !hovered;
  const centered = personalization.taskbarAlignment === 'center';

  useEffect(() => {
    const onResize = () => {
      useWindowStore.getState().setDesktopSize({ width: window.innerWidth, height: window.innerHeight });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onAppClick = (appId: string) => {
    const appWindows = windows.filter((win) => win.appId === appId);
    if (appWindows.length === 0) {
      playSound('open');
      openApp(appId);
      return;
    }
    if (appWindows.length > 1) {
      setPreviewApp(previewApp === appId ? null : appId);
      return;
    }
    const win = appWindows[0];
    if (win.minimized) {
      playSound('open');
      restoreFromMinimize(win.id);
    } else if (useWindowStore.getState().windows.find((w) => w.id === win.id)?.z === useWindowStore.getState().zTop) {
      playSound('minimize');
      minimize(win.id);
    } else {
      focus(win.id);
    }
  };

  const appMenu = (event: React.MouseEvent, appId: string) => {
    event.preventDefault();
    const appWindows = windows.filter((win) => win.appId === appId);
    const app = getApp(appId);
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: app?.name ?? appId,
      items: [
        { id: 'new', label: t('window.newWindow'), icon: 'Plus', action: () => openApp(appId, {}, { forceNew: true }) },
        {
          id: 'pin',
          label: useWindowStore.getState().pinnedApps.includes(appId) ? t('taskbar.unpin') : t('taskbar.pin'),
          icon: 'Pin',
          action: () => togglePin(appId),
        },
        { id: 'sep', label: '', separator: true },
        ...appWindows.map((win) => ({
          id: `win-${win.id}`,
          label: win.title,
          icon: 'AppWindow',
          action: () => (win.minimized ? restoreFromMinimize(win.id) : focus(win.id)),
        })),
        ...(appWindows.length > 1
          ? [{ id: 'close-all', label: t('taskbar.closeAllWindows'), icon: 'X', danger: true, action: () => appWindows.forEach((win) => closeWindow(win.id)) }]
          : []),
        ...(appWindows.length === 1
          ? [
              {
                id: 'close',
                label: t('taskbar.closeWindow'),
                icon: 'X',
                danger: true,
                action: () => closeWindow(appWindows[0].id),
              },
            ]
          : []),
        { id: 'sep2', label: '', separator: true },
        { id: 'settings', label: t('taskbar.settings'), icon: 'Settings', action: () => launchApp('settings', { section: 'taskbar' }) },
      ],
    });
  };

  const taskbarMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          id: 'align',
          label: centered ? 'Align: center' : 'Align: left',
          icon: 'AlignCenter',
          action: () =>
            useSettingsStore.getState().setPersonalization({ taskbarAlignment: centered ? 'left' : 'center' }),
        },
        {
          id: 'autohide',
          label: t('taskbar.settings'),
          icon: 'Eye',
          checked: personalization.autoHideTaskbar,
          action: () => useSettingsStore.getState().setPersonalization({ autoHideTaskbar: !personalization.autoHideTaskbar }),
        },
        { id: 'sep', label: '', separator: true },
        { id: 'taskview', label: t('taskbar.taskView'), icon: 'LayoutGrid', action: () => setPanel('taskview') },
        { id: 'show-desktop', label: t('taskbar.showDesktop'), icon: 'Monitor', action: () => toggleShowDesktop() },
        { id: 'sep2', label: '', separator: true },
        { id: 'tm', label: t('app.taskManager'), icon: 'Activity', action: () => launchApp('taskmanager') },
        { id: 'settings', label: t('taskbar.settings'), icon: 'Settings', action: () => launchApp('settings', { section: 'taskbar' }) },
      ],
    });
  };

  const previewWindows = useMemo(() => windows.filter((win) => win.appId === previewApp), [windows, previewApp]);

  return (
    <>
      <nav
        ref={barRef}
        className={`fixed inset-x-0 z-[6000] flex items-center gap-1 border-t border-[var(--border)] px-2 transition-transform duration-300 acrylic ${
          autoHide ? (personalization.taskbarPosition === 'top' ? '-translate-y-full' : 'translate-y-full') : 'translate-y-0'
        }`}
        style={{
          height: TASKBAR_HEIGHT,
          [personalization.taskbarPosition === 'top' ? 'top' : 'bottom']: 0,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        } as React.CSSProperties}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPreviewApp(null);
        }}
        onContextMenu={taskbarMenu}
        aria-label="Taskbar"
      >
        {/* Left / start cluster */}
        <div className={`flex items-center gap-1 ${centered ? '' : isRTL ? 'mr-1' : 'ml-1'}`}>
          <TaskbarButton
            label={t('taskbar.start')}
            active={panel === 'start'}
            onClick={() => {
              playSound('click');
              setPanel(panel === 'start' ? null : 'start');
            }}
          >
            <ConceptLogo size={iconSize - 6} />
          </TaskbarButton>
          <TaskbarButton label={t('taskbar.search')} active={panel === 'search'} onClick={() => setPanel(panel === 'search' ? null : 'search')}>
            <Search size={iconSize - 12} />
          </TaskbarButton>
          <TaskbarButton label={t('taskbar.taskView')} active={panel === 'taskview'} onClick={() => setPanel(panel === 'taskview' ? null : 'taskview')}>
            <LayoutGrid size={iconSize - 12} />
          </TaskbarButton>
        </div>

        {/* App cluster */}
        <div className={`flex flex-1 items-center gap-1 ${centered ? 'justify-center' : isRTL ? 'justify-end' : 'justify-start'}`}>
          {taskbarApps.map(({ appId, windows: appWindows, active }) => (
            <div key={appId} className="relative">
              <TaskbarButton
                label={getApp(appId)?.name ?? appId}
                active={active}
                running={appWindows.length > 0}
                windowCount={appWindows.length}
                onClick={() => onAppClick(appId)}
                onContextMenu={(event) => appMenu(event, appId)}
              >
                <AppIcon appId={appId} size={iconSize} />
              </TaskbarButton>
              {previewApp === appId && previewWindows.length ? (
                <div
                  className="panel absolute bottom-full mb-2 w-64 overflow-hidden p-1"
                  style={{ [isRTL ? 'right' : 'left']: 0 } as React.CSSProperties}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {previewWindows.map((win) => (
                    <div
                      key={win.id}
                      className="list-row group cursor-pointer justify-between"
                      onClick={() => {
                        if (win.minimized) restoreFromMinimize(win.id);
                        else focus(win.id);
                        setPreviewApp(null);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <AppIcon appId={win.appId} size={16} />
                        <span className="truncate">{win.title}</span>
                      </span>
                      <button
                        type="button"
                        className="icon-button h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          closeWindow(win.id);
                        }}
                        aria-label={t('window.close')}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {taskbarApps.length === 0 ? (
            <span className="px-3 text-[11px] opacity-50">{t('taskbar.noWindows')}</span>
          ) : null}
        </div>

        {/* Tray */}
        <div className={`flex items-center gap-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {showDesktop ? (
            <button type="button" className="win-button mr-1 h-7 px-2 text-[11px]" onClick={toggleShowDesktop}>
              <ChevronUp size={13} /> {t('taskbar.restore')}
            </button>
          ) : null}

          <TrayButton
            label={network.wifiEnabled ? (network.connectedNetwork ?? t('quick.wifi')) : t('quick.wifi')}
            active={panel === 'quick'}
            onClick={() => setPanel(panel === 'quick' ? null : 'quick')}
          >
            {network.wifiEnabled && network.status !== 'disconnected' ? <Wifi size={15} /> : <WifiOff size={15} />}
            {sound.muted || sound.volume === 0 ? <VolumeX size={15} /> : sound.volume < 50 ? <Volume1 size={15} /> : <Volume2 size={15} />}
            {battery.charging ? <BatteryCharging size={16} /> : <Battery size={16} />}
          </TrayButton>

          <TrayButton label={`${formatTime(now)} · ${formatDate(now)}`} active={panel === 'calendar'} onClick={() => setPanel(panel === 'calendar' ? null : 'calendar')}>
            <div className={`flex flex-col items-end leading-tight ${isRTL ? 'items-start' : 'items-end'}`}>
              <span className="text-[12px] font-medium tabular-nums">{formatTime(now)}</span>
              <span className="text-[10.5px] opacity-75 tabular-nums">{formatDate(now)}</span>
            </div>
          </TrayButton>

          <TrayButton
            label={t('notif.title')}
            active={panel === 'notifications'}
            onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}
            badge={notifications.length}
          >
            <Bell size={15} />
          </TrayButton>

          <div className="relative">
            <TrayButton label={t('start.power')} onClick={() => setPowerOpen((value) => !value)} active={powerOpen}>
              <Power size={15} />
            </TrayButton>
            {powerOpen ? (
              <div
                className={`panel absolute bottom-full mb-2 w-48 overflow-hidden p-1 ${isRTL ? 'left-0' : 'right-0'}`}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseLeave={() => setPowerOpen(false)}
              >
                <button type="button" className="list-row w-full gap-2" onClick={() => { setPowerOpen(false); useSystemStore.getState().lock(); }}>
                  🔒 {t('start.lock')}
                </button>
                <button type="button" className="list-row w-full gap-2" onClick={() => { setPowerOpen(false); useSystemStore.getState().signOut(); }}>
                  <X size={14} /> {t('start.signOut')}
                </button>
                <button type="button" className="list-row w-full gap-2" onClick={() => { setPowerOpen(false); useSystemStore.getState().restart(); }}>
                  ↻ {t('start.restart')}
                </button>
                <button type="button" className="list-row w-full gap-2" onClick={() => { setPowerOpen(false); useSystemStore.getState().shutdown(); }}>
                  <Power size={14} /> {t('start.shutdown')}
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className={`h-8 w-2 rounded-sm transition hover:bg-[var(--hover)] ${isRTL ? 'mr-1' : 'ml-1'}`}
            onClick={toggleShowDesktop}
            title={t('taskbar.showDesktop')}
            aria-label={t('taskbar.showDesktop')}
            style={{ borderInlineStart: '1px solid var(--border-strong)' }}
          />
        </div>
      </nav>
    </>
  );
}

interface TaskbarButtonProps {
  label: string;
  active?: boolean;
  running?: boolean;
  windowCount?: number;
  onClick: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}

function TaskbarButton({ label, active, running, windowCount = 0, onClick, onContextMenu, children }: TaskbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`group relative flex h-10 min-w-10 items-center justify-center rounded-md px-2 transition-colors hover:bg-[var(--hover)] ${
        active ? 'bg-[var(--active)]' : ''
      }`}
    >
      {children}
      {running || windowCount > 0 ? (
        <span
          className="absolute bottom-0.5 h-[3px] rounded-full transition-all"
          style={{
            width: active ? 16 : 6,
            background: active ? 'var(--accent)' : 'var(--text-secondary)',
            opacity: active ? 1 : 0.65,
          }}
        />
      ) : null}
      {windowCount > 1 ? (
        <span className="absolute -right-0.5 -top-0.5 rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
          {windowCount}
        </span>
      ) : null}
    </button>
  );
}

function TrayButton({
  label,
  active,
  onClick,
  children,
  badge,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex h-10 items-center gap-2 rounded-md px-2 text-[var(--text)] transition-colors hover:bg-[var(--hover)] ${
        active ? 'bg-[var(--active)]' : ''
      }`}
    >
      {children}
      {badge ? (
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
      ) : null}
    </button>
  );
}

export default Taskbar;
