import { useState } from 'react';
import {
  Accessibility,
  Battery,
  BatteryCharging,
  Bluetooth,
  Cast,
  ChevronRight,
  Focus,
  Monitor,
  Moon,
  Pencil,
  Plane,
  Power,
  Settings2,
  Volume2,
  VolumeX,
  Wifi,
  Sun,
  RotateCcw,
  LogOut,
  Lock,
  Check,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSystemStore } from '../../stores/systemStore';
import { useShellStore } from '../../stores/shellStore';
import { DEMO_NETWORKS, useQuickSettingsStore } from '../../stores/quickSettingsStore';
import { useT } from '../../i18n';
import { useClickOutside } from '../../hooks/useUi';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { launchApp } from '../../services/launcher';
import { playSound } from '../../services/sound';

type Expanded = 'wifi' | 'bluetooth' | 'accessibility' | 'cast' | 'project' | null;

export function QuickSettings() {
  const { t, isRTL } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const settings = useSettingsStore((state) => state.settings);
  const setNetwork = useSettingsStore((state) => state.setNetwork);
  const setDisplay = useSettingsStore((state) => state.setDisplay);
  const setSound = useSettingsStore((state) => state.setSound);
  const setPower = useSettingsStore((state) => state.setPower);
  const setPrivacy = useSettingsStore((state) => state.setPrivacy);
  const battery = useSystemStore((state) => state.battery);
  const accessibility = useSystemStore((state) => state.accessibility);
  const setAccessibility = useSystemStore((state) => state.setAccessibility);
  const quick = useQuickSettingsStore();

  const [expanded, setExpanded] = useState<Expanded>(null);
  const [editing, setEditing] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  const open = panel === 'quick';
  const ref = useClickOutside<HTMLDivElement>(() => open && setPanel(null), open);

  if (!open) return null;

  const tiles = quick.tiles;
  const tile = (id: string) => tiles.includes(id) || editing;

  return (
    <div
      ref={ref}
      className="panel animate-slide-up fixed z-[7000] w-[min(420px,calc(100vw-20px))] p-3"
      style={{ bottom: TASKBAR_HEIGHT + 10, [isRTL ? 'left' : 'right']: 10 } as React.CSSProperties}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={t('quick.title')}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold">{t('quick.title')}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="icon-button h-7 w-7 rounded-md"
            onClick={() => setEditing((value) => !value)}
            title={t('quick.edit')}
            aria-label={t('quick.edit')}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="icon-button h-7 w-7 rounded-md"
            onClick={() => {
              setPanel(null);
              launchApp('settings');
            }}
            title={t('quick.allSettings')}
            aria-label={t('quick.allSettings')}
          >
            <Settings2 size={14} />
          </button>
          <div className="relative">
            <button
              type="button"
              className="icon-button h-7 w-7 rounded-md"
              onClick={() => setPowerOpen((value) => !value)}
              title={t('quick.power')}
              aria-label={t('quick.power')}
            >
              <Power size={14} />
            </button>
            {powerOpen ? (
              <div className={`panel absolute ${isRTL ? 'left-0' : 'right-0'} top-8 w-48 p-1`}>
                <Row icon={<Lock size={14} />} label={t('start.lock')} onClick={() => { setPanel(null); useSystemStore.getState().lock(); }} />
                <Row icon={<LogOut size={14} />} label={t('start.signOut')} onClick={() => { setPanel(null); useSystemStore.getState().signOut(); }} />
                <Row icon={<RotateCcw size={14} />} label={t('start.restart')} onClick={() => { setPanel(null); useSystemStore.getState().restart(); }} />
                <Row icon={<Power size={14} />} label={t('start.shutdown')} onClick={() => { setPanel(null); useSystemStore.getState().shutdown(); }} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-3 gap-2">
        {tile('wifi') ? (
          <Tile
            label={settings.network.connectedNetwork ?? t('quick.wifi')}
            sub={settings.network.wifiEnabled ? (settings.network.status === 'connected' ? 'Connected' : 'Limited') : 'Off'}
            active={settings.network.wifiEnabled}
            icon={<Wifi size={17} />}
            editing={editing}
            visible={tiles.includes('wifi')}
            onToggleVisibility={() => quick.toggleTile('wifi')}
            onClick={() => {
              if (editing) return quick.toggleTile('wifi');
              setNetwork({ wifiEnabled: !settings.network.wifiEnabled });
              playSound('click');
            }}
            onExpand={() => setExpanded(expanded === 'wifi' ? null : 'wifi')}
          />
        ) : null}
        {tile('bluetooth') ? (
          <Tile
            label={t('quick.bluetooth')}
            sub={settings.network.bluetoothEnabled ? `${quick.bluetoothDevices.filter((d) => d.connected).length} connected` : 'Off'}
            active={settings.network.bluetoothEnabled}
            icon={<Bluetooth size={17} />}
            editing={editing}
            visible={tiles.includes('bluetooth')}
            onToggleVisibility={() => quick.toggleTile('bluetooth')}
            onClick={() => {
              if (editing) return quick.toggleTile('bluetooth');
              setNetwork({ bluetoothEnabled: !settings.network.bluetoothEnabled });
            }}
            onExpand={() => setExpanded(expanded === 'bluetooth' ? null : 'bluetooth')}
          />
        ) : null}
        {tile('airplane') ? (
          <Tile
            label={t('quick.airplane')}
            active={settings.network.airplaneMode}
            icon={<Plane size={17} />}
            editing={editing}
            visible={tiles.includes('airplane')}
            onToggleVisibility={() => quick.toggleTile('airplane')}
            onClick={() => {
              if (editing) return quick.toggleTile('airplane');
              setNetwork({ airplaneMode: !settings.network.airplaneMode });
            }}
          />
        ) : null}
        {tile('batterySaver') ? (
          <Tile
            label={t('quick.batterySaver')}
            active={settings.power.batterySaver}
            icon={<Battery size={17} />}
            editing={editing}
            visible={tiles.includes('batterySaver')}
            onToggleVisibility={() => quick.toggleTile('batterySaver')}
            onClick={() => {
              if (editing) return quick.toggleTile('batterySaver');
              setPower({ batterySaver: !settings.power.batterySaver });
            }}
          />
        ) : null}
        {tile('nightLight') ? (
          <Tile
            label={t('quick.nightLight')}
            active={settings.display.nightLight}
            icon={<Moon size={17} />}
            editing={editing}
            visible={tiles.includes('nightLight')}
            onToggleVisibility={() => quick.toggleTile('nightLight')}
            onClick={() => {
              if (editing) return quick.toggleTile('nightLight');
              setDisplay({ nightLight: !settings.display.nightLight });
            }}
          />
        ) : null}
        {tile('accessibility') ? (
          <Tile
            label={t('quick.accessibility')}
            active={accessibility.textSize !== 100 || accessibility.highContrast}
            icon={<Accessibility size={17} />}
            editing={editing}
            visible={tiles.includes('accessibility')}
            onToggleVisibility={() => quick.toggleTile('accessibility')}
            onClick={() => {
              if (editing) return quick.toggleTile('accessibility');
              setExpanded(expanded === 'accessibility' ? null : 'accessibility');
            }}
          />
        ) : null}
        {tile('focus') ? (
          <Tile
            label={t('settings.focus')}
            active={settings.privacy.focusAssist}
            icon={<Focus size={17} />}
            editing={editing}
            visible={tiles.includes('focus')}
            onToggleVisibility={() => quick.toggleTile('focus')}
            onClick={() => {
              if (editing) return quick.toggleTile('focus');
              setPrivacy({ focusAssist: !settings.privacy.focusAssist });
            }}
          />
        ) : null}
        {tile('cast') ? (
          <Tile
            label={t('quick.cast')}
            sub={quick.casting ? quick.castTarget ?? 'Casting' : undefined}
            active={quick.casting}
            icon={<Cast size={17} />}
            editing={editing}
            visible={tiles.includes('cast')}
            onToggleVisibility={() => quick.toggleTile('cast')}
            onClick={() => {
              if (editing) return quick.toggleTile('cast');
              setExpanded(expanded === 'cast' ? null : 'cast');
            }}
          />
        ) : null}
        {tile('project') ? (
          <Tile
            label={t('quick.project')}
            sub={quick.projectorMode}
            icon={<Monitor size={17} />}
            editing={editing}
            visible={tiles.includes('project')}
            onToggleVisibility={() => quick.toggleTile('project')}
            onClick={() => {
              if (editing) return quick.toggleTile('project');
              setExpanded(expanded === 'project' ? null : 'project');
            }}
          />
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] p-2">
          <p className="mb-1.5 text-[11px] font-semibold opacity-70">{t('quick.edit')}</p>
          <div className="flex flex-wrap gap-1.5">
            {['wifi', 'bluetooth', 'airplane', 'batterySaver', 'nightLight', 'accessibility', 'focus', 'cast', 'project'].map((id) => (
              <button
                key={id}
                type="button"
                className={`win-button gap-1 px-2 py-1 text-[11px] ${tiles.includes(id) ? 'win-button-accent' : ''}`}
                onClick={() => quick.toggleTile(id)}
              >
                {tiles.includes(id) ? <Check size={11} /> : null}
                {labelForTile(id, t)}
              </button>
            ))}
          </div>
          <button type="button" className="win-button mt-2 w-full text-[11px]" onClick={() => setEditing(false)}>
            {t('common.done')}
          </button>
        </div>
      ) : null}

      {/* Expanded sub-panels */}
      {expanded === 'wifi' ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] p-2">
          <p className="mb-1.5 text-[11px] font-semibold opacity-70">{t('quick.networks')}</p>
          <div className="space-y-0.5">
            {DEMO_NETWORKS.map((network) => {
              const connected = settings.network.connectedNetwork === network.ssid && settings.network.wifiEnabled;
              return (
                <button
                  key={network.ssid}
                  type="button"
                  className="list-row w-full justify-between"
                  onClick={() => setNetwork({ wifiEnabled: true, airplaneMode: false, connectedNetwork: network.ssid, status: 'connected' })}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Wifi size={14} className={connected ? 'text-[var(--accent)]' : 'opacity-60'} />
                    <span className="truncate">{network.ssid}</span>
                    {!network.secured ? <span className="text-[10px] opacity-50">Open</span> : null}
                  </span>
                  <span className="flex items-center gap-2 text-[10.5px] opacity-60">
                    <span className="inline-block h-1.5 w-10 rounded-full bg-[var(--border-strong)]">
                      <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${network.signal}%` }} />
                    </span>
                    {connected ? <Check size={13} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {expanded === 'bluetooth' ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] p-2">
          <p className="mb-1.5 text-[11px] font-semibold opacity-70">{t('quick.devices')}</p>
          <div className="space-y-0.5">
            {quick.bluetoothDevices.map((device) => (
              <div key={device.id} className="list-row w-full justify-between">
                <span className="flex min-w-0 items-center gap-2">
                  <Bluetooth size={14} className={device.connected ? 'text-[var(--accent)]' : 'opacity-60'} />
                  <span className="truncate">{device.name}</span>
                  {!device.paired ? <span className="text-[10px] opacity-50">Not paired</span> : null}
                </span>
                <button
                  type="button"
                  className={`win-button px-2 py-0.5 text-[11px] ${device.connected ? 'win-button-accent' : ''}`}
                  disabled={!settings.network.bluetoothEnabled}
                  onClick={() => {
                    if (!device.paired) quick.pairBluetoothDevice(device.id);
                    quick.toggleBluetoothDevice(device.id, !device.connected);
                  }}
                >
                  {device.connected ? 'Disconnect' : device.paired ? 'Connect' : 'Pair'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {expanded === 'accessibility' ? (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] p-2">
          <p className="text-[11px] font-semibold opacity-70">{t('a11y.title')}</p>
          <Slider
            label={`${t('a11y.textSize')} · ${accessibility.textSize}%`}
            value={accessibility.textSize}
            min={100}
            max={160}
            step={10}
            onChange={(value) => setAccessibility({ textSize: value })}
          />
          <ToggleRow label={t('a11y.contrast')} checked={accessibility.highContrast} onChange={(value) => setAccessibility({ highContrast: value })} />
          <ToggleRow label={t('settings.reduceMotion')} checked={settings.display.reduceMotion} onChange={(value) => setDisplay({ reduceMotion: value })} />
          <ToggleRow
            label={t('a11y.magnifier')}
            checked={accessibility.cursorSize > 100}
            onChange={(value) => setAccessibility({ cursorSize: value ? 160 : 100 })}
          />
          <button type="button" className="win-button w-full text-[11px]" onClick={() => setAccessibility({ textSize: 100, highContrast: false, zoom: 100, cursorSize: 100 })}>
            {t('a11y.reset')}
          </button>
        </div>
      ) : null}

      {expanded === 'cast' ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] p-2">
          <p className="mb-1.5 text-[11px] font-semibold opacity-70">{t('quick.cast')}</p>
          {['Living room TV (demo)', 'Office display (demo)', 'Bedroom speaker (demo)'].map((target) => (
            <button
              key={target}
              type="button"
              className="list-row w-full justify-between"
              onClick={() => quick.setCasting(!quick.casting || quick.castTarget !== target, target)}
            >
              <span className="flex items-center gap-2">
                <Cast size={14} className={quick.castTarget === target && quick.casting ? 'text-[var(--accent)]' : 'opacity-60'} />
                {target}
              </span>
              {quick.castTarget === target && quick.casting ? <Check size={13} /> : null}
            </button>
          ))}
          <p className="mt-1 px-1 text-[10px] leading-snug opacity-50">{t('quick.simulatedNote')}</p>
        </div>
      ) : null}

      {expanded === 'project' ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] p-2">
          <p className="mb-1.5 text-[11px] font-semibold opacity-70">{t('quick.project')}</p>
          {(['pc-only', 'duplicate', 'extend', 'second-screen-only'] as const).map((mode) => (
            <button key={mode} type="button" className="list-row w-full justify-between" onClick={() => quick.setProjectorMode(mode)}>
              <span className="capitalize">{mode.replaceAll('-', ' ')}</span>
              {quick.projectorMode === mode ? <Check size={13} /> : null}
            </button>
          ))}
          <p className="mt-1 px-1 text-[10px] leading-snug opacity-50">{t('quick.simulatedNote')}</p>
        </div>
      ) : null}

      {/* Sliders */}
      <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="icon-button h-8 w-8 rounded-md"
            onClick={() => setSound({ muted: !settings.sound.muted })}
            title={settings.sound.muted ? 'Unmute' : t('settings.mute')}
            aria-label={settings.sound.muted ? 'Unmute' : t('settings.mute')}
          >
            {settings.sound.muted || settings.sound.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.sound.muted ? 0 : settings.sound.volume}
            onChange={(event) => setSound({ volume: Number(event.target.value), muted: false })}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border-strong)] accent-[var(--accent)]"
            aria-label={t('quick.volume')}
          />
          <span className="w-9 text-end text-[11px] tabular-nums opacity-70">{settings.sound.muted ? 0 : settings.sound.volume}%</span>
        </div>
        <p className="px-1 text-[10px] leading-snug opacity-45">{t('quick.deviceVolumeNote')}</p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="icon-button h-8 w-8 rounded-md"
            onClick={() => setDisplay({ nightLight: !settings.display.nightLight })}
            title={t('quick.nightLight')}
            aria-label={t('quick.nightLight')}
          >
            {settings.display.nightLight ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <input
            type="range"
            min={10}
            max={100}
            value={settings.display.brightness}
            onChange={(event) => setDisplay({ brightness: Number(event.target.value) })}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border-strong)] accent-[var(--accent)]"
            aria-label={t('quick.brightness')}
          />
          <span className="w-9 text-end text-[11px] tabular-nums opacity-70">{settings.display.brightness}%</span>
        </div>
      </div>

      {/* Battery */}
      <div className="mt-2 flex items-center justify-between rounded-lg border border-[var(--border)] px-2.5 py-2">
        <span className="flex items-center gap-2 text-[12px]">
          {battery.charging ? <BatteryCharging size={16} /> : <Battery size={16} />}
          {battery.level}% {battery.charging ? '· charging' : ''}
        </span>
        <span className="text-[10px] opacity-50">{t('common.simulated')}</span>
      </div>

      <p className="mt-2 px-1 text-[10px] leading-snug opacity-40">{t('quick.simulatedNote')}</p>

    </div>
  );
}

function labelForTile(id: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    wifi: 'quick.wifi',
    bluetooth: 'quick.bluetooth',
    airplane: 'quick.airplane',
    batterySaver: 'quick.batterySaver',
    nightLight: 'quick.nightLight',
    accessibility: 'quick.accessibility',
    focus: 'settings.focus',
    cast: 'quick.cast',
    project: 'quick.project',
  };
  return t(map[id] ?? id);
}

interface TileProps {
  label: string;
  sub?: string;
  icon: React.ReactNode;
  active?: boolean;
  editing?: boolean;
  visible?: boolean;
  onClick: () => void;
  onExpand?: () => void;
  onToggleVisibility?: () => void;
}

function Tile({ label, sub, icon, active, editing, visible = true, onClick, onExpand }: TileProps) {
  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border p-2 transition ${
        active ? 'border-transparent bg-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--hover)]'
      } ${editing && !visible ? 'opacity-45' : ''}`}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 text-start">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[11.5px] font-medium leading-tight">{label}</span>
          {sub ? <span className={`block truncate text-[10px] leading-tight ${active ? 'text-white/75' : 'opacity-55'}`}>{sub}</span> : null}
        </span>
      </button>
      {onExpand && !editing ? (
        <button
          type="button"
          className={`icon-button h-6 w-5 shrink-0 rounded ${active ? 'text-white/80 hover:bg-white/20' : ''}`}
          onClick={onExpand}
          aria-label={`${label} — ${'expand'}`}
        >
          <ChevronRight size={13} />
        </button>
      ) : null}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] opacity-70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border-strong)] accent-[var(--accent)]"
      />
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" className="list-row w-full justify-between" onClick={() => onChange(!checked)}>
      <span className="text-[12px]">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

function Row({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="list-row w-full gap-2" onClick={onClick}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export default QuickSettings;
