import { useEffect } from 'react';
import { Desktop } from './desktop/Desktop';
import { WindowLayer } from './window/WindowLayer';
import { Taskbar } from './taskbar/Taskbar';
import { StartMenu } from './start/StartMenu';
import { SearchPanel } from './panels/SearchPanel';
import { QuickSettings } from './panels/QuickSettings';
import { NotificationCenter, Toasts } from './panels/NotificationCenter';
import { TaskView, AltTabOverlay } from './panels/TaskView';
import { CalendarFlyout } from './panels/CalendarFlyout';
import { useWindowStore } from '../stores/windowStore';
import { useShellShortcuts } from '../hooks/useShortcuts';
import { useShellStore } from '../stores/shellStore';
import { useSettingsStore } from '../stores/settingsStore';

/** The interactive desktop: icons, windows, taskbar and every shell flyout. */
export function DesktopShell() {
  useShellShortcuts(true);

  useEffect(() => {
    const measure = () => {
      useWindowStore.getState().setDesktopSize({ width: window.innerWidth, height: window.innerHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  // Any pointer-down on empty space dismisses the transient panels.
  useEffect(() => {
    const onPointerDown = () => {
      const shell = useShellStore.getState();
      if (shell.contextMenu) shell.closeContextMenu();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const startupApps = useSettingsStore((state) => state.settings.apps.startupApps);
  const launchStartup = useSettingsStore((state) => state.settings.apps.launchStartupOnSignIn);

  useEffect(() => {
    if (!launchStartup || startupApps.length === 0) return;
    const timers = startupApps.map((appId, index) =>
      window.setTimeout(() => {
        void import('../services/launcher').then((module) => module.launchApp(appId));
      }, 400 + index * 350),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // Run once per sign-in session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Desktop />
      <WindowLayer />
      <Taskbar />
      <StartMenu />
      <SearchPanel />
      <QuickSettings />
      <NotificationCenter />
      <CalendarFlyout />
      <TaskView />
      <AltTabOverlay />
      <Toasts />
    </div>
  );
}

export default DesktopShell;
