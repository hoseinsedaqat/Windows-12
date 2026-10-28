import { useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, HardDrive, MemoryStick, Search, XCircle, ArrowUpRight, Gauge } from 'lucide-react';
import { useT } from '../../i18n';
import { useWindowStore } from '../../stores/windowStore';
import { getApp, listedApps } from '../../core/ApplicationRegistry';
import { AppIcon } from '../../components/icons/AppIcons';
import { Segmented, LineChart, Badge } from '../../components/ui/Controls';
import { formatBytes, formatNumber } from '../../services/format';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ChartPoint } from '../../components/ui/Controls';

interface ProcessRow {
  id: string;
  appId: string;
  name: string;
  kind: 'app' | 'system';
  windows: number;
  memoryMb: number;
  cpu: number;
  state: 'running' | 'minimized' | 'background';
  windowIds: string[];
}

const SYSTEM_PROCESSES: { appId: string; name: string; memoryMb: number }[] = [
  { appId: 'shell', name: 'Concept Shell', memoryMb: 96 },
  { appId: 'dwm', name: 'Desktop Window Manager', memoryMb: 74 },
  { appId: 'fs', name: 'Virtual File System Service', memoryMb: 42 },
  { appId: 'notify', name: 'Notification Service', memoryMb: 18 },
  { appId: 'settings', name: 'Settings Host', memoryMb: 26 },
  { appId: 'indexer', name: 'Search Indexer', memoryMb: 33 },
];

const BASE_MEMORY: Record<string, number> = {
  explorer: 58,
  chrome: 142,
  word: 88,
  excel: 96,
  powerpoint: 104,
  notepad: 22,
  notes: 26,
  accounting: 74,
  calculator: 14,
  calendar: 24,
  clock: 18,
  photos: 96,
  paint: 52,
  terminal: 16,
  taskmanager: 34,
  settings: 46,
  run: 8,
  recyclebin: 32,
};

export function TaskManagerApp() {
  const { t, bcp47 } = useT();
  const windows = useWindowStore((state) => state.windows);
  const close = useWindowStore((state) => state.closeWindow);
  const focus = useWindowStore((state) => state.focus);
  const restore = useWindowStore((state) => state.restore);
  const endTask = useWindowStore((state) => state.endTask);
  const nodes = useFileSystemStore((state) => state.nodes);
  const usedBytes = useFileSystemStore((state) => state.usedBytes);
  const quotaMB = useSettingsStore((state) => state.settings.storageQuotaMB);

  const [tab, setTab] = useState<'processes' | 'performance' | 'apps'>('processes');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'name' | 'memory' | 'cpu'>('memory');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [cpuHistory, setCpuHistory] = useState<ChartPoint[]>([]);
  const [memHistory, setMemHistory] = useState<ChartPoint[]>([]);

  /* Simulated CPU sampling — the browser exposes no real per-app CPU numbers. */
  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1500);
    return () => window.clearInterval(interval);
  }, []);

  const processes = useMemo<ProcessRow[]>(() => {
    const byApp = new Map<string, ProcessRow>();
    for (const win of windows) {
      const app = getApp(win.appId);
      const existing = byApp.get(win.appId);
      const base = BASE_MEMORY[win.appId] ?? 40;
      // Deterministic-ish jitter so numbers move without being random noise.
      const jitter = ((Math.sin((tick + win.id.length * 7) * 1.7) + 1) / 2) * 12;
      if (existing) {
        existing.windows += 1;
        existing.windowIds.push(win.id);
        existing.memoryMb += base * 0.35 + jitter * 0.4;
        if (!win.minimized) existing.state = 'running';
      } else {
        byApp.set(win.appId, {
          id: win.appId,
          appId: win.appId,
          name: app?.name ?? win.appId,
          kind: 'app',
          windows: 1,
          memoryMb: base + jitter,
          cpu: Math.max(0, Math.round((jitter / 12) * 9 * 10) / 10),
          state: win.minimized ? 'minimized' : 'running',
          windowIds: [win.id],
        });
      }
    }

    const systemRows: ProcessRow[] = SYSTEM_PROCESSES.map((process) => ({
      id: `system-${process.appId}`,
      appId: process.appId,
      name: process.name,
      kind: 'system',
      windows: 0,
      memoryMb: process.memoryMb + ((Math.sin(tick * 0.9 + process.memoryMb) + 1) / 2) * 6,
      cpu: Math.round(((Math.sin(tick * 1.3 + process.memoryMb) + 1) / 2) * 4 * 10) / 10,
      state: 'background',
      windowIds: [],
    }));

    return [...byApp.values(), ...systemRows];
  }, [tick, windows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = processes.filter((process) => !needle || process.name.toLowerCase().includes(needle) || process.appId.includes(needle));
    return list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'cpu') return b.cpu - a.cpu;
      return b.memoryMb - a.memoryMb;
    });
  }, [processes, query, sort]);

  const totals = useMemo(() => {
    const memory = processes.reduce((sum, process) => sum + process.memoryMb, 0);
    const cpu = processes.reduce((sum, process) => sum + process.cpu, 0);
    return { memory, cpu: Math.min(100, cpu), files: Object.keys(nodes).length };
  }, [nodes, processes]);

  useEffect(() => {
    setCpuHistory((current) => [...current.slice(-23), { label: '', value: Math.round(totals.cpu) }]);
    setMemHistory((current) => [...current.slice(-23), { label: '', value: Math.round(totals.memory) }]);
  }, [totals.cpu, totals.memory]);

  const appUsage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const win of windows) counts.set(win.appId, (counts.get(win.appId) ?? 0) + 1);
    return listedApps()
      .map((app) => ({ app, count: counts.get(app.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [windows]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={(value) => setTab(value as typeof tab)}
          options={[
            { value: 'processes', label: t('tm.processes') },
            { value: 'performance', label: t('tm.performance') },
            { value: 'apps', label: t('tm.appHistory') },
          ]}
        />
        <div className="relative ms-auto">
          <Search size={13} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 opacity-50" />
          <input className="win-input h-8 w-44 ps-7 text-[12px]" placeholder={t('tm.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>

      {tab === 'processes' ? (
        <>
          <div className="grid grid-cols-[1.6fr_repeat(4,minmax(0,1fr))_auto] gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide opacity-60">
            <button type="button" className="text-start hover:opacity-100" onClick={() => setSort('name')}>
              {t('tm.name')}
            </button>
            <span>{t('tm.state')}</span>
            <button type="button" className="text-end hover:opacity-100" onClick={() => setSort('memory')}>
              {t('tm.memory')}
            </button>
            <button type="button" className="text-end hover:opacity-100" onClick={() => setSort('cpu')}>
              {t('tm.cpu')}
            </button>
            <span className="text-end">{t('tm.windows')}</span>
            <span />
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            {filtered.map((process) => (
              <div key={process.id}>
                <button
                  type="button"
                  className="grid w-full grid-cols-[1.6fr_repeat(4,minmax(0,1fr))_auto] items-center gap-2 border-b border-[var(--border)] px-3 py-1.5 text-start text-[12px] transition hover:bg-[var(--hover)]"
                  onClick={() => setExpanded((current) => (current === process.id ? null : process.id))}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {process.kind === 'app' ? <AppIcon appId={process.appId} size={16} /> : <Activity size={15} className="opacity-55" />}
                    <span className="truncate">{process.name}</span>
                    {process.kind === 'system' ? <Badge tone="neutral">{t('tm.system')}</Badge> : null}
                  </span>
                  <span className="truncate text-[11px] opacity-60">{process.state === 'running' ? t('tm.running') : process.state === 'minimized' ? t('tm.minimized') : t('tm.background')}</span>
                  <span className="text-end tabular-nums">{formatNumber(process.memoryMb, { locale: bcp47, maximumFractionDigits: 1 })} MB</span>
                  <span className="text-end tabular-nums">{formatNumber(process.cpu, { locale: bcp47, maximumFractionDigits: 1 })}%</span>
                  <span className="text-end tabular-nums opacity-70">{process.windows || '—'}</span>
                  <span className="flex items-center gap-1">
                    {process.windows ? (
                      <button
                        type="button"
                        className="icon-button h-6 w-6"
                        title={t('tm.switchTo')}
                        onClick={(event) => {
                          event.stopPropagation();
                          const first = windows.find((win) => win.id === process.windowIds[0]);
                          if (first) {
                            if (first.minimized) restore(first.id);
                            focus(first.id);
                          }
                        }}
                      >
                        <ArrowUpRight size={13} />
                      </button>
                    ) : null}
                    {process.kind === 'app' ? (
                      <button
                        type="button"
                        className="icon-button h-6 w-6 text-red-500"
                        title={t('tm.endTask')}
                        onClick={(event) => {
                          event.stopPropagation();
                          endTask(process.appId);
                        }}
                      >
                        <XCircle size={14} />
                      </button>
                    ) : null}
                  </span>
                </button>
                {expanded === process.id && process.windows ? (
                  <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                    {process.windowIds.map((id) => {
                      const win = windows.find((item) => item.id === id);
                      if (!win) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 py-0.5 text-[11.5px]">
                          <span className="min-w-0 flex-1 truncate opacity-80">{win.title}</span>
                          <span className="font-mono text-[10.5px] opacity-45" dir="ltr">
                            {Math.round(win.bounds.width)}×{Math.round(win.bounds.height)}
                          </span>
                          <span className="opacity-45">{win.minimized ? t('tm.minimized') : win.maximized ? t('tm.maximized') : t('tm.running')}</span>
                          <button type="button" className="win-button px-2 py-0.5 text-[10.5px]" onClick={() => close(win.id)}>
                            {t('common.close')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
            {!filtered.length ? <p className="p-6 text-center text-[12px] opacity-55">{t('tm.noResults')}</p> : null}
          </div>
        </>
      ) : null}

      {tab === 'performance' ? (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <MetricCard icon={<Cpu size={16} />} label={t('tm.cpu')} value={`${formatNumber(totals.cpu, { locale: bcp47, maximumFractionDigits: 1 })}%`} chart={cpuHistory} color="var(--accent)" />
            <MetricCard icon={<MemoryStick size={16} />} label={t('tm.memory')} value={`${formatNumber(totals.memory / 1024, { locale: bcp47, maximumFractionDigits: 2 })} GB`} chart={memHistory} color="#22c55e" />
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <p className="mb-2 flex items-center gap-2 text-[12.5px] font-semibold">
              <HardDrive size={15} /> {t('tm.disk')}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--hover)]">
              <span className="block h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.min(100, (usedBytes / (quotaMB * 1024 * 1024)) * 100)}%` }} />
            </div>
            <p className="mt-2 text-[11.5px] opacity-70">
              {formatBytes(usedBytes)} / {formatBytes(quotaMB * 1024 * 1024)} · {totals.files} nodes
            </p>
            <p className="mt-1 text-[10.5px] opacity-50">{t('tm.diskNote')}</p>
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed opacity-55">{t('tm.simulatedNote')}</p>
        </div>
      ) : null}

      {tab === 'apps' ? (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('tm.installedApps')}</p>
          <div className="grid grid-cols-2 gap-2">
            {appUsage.map(({ app, count }) => (
              <div key={app.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
                <AppIcon appId={app.id} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium">{app.name}</span>
                  <span className="block text-[10.5px] opacity-55">
                    {count ? `${count} ${t('tm.windows').toLowerCase()}` : t('tm.notRunning')}
                  </span>
                </span>
                <span className="text-[10.5px] tabular-nums opacity-50">{formatNumber((BASE_MEMORY[app.id] ?? 40), { locale: bcp47 })} MB</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed opacity-55">{t('tm.memoryNote')}</p>
        </div>
      ) : null}

      <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px]">
        <span className="flex items-center gap-1.5">
          <Gauge size={12} /> {processes.length} {t('tm.processes').toLowerCase()}
        </span>
        <span>{windows.length} {t('tm.windows').toLowerCase()}</span>
        <span className="ms-auto opacity-60">{t('tm.simulatedNote')}</span>
      </footer>
    </div>
  );
}

function MetricCard({ icon, label, value, chart, color }: { icon: React.ReactNode; label: string; value: string; chart: ChartPoint[]; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <p className="flex items-center gap-2 text-[11.5px] font-medium opacity-70">
        {icon} {label}
      </p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums">{value}</p>
      <div className="mt-2">
        <LineChart data={chart} height={70} color={color} />
      </div>
    </div>
  );
}

export default TaskManagerApp;
