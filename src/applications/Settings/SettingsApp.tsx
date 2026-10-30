import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Monitor,
  Volume2,
  Power,
  Bluetooth,
  Mouse,
  Keyboard,
  Printer,
  Wifi,
  ShieldCheck,
  Gauge,
  Palette,
  Type,
  Lock,
  LayoutGrid,
  User,
  KeyRound,
  Globe,
  Shield,
  Activity,
  RefreshCw,
  Search,
  ChevronRight,
  Upload,
  Check,
  Play,
  Trash2,
  Download,
  Eye,
  Zap,
  Sliders,
  AppWindow,
  ExternalLink,
  HardDriveDownload,
  HardDriveUpload,
} from 'lucide-react';
import type { AppWindowProps } from '../registry';
import type { FileKind } from '../../types';
import { useSettingsStore, ACCENTS } from '../../stores/settingsStore';
import { useSystemStore, AVATARS } from '../../stores/systemStore';
import { useQuickSettingsStore, DEMO_NETWORKS } from '../../stores/quickSettingsStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useWindowStore } from '../../stores/windowStore';
import { SETTINGS_GROUPS, findSection } from '../../data/settingsNav';
import { listWallpapers, registerCustomWallpaper } from '../../data/wallpapers';
import { downloadBackup, decodeBackup, applyBackup } from '../../services/backup';
import { notify } from '../../stores/notificationStore';
import { useT } from '../../i18n';
import { ToggleRow, SliderRow, Segmented, Select, Field, Badge, ProgressBar, EmptyState } from '../../components/ui/Controls';
import { AppIcon } from '../../components/icons/AppIcons';
import { SHORTCUT_LIST } from '../../hooks/useShortcuts';
import { listedApps, appsForKind } from '../../core/ApplicationRegistry';
import { launchApp } from '../../services/launcher';
import { playSound } from '../../services/sound';
import { formatBytes, formatDate, formatTime } from '../../services/format';
import { pickFiles, readFileAsDataUrl, readFileAsText } from '../../services/files';
import { getKV, setKV } from '../../services/db';
import { useShellStore } from '../../stores/shellStore';
import type { TranslationKey } from '../../i18n/en';
import { KIND_LABELS } from '../../core/FileSystem';

const GROUP_ICONS: Record<string, React.ReactNode> = {
  Monitor: <Monitor size={16} />,
  Mouse: <Mouse size={16} />,
  Wifi: <Wifi size={16} />,
  Palette: <Palette size={16} />,
  Grid: <LayoutGrid size={16} />,
  User: <User size={16} />,
  Globe: <Globe size={16} />,
  Shield: <Shield size={16} />,
  RefreshCw: <RefreshCw size={16} />,
};

const KINDS: FileKind[] = ['doc', 'sheet', 'slides', 'text', 'note', 'image', 'pdf'];
const DEVICE_NAME_KEY = 'settings.deviceName';

export function SettingsApp({ props }: AppWindowProps) {
  const { t } = useT();
  const settings = useSettingsStore((state) => state.settings);
  const setDisplay = useSettingsStore((state) => state.setDisplay);
  const setSound = useSettingsStore((state) => state.setSound);
  const setNetwork = useSettingsStore((state) => state.setNetwork);
  const setPersonalization = useSettingsStore((state) => state.setPersonalization);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const setPower = useSettingsStore((state) => state.setPower);
  const setPrivacy = useSettingsStore((state) => state.setPrivacy);
  const setApps = useSettingsStore((state) => state.setApps);
  const setMultitasking = useSettingsStore((state) => state.setMultitasking);
  const setDefaultApp = useSettingsStore((state) => state.setDefaultApp);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAccent = useSettingsStore((state) => state.setAccent);
  const setWallpaper = useSettingsStore((state) => state.setWallpaper);
  const setLockWallpaper = useSettingsStore((state) => state.setLockWallpaper);
  const toggleNightLight = useSettingsStore((state) => state.toggleNightLight);
  const setQuota = useSettingsStore((state) => state.setQuota);

  const system = useSystemStore();
  const quick = useQuickSettingsStore();
  const notifications = useNotificationStore((state) => state.notifications);
  const clearNotifications = useNotificationStore((state) => state.clearAll);
  const fs = useFileSystemStore();
  const windows = useWindowStore((state) => state.windows);
  const openDialog = useShellStore((state) => state.openDialog);
  const setPanel = useShellStore((state) => state.setPanel);

  const [section, setSection] = useState<string>((props.section as string) ?? 'display');
  const [query, setQuery] = useState('');
  const [deviceName, setDeviceName] = useState('CONCEPT-PC');
  const [passwordDraft, setPasswordDraft] = useState({ next: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  useEffect(() => {
    if (props.section) setSection(String(props.section));
  }, [props.section]);

  useEffect(() => {
    void getKV<string>(DEVICE_NAME_KEY).then((value) => {
      if (typeof value === 'string' && value) setDeviceName(value);
    });
  }, []);

  const current = findSection(section);
  const wallpapers = listWallpapers();

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SETTINGS_GROUPS;
    return SETTINGS_GROUPS.map((group) => ({
      ...group,
      sections: group.sections.filter(
        (item) => t(item.labelKey).toLowerCase().includes(needle) || item.keywords.some((keyword) => keyword.toLowerCase().includes(needle)),
      ),
    })).filter((group) => group.sections.length);
  }, [query, t]);

  const uploadWallpaper = async (lock: boolean) => {
    const files = await pickFiles('image/*', false);
    if (!files.length) return;
    const url = await readFileAsDataUrl(files[0]);
    const id = `custom:${files[0].name}`;
    registerCustomWallpaper(id, url, files[0].name);
    if (lock) setLockWallpaper(id);
    else setWallpaper(id);
  };

  const applyThemePreset = (preset: 'concept-dark' | 'concept-light' | 'amoled' | 'paper') => {
    if (preset === 'concept-dark') {
      setTheme('dark');
      setAccent('#2563eb');
      setWallpaper('aurora-mesh');
      setPersonalization({ transparency: true });
    } else if (preset === 'concept-light') {
      setTheme('light');
      setAccent('#0ea5e9');
      setWallpaper('flow-light');
      setPersonalization({ transparency: true });
    } else if (preset === 'amoled') {
      setTheme('dark');
      setAccent('#a855f7');
      setWallpaper('slate');
      setPersonalization({ transparency: false });
    } else {
      setTheme('light');
      setAccent('#14b8a6');
      setWallpaper('sunrise');
      setPersonalization({ transparency: false });
    }
  };

  /* ---------------- section renderer ---------------- */
  const renderSection = () => {
    switch (section) {
      case 'display':
        return (
          <>
            <SliderRow label={t('settings.brightness')} value={settings.display.brightness} onChange={(value) => setDisplay({ brightness: value })} icon={<Zap size={15} />} />
            <ToggleRow label={t('settings.nightLight')} description={t('settings.nightLightHint')} checked={settings.display.nightLight} onChange={() => toggleNightLight()} />
            {settings.display.nightLight ? (
              <SliderRow label={t('settings.nightLightStrength')} value={settings.display.nightLightStrength} onChange={(value) => setDisplay({ nightLightStrength: value })} />
            ) : null}
            <Card title={t('settings.scale')}>
              <Segmented
                value={String(settings.display.scale)}
                onChange={(value) => setDisplay({ scale: Number(value) })}
                options={['100', '115', '125', '150', '175'].map((scale) => ({ value: scale, label: `${scale}%` }))}
              />
              <p className="mt-2 text-[11px] opacity-60">{t('settings.scaleHint')}</p>
            </Card>
            <ToggleRow label={t('settings.animations')} description={t('settings.animationsHint')} checked={settings.display.animations} onChange={(value) => setDisplay({ animations: value })} />
            <ToggleRow label={t('settings.reduceMotion')} description={t('settings.reduceMotionHint')} checked={settings.display.reduceMotion} onChange={(value) => setDisplay({ reduceMotion: value })} />
            <Card title={t('settings.resolution')}>
              <p className="text-[12px] opacity-75">
                {window.screen.width} × {window.screen.height} · {window.devicePixelRatio.toFixed(2)}× DPR · viewport {window.innerWidth}×{window.innerHeight}
              </p>
              <p className="mt-1 text-[11px] opacity-55">{t('settings.resolutionHint')}</p>
            </Card>
          </>
        );

      case 'sound':
        return (
          <>
            <SliderRow label={t('settings.volume')} value={settings.sound.volume} onChange={(value) => setSound({ volume: value })} icon={<Volume2 size={15} />} />
            <ToggleRow label={t('settings.mute')} description={t('settings.muteHint')} checked={settings.sound.muted} onChange={(value) => setSound({ muted: value })} />
            <ToggleRow label={t('settings.systemSounds')} description={t('settings.systemSoundsHint')} checked={settings.sound.systemSounds} onChange={(value) => setSound({ systemSounds: value })} />
            <Card title={t('settings.testSound')}>
              <div className="flex flex-wrap gap-2">
                {(['click', 'open', 'close', 'notify', 'error', 'snap', 'startup'] as const).map((name) => (
                  <button key={name} type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => playSound(name)}>
                    <Play size={12} /> {name}
                  </button>
                ))}
              </div>
            </Card>
            <Note tone="warning">{t('settings.soundNote')}</Note>
          </>
        );

      case 'notifications':
        return (
          <>
            <ToggleRow label={t('settings.notificationsEnabled')} description={t('settings.notificationsEnabledHint')} checked={settings.privacy.notificationsEnabled} onChange={(value) => setPrivacy({ notificationsEnabled: value })} />
            <ToggleRow label={t('settings.focusAssist')} description={t('settings.focusAssistHint')} checked={settings.privacy.focusAssist} onChange={(value) => setPrivacy({ focusAssist: value })} />
            <Card
              title={`${t('settings.notificationHistory')} (${notifications.length})`}
              action={
                <button type="button" className="win-button px-2 py-1 text-[11.5px]" onClick={clearNotifications} disabled={!notifications.length}>
                  {t('notifications.clearAll')}
                </button>
              }
            >
              {notifications.length ? (
                <ul className="space-y-1">
                  {notifications.slice(0, 12).map((item) => (
                    <li key={item.id} className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2.5 py-1.5 text-[11.5px]">
                      <AppIcon appId={item.appId} size={14} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{item.title}</span>
                        <span className="block truncate opacity-60">{item.body}</span>
                      </span>
                      <span className="shrink-0 text-[10px] opacity-45">{formatTime(item.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11.5px] opacity-55">{t('settings.noNotifications')}</p>
              )}
            </Card>
            <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => setPanel('notifications')}>
              <ExternalLink size={13} /> {t('settings.openNotificationCenter')}
            </button>
          </>
        );

      case 'focus':
        return (
          <>
            <ToggleRow label={t('settings.focusAssist')} description={t('settings.focusAssistHint')} checked={settings.privacy.focusAssist} onChange={(value) => setPrivacy({ focusAssist: value })} />
            <Card title={t('settings.focusNow')}>
              <p className="text-[12px] opacity-75">
                {settings.privacy.focusAssist ? t('settings.focusOn') : t('settings.focusOff')} · {windows.length} {t('tm.windows').toLowerCase()}
              </p>
            </Card>
            <Note>{t('settings.focusNote')}</Note>
          </>
        );

      case 'power':
        return (
          <>
            <Card title={t('settings.powerActions')}>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => system.lock()}>
                  <Lock size={13} /> {t('power.lock')}
                </button>
                <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => system.signOut()}>
                  <User size={13} /> {t('power.signOut')}
                </button>
                <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => system.restart()}>
                  <RefreshCw size={13} /> {t('power.restart')}
                </button>
                <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => system.shutdown()}>
                  <Power size={13} /> {t('power.shutdown')}
                </button>
              </div>
            </Card>
            <ToggleRow label={t('settings.showBootAnimation')} description={t('settings.showBootAnimationHint')} checked={settings.power.showBootAnimation} onChange={(value) => setPower({ showBootAnimation: value })} />
            <Card title={t('settings.bootDuration')}>
              <Segmented
                value={settings.power.bootDuration}
                onChange={(value) => setPower({ bootDuration: value as 'fast' | 'normal' })}
                options={[
                  { value: 'fast', label: t('settings.bootFast') },
                  { value: 'normal', label: t('settings.bootNormal') },
                ]}
              />
            </Card>
            <Card title={t('settings.screenTimeout')}>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={60} className="flex-1 accent-[var(--accent)]" value={settings.power.screenTimeoutMinutes} onChange={(event) => setPower({ screenTimeoutMinutes: Number(event.target.value) })} />
                <span className="w-20 text-end text-[12px] tabular-nums">{settings.power.screenTimeoutMinutes ? `${settings.power.screenTimeoutMinutes} min` : t('settings.never')}</span>
              </div>
              <p className="mt-1 text-[11px] opacity-55">{t('settings.screenTimeoutHint')}</p>
            </Card>
            <ToggleRow label={t('settings.batterySaver')} description={t('settings.batterySaverHint')} checked={settings.power.batterySaver} onChange={(value) => setPower({ batterySaver: value })} />
            <Card title={t('settings.battery')}>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={100} className="flex-1 accent-[var(--accent)]" value={system.battery.level} onChange={(event) => system.setBattery(Number(event.target.value), system.battery.charging)} />
                <span className="w-14 text-end text-[12px] tabular-nums">{system.battery.level}%</span>
                <ToggleRow label={t('settings.charging')} checked={system.battery.charging} onChange={(value) => system.setBattery(system.battery.level, value)} />
              </div>
              <Note>{t('settings.batteryNote')}</Note>
            </Card>
          </>
        );

      case 'storage':
        return (
          <>
            <Card title={t('settings.storageUsage')}>
              <ProgressBar value={fs.usedBytes} max={fs.quotaBytes()} />
              <p className="mt-2 text-[12px]">
                {formatBytes(fs.usedBytes)} / {formatBytes(fs.quotaBytes())} · {Object.keys(fs.nodes).filter((id) => !fs.nodes[id].deleted).length} {t('explorer.itemCount').toLowerCase()}
              </p>
              <p className="mt-1 text-[11px] opacity-55">{t('settings.storageNote')}</p>
            </Card>
            <Card title={t('settings.storageQuota')}>
              <div className="flex items-center gap-3">
                <input type="range" min={16} max={512} step={16} className="flex-1 accent-[var(--accent)]" value={settings.storageQuotaMB} onChange={(event) => setQuota(Number(event.target.value))} />
                <span className="w-20 text-end text-[12px] tabular-nums">{settings.storageQuotaMB} MB</span>
              </div>
              <p className="mt-1 text-[11px] opacity-55">{t('settings.quotaHint')}</p>
            </Card>
            <Card title={t('settings.dataManagement')}>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => fs.exportAll()}>
                  <Download size={13} /> {t('settings.exportAll')}
                </button>
                <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => void importBackup()}>
                  <Upload size={13} /> {t('settings.importBackup')}
                </button>
                <button
                  type="button"
                  className="win-button flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-500"
                  onClick={() =>
                    openDialog({
                      kind: 'confirm',
                      title: t('settings.resetFileSystem'),
                      message: t('settings.resetFileSystemConfirm'),
                      danger: true,
                      onConfirm: () => void fs.resetAll(),
                    })
                  }
                >
                  <Trash2 size={13} /> {t('settings.resetFileSystem')}
                </button>
              </div>
            </Card>
            {!fs.storageAvailable ? <Note tone="danger">{t('settings.storageUnavailable')}</Note> : null}
          </>
        );

      case 'multitasking':
        return (
          <>
            <ToggleRow label={t('settings.snapEnabled')} description={t('settings.snapEnabledHint')} checked={settings.multitasking.snapEnabled} onChange={(value) => setMultitasking({ snapEnabled: value })} />
            <ToggleRow label={t('settings.snapAssist')} description={t('settings.snapAssistHint')} checked={settings.multitasking.snapAssist} onChange={(value) => setMultitasking({ snapAssist: value })} />
            <ToggleRow label={t('settings.altTabShowsTabs')} description={t('settings.altTabHint')} checked={settings.multitasking.altTabShowsTabs} onChange={(value) => setMultitasking({ altTabShowsTabs: value })} />
            <ToggleRow label={t('settings.desktopGrouping')} description={t('settings.desktopGroupingHint')} checked={settings.multitasking.desktopGrouping} onChange={(value) => setMultitasking({ desktopGrouping: value })} />
            <Card title={t('tm.windows')}>
              {windows.length ? (
                <ul className="space-y-1">
                  {windows.map((win) => (
                    <li key={win.id} className="flex items-center gap-2 text-[11.5px]">
                      <AppIcon appId={win.appId} size={14} />
                      <span className="min-w-0 flex-1 truncate">{win.title}</span>
                      <Badge tone={win.minimized ? 'neutral' : 'accent'}>{win.minimized ? t('tm.minimized') : win.maximized ? t('tm.maximized') : t('tm.running')}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11.5px] opacity-55">{t('tm.noResults')}</p>
              )}
            </Card>
          </>
        );

      case 'about':
        return (
          <>
            <Card title={t('settings.deviceName')}>
              <div className="flex items-center gap-2">
                <input
                  className="win-input flex-1"
                  dir="ltr"
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  onBlur={() => void setKV(DEVICE_NAME_KEY, deviceName)}
                />
                <button type="button" className="win-button win-button-accent px-2.5 py-1.5 text-[12px]" onClick={() => void setKV(DEVICE_NAME_KEY, deviceName)}>
                  {t('common.save')}
                </button>
              </div>
              <p className="mt-1 text-[11px] opacity-55">{t('settings.deviceNameHint')}</p>
            </Card>
            <Card title={t('settings.specs')}>
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                <Spec label={t('settings.edition')} value="Windows 12 Concept (fan-made simulator)" />
                <Spec label={t('settings.version')} value="12.0.26100.concept" />
                <Spec label={t('settings.build')} value={`web-${import.meta.env.MODE}`} />
                <Spec label={t('settings.installedApps')} value={String(listedApps().length)} />
                <Spec label={t('settings.browserEngine')} value={navigator.userAgent.slice(0, 60)} />
                <Spec label={t('settings.screen')} value={`${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio.toFixed(2)}×`} />
                <Spec label={t('settings.language')} value={t('settings.currentLanguage')} />
                <Spec label={t('settings.storageUsed')} value={formatBytes(fs.usedBytes)} />
                <Spec label={t('settings.sessionStarted')} value={formatDate(system.sessionStartedAt, true)} />
                <Spec label={t('settings.windowsOpen')} value={String(windows.length)} />
              </dl>
            </Card>
            <Note tone="warning">{t('settings.aboutDisclaimer')}</Note>
          </>
        );

      case 'bluetooth':
        return (
          <>
            <ToggleRow label={t('quick.bluetooth')} description={t('settings.bluetoothHint')} checked={settings.network.bluetoothEnabled} onChange={(value) => setNetwork({ bluetoothEnabled: value })} />
            <Card title={t('settings.pairedDevices')}>
              {quick.bluetoothDevices.map((device) => (
                <div key={device.id} className="flex items-center gap-2 border-b border-[var(--border)] py-1.5 text-[12px] last:border-0">
                  <Bluetooth size={14} className="opacity-60" />
                  <span className="min-w-0 flex-1 truncate">{device.name}</span>
                  <Badge tone={device.connected ? 'success' : device.paired ? 'neutral' : 'warning'}>{device.connected ? t('settings.connected') : device.paired ? t('settings.paired') : t('settings.notPaired')}</Badge>
                  <button type="button" className="win-button px-2 py-0.5 text-[11px]" disabled={!settings.network.bluetoothEnabled} onClick={() => quick.pairBluetoothDevice(device.id)}>
                    {device.paired ? t('settings.forget') : t('settings.pair')}
                  </button>
                  <button type="button" className="win-button px-2 py-0.5 text-[11px]" disabled={!device.paired || !settings.network.bluetoothEnabled} onClick={() => quick.toggleBluetoothDevice(device.id, !device.connected)}>
                    {device.connected ? t('settings.disconnect') : t('settings.connect')}
                  </button>
                </div>
              ))}
            </Card>
            <Note tone="warning">{t('settings.bluetoothSimulated')}</Note>
          </>
        );

      case 'devices':
      case 'printers':
        return (
          <>
            <Card title={t('settings.connectedDevices')}>
              {[
                { name: 'Concept Keyboard', kind: t('settings.keyboard'), icon: <Keyboard size={15} /> },
                { name: 'Concept Mouse', kind: t('settings.devices'), icon: <Mouse size={15} /> },
                { name: 'Concept Display', kind: t('settings.display'), icon: <Monitor size={15} /> },
                { name: 'Virtual Printer', kind: t('settings.printers'), icon: <Printer size={15} /> },
              ].map((device) => (
                <div key={device.name} className="flex items-center gap-2 border-b border-[var(--border)] py-2 text-[12px] last:border-0">
                  <span className="opacity-60">{device.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{device.name}</span>
                  <span className="text-[11px] opacity-55">{device.kind}</span>
                  <Badge tone="success">{t('settings.connected')}</Badge>
                </div>
              ))}
            </Card>
            {section === 'printers' ? (
              <Card title={t('settings.printerActions')}>
                <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1.5 text-[12px]" onClick={() => window.print()}>
                  <Printer size={13} /> {t('settings.printTestPage')}
                </button>
                <p className="mt-2 text-[11px] opacity-55">{t('settings.printerHint')}</p>
              </Card>
            ) : null}
            <Note tone="warning">{t('settings.devicesSimulated')}</Note>
          </>
        );

      case 'mouse':
        return (
          <>
            <SliderRow label={t('a11y.pointerRing')} value={system.accessibility.cursorSize} min={100} max={220} suffix="%" onChange={(value) => system.setAccessibility({ cursorSize: value })} icon={<Mouse size={15} />} />
            <Card title={t('settings.pointerPreview')}>
              <p className="text-[12px] opacity-70">{t('settings.pointerPreviewHint')}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded-full border border-[var(--accent)]" style={{ width: system.accessibility.cursorSize / 4, height: system.accessibility.cursorSize / 4 }} />
                <span className="text-[11px] opacity-55">{system.accessibility.cursorSize}%</span>
              </div>
            </Card>
            <Note>{t('settings.mouseNote')}</Note>
          </>
        );

      case 'keyboard':
        return (
          <>
            <Card title={t('settings.shortcuts')}>
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                {SHORTCUT_LIST.map((shortcut) => (
                  <div key={shortcut.keys} className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-1.5 text-[12px] last:border-0">
                    <kbd className="rounded border border-[var(--border-strong)] bg-[var(--surface-solid)] px-1.5 py-0.5 font-mono text-[11px]" dir="ltr">
                      {shortcut.keys}
                    </kbd>
                    <span className="min-w-0 flex-1 truncate">{shortcut.action}</span>
                  </div>
                ))}
              </div>
            </Card>
            <ToggleRow label={t('settings.systemSounds')} description={t('settings.keyboardSoundHint')} checked={settings.sound.systemSounds} onChange={(value) => setSound({ systemSounds: value })} />
            <Note>{t('settings.shortcutsNote')}</Note>
          </>
        );

      case 'wifi':
        return (
          <>
            <ToggleRow label={t('quick.wifi')} description={t('settings.wifiHint')} checked={settings.network.wifiEnabled} onChange={(value) => setNetwork({ wifiEnabled: value, status: value ? 'connected' : 'disconnected' })} />
            <ToggleRow label={t('quick.airplane')} description={t('settings.airplaneHint')} checked={settings.network.airplaneMode} onChange={(value) => setNetwork({ airplaneMode: value, wifiEnabled: value ? false : settings.network.wifiEnabled, bluetoothEnabled: value ? false : settings.network.bluetoothEnabled })} />
            <Card title={t('settings.availableNetworks')}>
              {DEMO_NETWORKS.map((network) => {
                const active = settings.network.connectedNetwork === network.ssid;
                return (
                  <button
                    key={network.ssid}
                    type="button"
                    className={`list-row w-full gap-2 ${active ? 'bg-[var(--accent-soft)]' : ''}`}
                    disabled={!settings.network.wifiEnabled || settings.network.airplaneMode}
                    onClick={() => setNetwork({ connectedNetwork: active ? null : network.ssid, status: active ? 'disconnected' : 'connected' })}
                  >
                    <Wifi size={14} className={active ? 'text-[var(--accent)]' : 'opacity-60'} />
                    <span className="min-w-0 flex-1 truncate text-start">{network.ssid}</span>
                    <span className="text-[11px] opacity-55">{network.signal}%</span>
                    {network.secured ? <Lock size={12} className="opacity-45" /> : null}
                    {active ? <Check size={14} className="text-[var(--accent)]" /> : null}
                  </button>
                );
              })}
            </Card>
            <Card title={t('settings.connectionState')}>
              <p className="text-[12px]">
                {settings.network.wifiEnabled ? (settings.network.connectedNetwork ? `${t('settings.connected')} · ${settings.network.connectedNetwork}` : t('settings.notConnected')) : t('quick.wifiOff')}
              </p>
            </Card>
            <Note tone="warning">{t('settings.networkSimulated')}</Note>
          </>
        );

      case 'ethernet':
      case 'vpn':
      case 'proxy':
        return (
          <>
            <Card title={t(`settings.${section}` as TranslationKey)}>
              <p className="text-[12px] leading-relaxed opacity-75">{t('settings.stubBody')}</p>
            </Card>
            {section === 'proxy' ? (
              <ToggleRow label={t('settings.useProxy')} description={t('settings.useProxyHint')} checked={false} onChange={() => undefined} disabled />
            ) : null}
            <Note tone="warning">{t('settings.networkSimulated')}</Note>
          </>
        );

      case 'data-usage':
        return (
          <>
            <Card title={t('settings.dataUsage')}>
              <p className="text-[12px] opacity-75">{t('settings.dataUsageBody')}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                <Spec label={t('settings.localData')} value={formatBytes(fs.usedBytes)} />
                <Spec label={t('settings.networkData')} value="0 B" />
              </dl>
            </Card>
            <Note tone="warning">{t('settings.networkSimulated')}</Note>
          </>
        );

      case 'background':
        return (
          <>
            <Card
              title={t('settings.wallpaper')}
              action={
                <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[11.5px]" onClick={() => void uploadWallpaper(false)}>
                  <Upload size={12} /> {t('settings.uploadWallpaper')}
                </button>
              }
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {wallpapers.map((wallpaper) => (
                  <button
                    key={wallpaper.id}
                    type="button"
                    className={`overflow-hidden rounded-lg border-2 transition ${settings.personalization.wallpaperId === wallpaper.id ? 'border-[var(--accent)]' : 'border-transparent hover:border-[var(--border-strong)]'}`}
                    onClick={() => setWallpaper(wallpaper.id)}
                    title={wallpaper.name}
                  >
                    <span className="block h-14 w-full bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper.url})` }} />
                    <span className="block truncate px-1.5 py-1 text-[10.5px]">{wallpaper.name}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card title={t('settings.desktopIcons')}>
              <div className="space-y-3">
                <ToggleRow label={t('settings.showDesktopIcons')} checked={settings.personalization.desktopIconsVisible} onChange={(value) => setPersonalization({ desktopIconsVisible: value })} />
                <div>
                  <p className="mb-1 text-[11.5px] font-medium opacity-75">{t('settings.iconSize')}</p>
                  <Segmented
                    size="sm"
                    value={settings.personalization.desktopIconSize}
                    onChange={(value) => setPersonalization({ desktopIconSize: value as 'small' | 'medium' | 'large' })}
                    options={[
                      { value: 'small', label: t('settings.sizeSmall') },
                      { value: 'medium', label: t('settings.sizeMedium') },
                      { value: 'large', label: t('settings.sizeLarge') },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11.5px] font-medium opacity-75">{t('settings.iconLayout')}</p>
                  <Segmented
                    size="sm"
                    value={settings.personalization.desktopIconLayout}
                    onChange={(value) => setPersonalization({ desktopIconLayout: value as 'auto' | 'free' })}
                    options={[
                      { value: 'auto', label: t('desktop.autoArrange') },
                      { value: 'free', label: t('settings.freePlacement') },
                    ]}
                  />
                </div>
              </div>
            </Card>
          </>
        );

      case 'colors':
        return (
          <>
            <Card title={t('settings.mode')}>
              <Segmented
                value={settings.personalization.theme}
                onChange={(value) => setTheme(value as 'light' | 'dark' | 'auto')}
                options={[
                  { value: 'light', label: t('settings.light') },
                  { value: 'dark', label: t('settings.dark') },
                  { value: 'auto', label: t('settings.systemTheme') },
                ]}
              />
            </Card>
            <Card title={t('settings.accentColor')}>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition ${settings.personalization.accent === color ? 'border-[var(--text)]' : 'border-transparent'}`}
                    style={{ background: color }}
                    onClick={() => setAccent(color)}
                    aria-label={color}
                  >
                    {settings.personalization.accent === color ? <Check size={14} className="mx-auto text-white" /> : null}
                  </button>
                ))}
              </div>
            </Card>
            <ToggleRow label={t('settings.transparency')} description={t('settings.transparencyHint')} checked={settings.personalization.transparency} onChange={(value) => setPersonalization({ transparency: value })} />
          </>
        );

      case 'themes':
        return (
          <Card title={t('settings.themePresets')}>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { id: 'concept-dark', name: t('settings.themeConceptDark'), wallpaper: 'aurora-mesh' },
                { id: 'concept-light', name: t('settings.themeConceptLight'), wallpaper: 'flow-light' },
                { id: 'amoled', name: t('settings.themeAmoled'), wallpaper: 'slate' },
                { id: 'paper', name: t('settings.themePaper'), wallpaper: 'sunrise' },
              ] as const).map((preset) => (
                <button key={preset.id} type="button" className="overflow-hidden rounded-lg border border-[var(--border)] text-start transition hover:border-[var(--accent)]" onClick={() => applyThemePreset(preset.id)}>
                  <span className="block h-16 w-full bg-cover bg-center" style={{ backgroundImage: `url(${listWallpapers().find((item) => item.id === preset.wallpaper)?.url})` }} />
                  <span className="flex items-center justify-between px-2.5 py-1.5 text-[12px]">
                    {preset.name}
                    <ChevronRight size={13} className="opacity-40" />
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] opacity-55">{t('settings.themePresetHint')}</p>
          </Card>
        );

      case 'lockscreen':
        return (
          <Card
            title={t('settings.lockWallpaper')}
            action={
              <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[11.5px]" onClick={() => void uploadWallpaper(true)}>
                <Upload size={12} /> {t('settings.uploadWallpaper')}
              </button>
            }
          >
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {wallpapers.map((wallpaper) => (
                <button
                  key={wallpaper.id}
                  type="button"
                  className={`overflow-hidden rounded-lg border-2 transition ${settings.personalization.lockWallpaperId === wallpaper.id ? 'border-[var(--accent)]' : 'border-transparent hover:border-[var(--border-strong)]'}`}
                  onClick={() => setLockWallpaper(wallpaper.id)}
                >
                  <span className="block h-14 w-full bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper.url})` }} />
                  <span className="block truncate px-1.5 py-1 text-[10.5px]">{wallpaper.name}</span>
                </button>
              ))}
            </div>
          </Card>
        );

      case 'start':
        return (
          <>
            <ToggleRow label={t('settings.launchStartup')} description={t('settings.launchStartupHint')} checked={settings.apps.launchStartupOnSignIn} onChange={(value) => setApps({ launchStartupOnSignIn: value })} />
            <ToggleRow label={t('settings.showRecentFiles')} description={t('settings.showRecentFilesHint')} checked={settings.privacy.activityHistory} onChange={(value) => setPrivacy({ activityHistory: value })} />
            <Card title={t('settings.startupApps')}>
              <div className="grid gap-1 sm:grid-cols-2">
                {listedApps().map((app) => {
                  const enabled = settings.apps.startupApps.includes(app.id);
                  return (
                    <label key={app.id} className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5">
                      <AppIcon appId={app.id} size={16} />
                      <span className="min-w-0 flex-1 truncate text-[12px]">{app.name}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--accent)]"
                        checked={enabled}
                        onChange={() => setApps({ startupApps: enabled ? settings.apps.startupApps.filter((id) => id !== app.id) : [...settings.apps.startupApps, app.id] })}
                      />
                    </label>
                  );
                })}
              </div>
            </Card>
          </>
        );

      case 'taskbar':
        return (
          <>
            <Card title={t('settings.taskbarPosition')}>
              <Segmented
                value={settings.personalization.taskbarPosition}
                onChange={(value) => setPersonalization({ taskbarPosition: value as 'bottom' | 'top' })}
                options={[
                  { value: 'bottom', label: t('settings.positionBottom') },
                  { value: 'top', label: t('settings.positionTop') },
                ]}
              />
            </Card>
            <Card title={t('settings.taskbarAlignment')}>
              <Segmented
                size="sm"
                value={settings.personalization.taskbarAlignment}
                onChange={(value) => setPersonalization({ taskbarAlignment: value as 'center' | 'left' })}
                options={[
                  { value: 'center', label: t('settings.alignCenter') },
                  { value: 'left', label: t('settings.alignStart') },
                ]}
              />
            </Card>
            <Card title={t('settings.taskbarIconSize')}>
              <Segmented
                size="sm"
                value={settings.personalization.taskbarIconSize}
                onChange={(value) => setPersonalization({ taskbarIconSize: value as 'small' | 'medium' | 'large' })}
                options={[
                  { value: 'small', label: t('settings.sizeSmall') },
                  { value: 'medium', label: t('settings.sizeMedium') },
                  { value: 'large', label: t('settings.sizeLarge') },
                ]}
              />
            </Card>
            <ToggleRow label={t('settings.autoHideTaskbar')} description={t('settings.autoHideHint')} checked={settings.personalization.autoHideTaskbar} onChange={(value) => setPersonalization({ autoHideTaskbar: value })} />
            <Card title={t('settings.quickTiles')}>
              <div className="flex flex-wrap gap-1.5">
                {quick.tiles.map((tile) => (
                  <button key={tile} type="button" className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11.5px] transition hover:bg-[var(--hover)]" onClick={() => quick.toggleTile(tile)}>
                    {t(`quick.${tile}` as TranslationKey)}
                  </button>
                ))}
                {quick.hiddenTiles.map((tile) => (
                  <button key={tile} type="button" className="rounded-full border border-dashed border-[var(--border-strong)] px-2.5 py-1 text-[11.5px] opacity-60 transition hover:opacity-100" onClick={() => quick.toggleTile(tile)}>
                    + {t(`quick.${tile}` as TranslationKey)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] opacity-55">{t('settings.quickTilesHint')}</p>
            </Card>
          </>
        );

      case 'fonts':
        return (
          <>
            <SliderRow label={t('a11y.textSize')} value={system.accessibility.textSize} min={80} max={160} suffix="%" onChange={(value) => system.setAccessibility({ textSize: value })} icon={<Type size={15} />} />
            <ToggleRow label={t('a11y.highContrast')} description={t('settings.highContrastHint')} checked={system.accessibility.highContrast} onChange={(value) => system.setAccessibility({ highContrast: value })} />
            <Card title={t('settings.fontPreview')}>
              <p className="text-[13px]">The quick brown fox jumps over the lazy dog — ۱۲۳۴۵۶۷۸۹۰</p>
              <p className="mt-1 text-[13px] font-semibold">Segoe UI / Vazirmatn · {system.accessibility.textSize}%</p>
            </Card>
          </>
        );

      case 'installed':
        return (
          <Card title={`${t('settings.installedApps')} (${listedApps().length})`}>
            <div className="grid gap-2 sm:grid-cols-2">
              {listedApps().map((app) => (
                <div key={app.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
                  <AppIcon appId={app.id} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{app.name}</span>
                    <span className="block truncate text-[10.5px] opacity-55">
                      {app.category ?? 'system'} · {app.singleton ? t('settings.singleInstance') : t('settings.multiInstance')}
                    </span>
                  </span>
                  <button type="button" className="win-button px-2 py-0.5 text-[11px]" onClick={() => launchApp(app.id)}>
                    {t('settings.launch')}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        );

      case 'default-apps':
        return (
          <Card title={t('settings.defaultApps')}>
            <div className="space-y-2">
              {KINDS.map((kind) => {
                const options = appsForKind(kind);
                const current = settings.apps.defaultApps[kind] ?? options[0]?.id ?? '';
                return (
                  <div key={kind} className="flex items-center gap-3 border-b border-[var(--border)] pb-2 last:border-0">
                    <span className="w-40 shrink-0 text-[12px]">{KIND_LABELS[kind]}</span>
                    <Select className="h-8 flex-1 py-0 text-[12px]" value={current} onChange={(value) => setDefaultApp(kind, value)} options={options.map((app) => ({ value: app.id, label: app.name }))} />
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] opacity-55">{t('settings.defaultAppsHint')}</p>
          </Card>
        );

      case 'startup':
        return (
          <>
            <ToggleRow label={t('settings.launchStartup')} description={t('settings.launchStartupHint')} checked={settings.apps.launchStartupOnSignIn} onChange={(value) => setApps({ launchStartupOnSignIn: value })} />
            <Card title={t('settings.startupApps')}>
              {settings.apps.startupApps.length ? (
                <ul className="space-y-1">
                  {settings.apps.startupApps.map((id) => (
                    <li key={id} className="flex items-center gap-2 text-[12px]">
                      <AppIcon appId={id} size={15} />
                      <span className="min-w-0 flex-1 truncate">{listedApps().find((app) => app.id === id)?.name ?? id}</span>
                      <button type="button" className="icon-button h-6 w-6" onClick={() => setApps({ startupApps: settings.apps.startupApps.filter((item) => item !== id) })} aria-label={t('common.remove')}>
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11.5px] opacity-55">{t('settings.noStartupApps')}</p>
              )}
              <p className="mt-2 text-[11px] opacity-55">{t('settings.startupHint')}</p>
            </Card>
          </>
        );

      case 'app-management':
        return (
          <>
            <Card title={t('settings.appData')}>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="win-button px-2.5 py-1.5 text-[12px]" onClick={() => openDialog({ kind: 'confirm', title: t('settings.resetFileSystem'), message: t('settings.resetFileSystemConfirm'), danger: true, onConfirm: () => void fs.resetAll() })}>
                  <Trash2 size={13} /> {t('settings.resetFileSystem')}
                </button>
                <button type="button" className="win-button px-2.5 py-1.5 text-[12px]" onClick={() => launchApp('taskmanager')}>
                  <Gauge size={13} /> {t('app.taskmanager')}
                </button>
                <button type="button" className="win-button px-2.5 py-1.5 text-[12px]" onClick={() => launchApp('terminal')}>
                  <Keyboard size={13} /> {t('app.terminal')}
                </button>
              </div>
            </Card>
            <Note>{t('settings.appManagementNote')}</Note>
          </>
        );

      case 'profile':
        return (
          <>
            <Card title={t('settings.profile')}>
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-full text-[22px] font-semibold text-white" style={{ background: system.account.avatarColor }}>
                  {system.account.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <Field label={t('settings.displayName')}>
                    <input className="win-input" value={system.account.displayName} onChange={(event) => void system.updateAccount({ displayName: event.target.value })} />
                  </Field>
                </div>
              </div>
            </Card>
            <Card title={t('settings.avatar')}>
              <div className="flex flex-wrap gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[15px] font-semibold text-white transition ${system.account.avatar === avatar.id ? 'border-[var(--accent)]' : 'border-transparent'}`}
                    style={{ background: avatar.color }}
                    onClick={() => void system.updateAccount({ avatar: avatar.id, avatarColor: avatar.color })}
                    aria-label={avatar.id}
                  >
                    {system.account.displayName.slice(0, 1).toUpperCase()}
                  </button>
                ))}
              </div>
            </Card>
          </>
        );

      case 'signin':
        return (
          <>
            <Card title={t('settings.password')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('settings.newPassword')}>
                  <input type="password" className="win-input" value={passwordDraft.next} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, next: event.target.value }))} />
                </Field>
                <Field label={t('settings.confirmPassword')}>
                  <input type="password" className="win-input" value={passwordDraft.confirm} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, confirm: event.target.value }))} />
                </Field>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="win-button win-button-accent px-2.5 py-1.5 text-[12px]"
                  onClick={async () => {
                    if (!passwordDraft.next) {
                      setPasswordMessage(t('settings.passwordEmpty'));
                      return;
                    }
                    if (passwordDraft.next !== passwordDraft.confirm) {
                      setPasswordMessage(t('settings.passwordMismatch'));
                      return;
                    }
                    await system.setPassword(passwordDraft.next);
                    setPasswordDraft({ next: '', confirm: '' });
                    setPasswordMessage(t('settings.passwordSaved'));
                  }}
                >
                  <KeyRound size={13} /> {t('settings.updatePassword')}
                </button>
                <button type="button" className="win-button px-2.5 py-1.5 text-[12px]" onClick={() => void system.setPassword('')}>
                  {t('settings.removePassword')}
                </button>
                {passwordMessage ? <span className="text-[11.5px] opacity-70">{passwordMessage}</span> : null}
              </div>
              {system.account.hint ? <p className="mt-2 text-[11px] opacity-55">{t('settings.passwordHintLabel')}: {system.account.hint}</p> : null}
            </Card>
            <ToggleRow label={t('settings.autoSignIn')} description={t('settings.autoSignInHint')} checked={system.account.autoSignIn} onChange={(value) => void system.updateAccount({ autoSignIn: value })} />
            <Note tone="warning">{t('settings.passwordDisclaimer')}</Note>
          </>
        );

      case 'other-users':
        return (
          <>
            <Card title={t('settings.otherUsers')}>
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold text-white" style={{ background: system.account.avatarColor }}>
                  {system.account.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{system.account.displayName}</span>
                  <span className="block text-[11px] opacity-55">{t('settings.administrator')} · {system.accounts.length} {t('settings.accounts')}</span>
                </span>
                <Badge tone="accent">{t('settings.signedIn')}</Badge>
              </div>
            </Card>
            <Note tone="warning">{t('settings.otherUsersNote')}</Note>
          </>
        );

      case 'account-info':
        return (
          <Card title={t('settings.accountInfo')}>
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <Spec label={t('settings.displayName')} value={system.account.displayName} />
              <Spec label={t('settings.accountId')} value={system.account.id} />
              <Spec label={t('settings.signedInAt')} value={system.signedInAt ? formatDate(system.signedInAt, true) : '—'} />
              <Spec label={t('settings.passwordState')} value={system.account.passwordHash ? t('settings.passwordSet') : t('settings.noPassword')} />
            </dl>
          </Card>
        );

      case 'datetime':
        return (
          <>
            <Card title={t('settings.currentDateTime')}>
              <p className="text-[20px] font-semibold tabular-nums">{formatTime(new Date())}</p>
              <p className="text-[12px] opacity-70">{formatDate(new Date())}</p>
              <p className="mt-1 text-[11px] opacity-55" dir="ltr">
                {Intl.DateTimeFormat().resolvedOptions().timeZone} · UTC{new Date().getTimezoneOffset() / -60 >= 0 ? '+' : ''}
                {new Date().getTimezoneOffset() / -60}
              </p>
            </Card>
            <Card title={t('settings.firstDayOfWeek')}>
              <Segmented
                size="sm"
                value={String(settings.locale.firstDayOfWeek)}
                onChange={(value) => setLocale({ firstDayOfWeek: Number(value) as 0 | 1 | 6 })}
                options={[
                  { value: '0', label: t('cal.sunday') },
                  { value: '1', label: t('cal.monday') },
                  { value: '6', label: t('cal.saturday') },
                ]}
              />
            </Card>
            <Note>{t('settings.timezoneNote')}</Note>
          </>
        );

      case 'backup':
        return <BackupPage />;

      case 'language':
        return (
          <>
            <Card title={t('settings.displayLanguage')}>
              <div className="space-y-1">
                {([
                  { id: 'en', label: 'English', native: 'English' },
                  { id: 'fa', label: 'Persian', native: 'فارسی' },
                  { id: 'de', label: 'German', native: 'Deutsch' },
                ] as const).map((language) => (
                  <button key={language.id} type="button" className={`list-row w-full gap-2 ${settings.locale.language === language.id ? 'bg-[var(--accent-soft)]' : ''}`} onClick={() => setLanguage(language.id)}>
                    <span className="min-w-0 flex-1 text-start">
                      <span className="block text-[12.5px] font-medium">{language.native}</span>
                      <span className="block text-[10.5px] opacity-55">{language.label}</span>
                    </span>
                    {settings.locale.language === language.id ? <Check size={14} className="text-[var(--accent)]" /> : null}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] opacity-55">{t('settings.languageHint')}</p>
            </Card>
          </>
        );

      case 'keyboard-layout':
        return (
          <>
            <Card title={t('settings.keyboardLayouts')}>
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5">
                  <Keyboard size={14} className="opacity-60" />
                  <span className="flex-1">English (US) — QWERTY</span>
                  <Badge tone="success">{t('settings.active')}</Badge>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5">
                  <Keyboard size={14} className="opacity-60" />
                  <span className="flex-1">Persian (Standard) — فارسی</span>
                  <Badge tone={settings.locale.language === 'fa' ? 'accent' : 'neutral'}>{settings.locale.language === 'fa' ? t('settings.active') : t('settings.available')}</Badge>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-[var(--border)] px-2.5 py-1.5">
                  <Keyboard size={14} className="opacity-60" />
                  <span className="flex-1">German — QWERTZ</span>
                  <Badge tone={settings.locale.language === 'de' ? 'accent' : 'neutral'}>{settings.locale.language === 'de' ? t('settings.active') : t('settings.available')}</Badge>
                </div>
              </div>
              <p className="mt-2 text-[11px] opacity-55">{t('settings.keyboardLayoutHint')}</p>
            </Card>
          </>
        );

      case 'date-format':
        return (
          <>
            <Card title={t('settings.calendar')}>
              <Segmented
                size="sm"
                value={settings.locale.calendar}
                onChange={(value) => setLocale({ calendar: value as 'gregory' | 'persian' })}
                options={[
                  { value: 'gregory', label: t('settings.calendarGregorian') },
                  { value: 'persian', label: t('settings.calendarPersian') },
                ]}
              />
              <p className="mt-2 text-[12px] opacity-75">{formatDate(new Date())}</p>
            </Card>
            <Card title={t('settings.numberSystem')}>
              <Segmented
                size="sm"
                value={settings.locale.numberSystem}
                onChange={(value) => setLocale({ numberSystem: value as 'latn' | 'arabext' })}
                options={[
                  { value: 'latn', label: '1234567890' },
                  { value: 'arabext', label: '۱۲۳۴۵۶۷۸۹۰' },
                ]}
              />
            </Card>
            <Card title={t('settings.dateFormat')}>
              <Segmented
                size="sm"
                value={settings.locale.dateFormat}
                onChange={(value) => setLocale({ dateFormat: value as 'auto' | 'iso' | 'local' })}
                options={[
                  { value: 'auto', label: t('settings.formatAuto') },
                  { value: 'iso', label: 'ISO (YYYY-MM-DD)' },
                  { value: 'local', label: t('settings.formatLocal') },
                ]}
              />
            </Card>
            <Card title={t('acc.currency')}>
              <Select
                value={settings.locale.currency}
                onChange={(value) => setLocale({ currency: value })}
                options={['USD', 'EUR', 'GBP', 'SEK', 'NOK', 'DKK', 'CHF', 'CAD', 'AUD', 'JPY', 'TRY', 'AED', 'IRR'].map((code) => ({ value: code, label: code }))}
              />
            </Card>
          </>
        );

      case 'privacy-dashboard':
        return (
          <>
            <Card title={t('settings.privacyDashboard')}>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { key: 'notificationsEnabled', label: t('settings.notificationsEnabled') },
                  { key: 'activityHistory', label: t('settings.activityHistory') },
                  { key: 'locationEnabled', label: t('settings.location') },
                  { key: 'cameraEnabled', label: t('settings.camera') },
                  { key: 'microphoneEnabled', label: t('settings.microphone') },
                  { key: 'analyticsEnabled', label: t('settings.analytics') },
                ] as const).map((item) => (
                  <div key={item.key} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    <ShieldCheck size={15} className={settings.privacy[item.key] ? 'text-emerald-500' : 'opacity-40'} />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{item.label}</span>
                    <Badge tone={settings.privacy[item.key] ? 'success' : 'neutral'}>{settings.privacy[item.key] ? t('settings.on') : t('settings.off')}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Note>{t('settings.privacyNote')}</Note>
          </>
        );

      case 'permissions':
        return (
          <>
            <ToggleRow label={t('settings.location')} description={t('settings.locationHint')} checked={settings.privacy.locationEnabled} onChange={(value) => setPrivacy({ locationEnabled: value })} />
            <ToggleRow label={t('settings.camera')} description={t('settings.cameraHint')} checked={settings.privacy.cameraEnabled} onChange={(value) => setPrivacy({ cameraEnabled: value })} />
            <ToggleRow label={t('settings.microphone')} description={t('settings.microphoneHint')} checked={settings.privacy.microphoneEnabled} onChange={(value) => setPrivacy({ microphoneEnabled: value })} />
            <ToggleRow label={t('settings.analytics')} description={t('settings.analyticsHint')} checked={settings.privacy.analyticsEnabled} onChange={(value) => setPrivacy({ analyticsEnabled: value })} />
            <Note tone="warning">{t('settings.permissionsNote')}</Note>
          </>
        );

      case 'activity':
        return (
          <>
            <ToggleRow label={t('settings.activityHistory')} description={t('settings.activityHistoryHint')} checked={settings.privacy.activityHistory} onChange={(value) => setPrivacy({ activityHistory: value })} />
            <Card
              title={`${t('settings.recentActivity')} (${system.activity.length})`}
              action={
                <button type="button" className="win-button px-2 py-1 text-[11.5px]" onClick={() => system.clearActivity()} disabled={!system.activity.length}>
                  {t('settings.clearActivity')}
                </button>
              }
            >
              {system.activity.length ? (
                <ul className="space-y-1">
                  {system.activity.slice(0, 20).map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 text-[11.5px]">
                      <Activity size={12} className="opacity-50" />
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                      <span className="shrink-0 text-[10px] opacity-45">{formatTime(entry.at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11.5px] opacity-55">{t('settings.noActivity')}</p>
              )}
            </Card>
          </>
        );

      case 'security':
        return (
          <>
            <Card title={t('settings.securityStatus')}>
              <div className="flex items-center gap-3">
                <Shield size={26} className="text-emerald-500" />
                <div>
                  <p className="text-[13px] font-semibold">{t('settings.securityOk')}</p>
                  <p className="text-[11.5px] opacity-60">{t('settings.securityOkHint')}</p>
                </div>
              </div>
            </Card>
            <Card title={t('settings.securityChecks')}>
              {[
                { label: t('settings.checkStorage'), ok: fs.storageAvailable },
                { label: t('settings.checkPassword'), ok: Boolean(system.account.passwordHash) },
                { label: t('settings.checkNotifications'), ok: settings.privacy.notificationsEnabled },
                { label: t('settings.checkUpdates'), ok: system.updateState !== 'error' },
              ].map((check) => (
                <div key={check.label} className="flex items-center gap-2 border-b border-[var(--border)] py-1.5 text-[12px] last:border-0">
                  <span className={check.ok ? 'text-emerald-500' : 'text-amber-500'}>{check.ok ? <Check size={14} /> : <Eye size={14} />}</span>
                  <span className="flex-1">{check.label}</span>
                  <Badge tone={check.ok ? 'success' : 'warning'}>{check.ok ? t('settings.on') : t('settings.attention')}</Badge>
                </div>
              ))}
            </Card>
            <Note tone="warning">{t('settings.securityDisclaimer')}</Note>
          </>
        );

      case 'windows-update':
        return (
          <>
            <Card
              title={t('settings.update')}
              action={
                <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" disabled={system.updateState === 'checking'} onClick={() => void system.checkForUpdates()}>
                  <RefreshCw size={13} className={system.updateState === 'checking' ? 'animate-spin' : ''} /> {t('settings.checkForUpdates')}
                </button>
              }
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${system.updateState === 'error' ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                  {system.updateState === 'checking' ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} />}
                </span>
                <div>
                  <p className="text-[13px] font-semibold">{t(`settings.updateState.${system.updateState}` as TranslationKey)}</p>
                  <p className="text-[11.5px] opacity-60">
                    {system.lastUpdateCheck ? `${t('settings.lastCheck')}: ${formatDate(system.lastUpdateCheck, true)}` : t('settings.neverChecked')}
                  </p>
                </div>
              </div>
            </Card>
            <Card title={t('settings.updateOptions')}>
              <ToggleRow label={t('settings.showBootAnimation')} description={t('settings.showBootAnimationHint')} checked={settings.power.showBootAnimation} onChange={(value) => setPower({ showBootAnimation: value })} />
            </Card>
            <Note tone="warning">{t('settings.updateDisclaimer')}</Note>
          </>
        );

      default:
        return <EmptyState icon={<Sliders size={36} />} title={t('settings.sectionMissing')} message={section} />;
    }
  };

  return (
    <div className="flex h-full bg-[var(--surface-solid)] text-[var(--text)]">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-e border-[var(--border)] bg-[var(--surface-2)]">
        <div className="border-b border-[var(--border)] p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: system.account.avatarColor }}>
              {system.account.displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium">{system.account.displayName}</span>
              <span className="block truncate text-[10.5px] opacity-55">{t('settings.localAccount')}</span>
            </span>
          </div>
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 opacity-50" />
            <input className="win-input h-8 w-full ps-7 text-[12px]" placeholder={t('settings.searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>

        <nav className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
          {filteredGroups.map((group) => (
            <div key={group.id} className="mb-1.5">
              <p className="flex items-center gap-2 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide opacity-50">
                {GROUP_ICONS[group.icon] ?? <Sliders size={13} />}
                {t(group.labelKey)}
              </p>
              {group.sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`list-row w-full gap-2 text-[12px] ${section === item.id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : ''}`}
                  onClick={() => setSection(item.id)}
                >
                  <span className="min-w-0 flex-1 truncate text-start">{t(item.labelKey)}</span>
                  {item.simulated ? <span className="shrink-0 rounded bg-[var(--hover)] px-1 text-[9px] uppercase opacity-60">{t('common.simulated')}</span> : null}
                  {section === item.id ? <ChevronRight size={13} className="shrink-0 opacity-50" /> : null}
                </button>
              ))}
            </div>
          ))}
          {!filteredGroups.length ? <p className="p-3 text-center text-[11.5px] opacity-55">{t('settings.noResults')}</p> : null}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-wide opacity-50">
              {current ? t(SETTINGS_GROUPS.find((group) => group.id === current.group)?.labelKey ?? 'settings.title') : t('app.settings')}
            </p>
            <h2 className="truncate text-[15px] font-semibold">{current ? t(current.labelKey) : t('app.settings')}</h2>
          </div>
          <div className="ms-auto flex items-center gap-2">
            {current?.simulated ? <Badge tone="warning">{t('common.simulated')}</Badge> : null}
            <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => launchApp('explorer')}>
              <AppWindow size={13} /> {t('explorer.thisPc')}
            </button>
          </div>
        </header>

        <div className="print-area scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{renderSection()}</div>
      </div>

    </div>
  );

  async function importBackup() {
    const files = await pickFiles('.json,application/json', false);
    if (!files.length) return;
    const text = await readFileAsText(files[0]);
    const ok = await fs.importAll(text);
    openDialog({
      kind: 'alert',
      title: t('settings.importBackup'),
      message: ok ? t('settings.importSuccess') : t('settings.importFailed'),
    });
  }
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <header className="mb-2 flex items-center gap-2">
        <h3 className="text-[12.5px] font-semibold">{title}</h3>
        <div className="ms-auto">{action}</div>
      </header>
      {children}
    </section>
  );
}

function Note({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'danger' }) {
  const toneClass = tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400' : tone === 'danger' ? 'border-red-500/40 bg-red-500/10 text-red-500' : 'border-[var(--border)] bg-[var(--surface-2)] opacity-70';
  return <p className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${toneClass}`}>{children}</p>;
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5">
      <dt className="text-[10.5px] uppercase tracking-wide opacity-50">{label}</dt>
      <dd className="truncate text-[12px]">{value}</dd>
    </div>
  );
}


function BackupPage() {
  const { t } = useT();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const doExport = async () => {
    setBusy(true);
    try {
      const filename = await downloadBackup();
      setStatus(t('settings.backup.exported', { filename }));
      notify(t('settings.backup.exportedTitle'), filename, 'success', 'settings');
    } catch (error) {
      setStatus(String(error));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    setStatus(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const payload = decodeBackup(bytes);
      await applyBackup(payload);
      setStatus(t('settings.backup.restored'));
      window.setTimeout(() => window.location.reload(), 1000);
    } catch {
      setStatus(t('settings.backup.invalid'));
      setBusy(false);
    }
  };

  return (
    <Card title={t('settings.backup')}>
      <p className="mb-3 text-[12px] leading-relaxed opacity-70">{t('settings.backupDesc')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="win-button win-button-accent text-[12px]" onClick={() => void doExport()} disabled={busy}>
          <HardDriveDownload size={14} /> {t('settings.backupExport')}
        </button>
        <button type="button" className="win-button text-[12px]" onClick={() => fileRef.current?.click()} disabled={busy}>
          <HardDriveUpload size={14} /> {t('settings.backupImport')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".win12,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void doImport(file);
            event.target.value = '';
          }}
        />
      </div>
      {status ? <p className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px]">{status}</p> : null}
      <p className="mt-3 text-[10.5px] leading-relaxed opacity-50">{t('settings.backupNote')}</p>
    </Card>
  );
}

export default SettingsApp;
