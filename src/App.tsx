import { useEffect } from 'react';
import { useAppearance } from './hooks/useAppearance';
import { useSystemStore } from './stores/systemStore';
import { useFileSystemStore } from './stores/fileSystemStore';
import { useCalendarStore } from './stores/calendarStore';
import { DesktopShell } from './components/DesktopShell';
import { BootScreen, PowerOffScreen, TransitionScreen } from './components/system/PowerScreens';
import { LockScreen } from './components/system/LockScreen';
import { ScreenOverlays } from './components/system/ScreenOverlays';
import { ContextMenuHost } from './components/menu/ContextMenu';
import { DialogHost } from './components/dialogs/DialogHost';
import { PropertiesDialog } from './components/dialogs/PropertiesDialog';
import { ErrorBoundary } from './components/system/ErrorBoundary';

/**
 * Windows 12 Concept — Web Desktop Simulator
 *
 * Top-level state machine: off → booting → lock → desktop, plus the
 * locking / signing-out / restarting / shutting-down transitions.
 */
export default function App() {
  useAppearance();
  const power = useSystemStore((state) => state.power);
  const setPower = useSystemStore((state) => state.setPower);

  useEffect(() => {
    const system = useSystemStore.getState();
    // First paint: run the boot sequence (unless the user disabled it in Settings).
    if (system.power === 'off') system.startBoot();
    void useFileSystemStore.getState().hydrate();
    void useCalendarStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (power !== 'locking') return undefined;
    const timer = window.setTimeout(() => setPower('lock'), 280);
    return () => window.clearTimeout(timer);
  }, [power, setPower]);

  const desktopVisible = power === 'desktop' || power === 'locking';

  return (
    <ErrorBoundary>
      <div id="os-root" className="relative h-full w-full overflow-hidden bg-[#05070d]">
        {desktopVisible ? <DesktopShell /> : null}

        {power === 'booting' ? <BootScreen /> : null}
        {power === 'lock' ? <LockScreen /> : null}
        {power === 'locking' ? (
          <div className="pointer-events-none fixed inset-0 z-[7900] animate-fade-in bg-black/85 backdrop-blur-md" />
        ) : null}
        {power === 'shutting-down' || power === 'restarting' || power === 'signing-out' ? (
          <TransitionScreen mode={power} />
        ) : null}
        {power === 'off' ? <PowerOffScreen /> : null}

        <ScreenOverlays />
        <ContextMenuHost />
        <DialogHost />
        <PropertiesDialog />
      </div>
    </ErrorBoundary>
  );
}
