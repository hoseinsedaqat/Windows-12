import { useMemo, useState } from 'react';
import { ChevronRight, Lock, LogOut, Power, RotateCcw, Search, Folder, FileText, Settings2, Globe, ArrowLeft, Pin } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useSystemStore, AVATARS } from '../../stores/systemStore';
import { useWindowStore } from '../../stores/windowStore';
import { listedApps, getApp } from '../../core/ApplicationRegistry';
import { AppIcon, KindIcon } from '../icons/AppIcons';
import { useT, translate } from '../../i18n';
import { useSearchResults } from '../../hooks/useSearch';
import { launchApp, openNode } from '../../services/launcher';
import { useClickOutside } from '../../hooks/useUi';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { DOCUMENTS_ID, ROOT_ID, recentlyUpdated } from '../../core/FileSystem';
import { relativeTime } from '../../services/format';
import { playSound } from '../../services/sound';

const PINNED = ['chrome', 'explorer', 'word', 'excel', 'powerpoint', 'accounting', 'notepad', 'notes', 'calculator', 'photos', 'terminal', 'settings'];

export function StartMenu() {
  const { t, lang, isRTL } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const account = useSystemStore((state) => state.account);
  const lock = useSystemStore((state) => state.lock);
  const signOut = useSystemStore((state) => state.signOut);
  const restart = useSystemStore((state) => state.restart);
  const shutdown = useSystemStore((state) => state.shutdown);
  const pinnedApps = useWindowStore((state) => state.pinnedApps);
  const togglePin = useWindowStore((state) => state.togglePin);
  const nodes = useFileSystemStore((state) => state.nodes);

  const [query, setQuery] = useState('');
  const [showAllApps, setShowAllApps] = useState(false);
  const [powerOpen, setPowerOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const results = useSearchResults(query);

  const open = panel === 'start';
  const ref = useClickOutside<HTMLDivElement>(() => open && setPanel(null), open);

  const pinned = useMemo(() => {
    const ordered = PINNED.map((id) => getApp(id)).filter(Boolean);
    const extra = pinnedApps.map((id) => getApp(id)).filter((app) => app && !PINNED.includes(app.id));
    return [...ordered, ...extra].slice(0, 18);
  }, [pinnedApps]);

  const allApps = useMemo(() => {
    const apps = [...listedApps()].sort((a, b) => a.name.localeCompare(b.name));
    const groups = new Map<string, typeof apps>();
    apps.forEach((app) => {
      const letter = app.name[0].toUpperCase();
      groups.set(letter, [...(groups.get(letter) ?? []), app]);
    });
    return [...groups.entries()];
  }, []);

  const recommended = useMemo(() => recentlyUpdated(nodes, 6), [nodes]);

  if (!open) return null;

  const close = () => setPanel(null);
  const run = (appId: string) => {
    playSound('open');
    close();
    launchApp(appId);
  };

  const initials = account.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const searching = query.trim().length > 0;

  return (
    <div
      ref={ref}
      className="panel animate-slide-up fixed z-[7000] flex flex-col overflow-hidden"
      style={{
        bottom: TASKBAR_HEIGHT + 10,
        left: isRTL ? undefined : '50%',
        right: isRTL ? '50%' : undefined,
        transform: 'translateX(50%)',
        width: 'min(660px, calc(100vw - 24px))',
        height: 'min(700px, calc(100vh - 90px))',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={t('taskbar.start')}
    >
      {/* Search */}
      <div className="shrink-0 p-4 pb-2">
        <label className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-solid)] px-3.5 py-2 focus-within:border-[var(--accent)]">
          <Search size={15} className="opacity-55" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('start.searchPlaceholder')}
            className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-55"
            autoFocus
            aria-label={t('start.searchPlaceholder')}
          />
          {query ? (
            <button type="button" className="opacity-50 hover:opacity-100" onClick={() => setQuery('')} aria-label={t('common.close')}>
              ✕
            </button>
          ) : null}
        </label>
      </div>

      {/* Body */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {searching ? (
          <div className="space-y-4 py-1">
            {results.apps.length ? (
              <ResultGroup title={t('start.apps')}>
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
                  {results.apps.map((app) => (
                    <AppTile key={app.id} appId={app.id} label={app.name} onClick={() => run(app.id)} compact />
                  ))}
                </div>
              </ResultGroup>
            ) : null}

            {results.files.length ? (
              <ResultGroup title={t('start.files')}>
                <div className="space-y-0.5">
                  {results.files.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className="list-row w-full"
                      onClick={() => {
                        close();
                        openNode(node);
                      }}
                    >
                      <KindIcon kind={node.kind} size={18} />
                      <span className="truncate">{node.name}</span>
                      <span className="ms-auto shrink-0 text-[11px] opacity-55">{relativeTime(node.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              </ResultGroup>
            ) : null}

            {results.settings.length ? (
              <ResultGroup title={t('start.settingsResults')}>
                <div className="space-y-0.5">
                  {results.settings.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className="list-row w-full"
                      onClick={() => {
                        close();
                        launchApp('settings', { section: section.id });
                      }}
                    >
                      <Settings2 size={16} className="opacity-70" />
                      <span className="truncate">{translate(lang, section.labelKey)}</span>
                      {section.simulated ? <span className="ms-auto text-[10px] opacity-50">{t('common.simulated')}</span> : null}
                    </button>
                  ))}
                </div>
              </ResultGroup>
            ) : null}

            <ResultGroup title={t('start.web')}>
              <button
                type="button"
                className="list-row w-full"
                onClick={() => {
                  close();
                  launchApp('chrome', { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
                }}
              >
                <Globe size={16} className="opacity-70" />
                <span className="truncate">{query}</span>
              </button>
            </ResultGroup>

            {!results.apps.length && !results.files.length && !results.settings.length ? (
              <p className="py-6 text-center text-xs opacity-60">{t('start.noResults')}</p>
            ) : null}
          </div>
        ) : showAllApps ? (
          <div className="py-1">
            <div className="mb-2 flex items-center gap-2">
              <button type="button" className="win-button gap-1 text-xs" onClick={() => setShowAllApps(false)}>
                <ArrowLeft size={13} /> {t('start.back')}
              </button>
              <p className="text-sm font-semibold">{t('start.allApps')}</p>
            </div>
            <div className="space-y-3">
              {allApps.map(([letter, apps]) => (
                <div key={letter}>
                  <p className="mb-1 text-[11px] font-bold uppercase text-[var(--accent)]">{letter}</p>
                  <div className="space-y-0.5">
                    {apps.map((app) => (
                      <button key={app.id} type="button" className="list-row w-full" onClick={() => run(app.id)}>
                        <AppIcon appId={app.id} size={20} />
                        <span className="truncate">{app.name}</span>
                        {pinnedApps.includes(app.id) ? <Pin size={12} className="ms-auto opacity-45" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <ResultGroup
              title={t('start.pinned')}
              action={
                <button type="button" className="win-button gap-1 px-2 py-1 text-[11px]" onClick={() => setShowAllApps(true)}>
                  {t('start.allApps')} <ChevronRight size={12} />
                </button>
              }
            >
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
                {pinned.map((app) => app && <AppTile key={app.id} appId={app.id} label={app.name} onClick={() => run(app.id)} onContextMenu={() => togglePin(app.id)} />)}
              </div>
            </ResultGroup>

            <ResultGroup title={t('start.recommended')}>
              {recommended.length ? (
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {recommended.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className="list-row w-full"
                      onClick={() => {
                        close();
                        openNode(node);
                      }}
                    >
                      <KindIcon kind={node.kind} size={20} />
                      <span className="min-w-0 flex-1 text-start">
                        <span className="block truncate text-[12.5px]">{node.name}</span>
                        <span className="block text-[10.5px] opacity-55">{relativeTime(node.updatedAt)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs opacity-55">{t('start.recentFiles')}</p>
              )}
            </ResultGroup>

            <ResultGroup title={t('start.documents')}>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                <QuickFolder icon={<Folder size={16} />} label={t('explorer.documents')} onClick={() => { close(); launchApp('explorer', { path: DOCUMENTS_ID }); }} />
                <QuickFolder icon={<Folder size={16} />} label={t('explorer.thisPc')} onClick={() => { close(); launchApp('explorer', { path: ROOT_ID }); }} />
                <QuickFolder icon={<Folder size={16} />} label={t('explorer.downloads')} onClick={() => { close(); launchApp('explorer', { path: 'downloads' }); }} />
                <QuickFolder icon={<Folder size={16} />} label={t('explorer.recycleBin')} onClick={() => { close(); launchApp('recyclebin'); }} />
              </div>
            </ResultGroup>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-[var(--hover)]"
            onClick={() => {
              setUserOpen((value) => !value);
              setPowerOpen(false);
            }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              style={{ background: account.avatarColor || AVATARS[0].color }}
            >
              {initials || '🙂'}
            </span>
            <span className="max-w-[120px] truncate text-[13px]">{account.displayName}</span>
          </button>
          {userOpen ? (
            <div className="panel absolute bottom-full left-0 mb-2 w-52 overflow-hidden p-1" onPointerDown={(event) => event.stopPropagation()}>
              <MenuItem icon={<Lock size={14} />} label={t('start.lock')} onClick={() => { close(); lock(); }} />
              <MenuItem icon={<LogOut size={14} />} label={t('start.signOut')} onClick={() => { close(); signOut(); }} />
              <MenuItem icon={<Settings2 size={14} />} label={t('start.account')} onClick={() => { close(); launchApp('settings', { section: 'profile' }); }} />
              <MenuItem icon={<FileText size={14} />} label={t('explorer.recycleBin')} onClick={() => { close(); launchApp('recyclebin'); }} />
              <div className="my-1 h-px bg-[var(--border)]" />
              <p className="px-2 py-1 text-[10.5px] leading-snug opacity-55">{t('quick.simulatedNote')}</p>
              <div className="my-1 h-px bg-[var(--border)]" />
              <div className="flex flex-wrap gap-1 px-1 pb-1">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    className="h-6 w-6 rounded-full ring-2 ring-transparent transition hover:ring-white/60"
                    style={{ background: avatar.color }}
                    onClick={() => void useSystemStore.getState().updateAccount({ avatar: avatar.id, avatarColor: avatar.color })}
                    aria-label={avatar.id}
                  />
                ))}
              </div>
              <p className="px-2 pb-1 text-[10px] opacity-45">{t('settings.profile')}</p>
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            className="icon-button h-9 w-9 rounded-md hover:bg-[var(--hover)]"
            onClick={() => {
              setPowerOpen((value) => !value);
              setUserOpen(false);
            }}
            title={t('start.power')}
            aria-label={t('start.power')}
          >
            <Power size={17} />
          </button>
          {powerOpen ? (
            <div className={`panel absolute bottom-full mb-2 w-52 overflow-hidden p-1 ${isRTL ? 'left-0' : 'right-0'}`} onPointerDown={(event) => event.stopPropagation()}>
              <MenuItem icon={<Lock size={14} />} label={t('start.lock')} onClick={() => { close(); lock(); }} />
              <MenuItem icon={<RotateCcw size={14} />} label={t('start.restart')} onClick={() => { close(); restart(); }} />
              <MenuItem icon={<Power size={14} />} label={t('start.shutdown')} onClick={() => { close(); shutdown(); }} />
              <MenuItem icon={<LogOut size={14} />} label={t('start.signOut')} onClick={() => { close(); signOut(); }} />
              <div className="my-1 h-px bg-[var(--border)]" />
              <MenuItem icon={<Settings2 size={14} />} label={t('settings.title')} onClick={() => { close(); launchApp('settings'); }} />
              <MenuItem icon={<Folder size={14} />} label={t('explorer.recycleBin')} onClick={() => { close(); launchApp('recyclebin'); }} />
              <MenuItem icon={<Folder size={14} />} label={t('explorer.thisPc')} onClick={() => { close(); launchApp('explorer', { path: ROOT_ID }); }} />
              <div className="my-1 h-px bg-[var(--border)]" />
              <p className="px-2 py-1 text-[10px] opacity-45">{t('boot.disclaimer')}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function AppTile({
  appId,
  label,
  onClick,
  onContextMenu,
  compact,
}: {
  appId: string;
  label: string;
  onClick: () => void;
  onContextMenu?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu?.();
      }}
      className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition hover:bg-[var(--hover)] ${compact ? 'flex-row gap-2' : ''}`}
      title={label}
    >
      <AppIcon appId={appId} size={compact ? 20 : 34} />
      <span className={`truncate text-[11.5px] ${compact ? 'text-start' : 'text-center'}`}>{label}</span>
    </button>
  );
}

function QuickFolder({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="list-row w-full text-[12px]" onClick={onClick}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className="list-row w-full gap-2" onClick={onClick}>
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

export default StartMenu;
