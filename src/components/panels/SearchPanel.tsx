import { useEffect, useRef, useState } from 'react';
import { Search, Globe, Settings2, Folder } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useT, translate } from '../../i18n';
import { useSearchResults } from '../../hooks/useSearch';
import { AppIcon, KindIcon } from '../icons/AppIcons';
import { launchApp, openNode } from '../../services/launcher';
import { useClickOutside } from '../../hooks/useUi';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { relativeTime } from '../../services/format';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { resolvePath } from '../../core/FileSystem';

/** Full search experience opened from the taskbar search button. */
export function SearchPanel() {
  const { t, lang, isRTL } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const nodes = useFileSystemStore((state) => state.nodes);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = panel === 'search';
  const ref = useClickOutside<HTMLDivElement>(() => open && setPanel(null), open);
  const results = useSearchResults(query);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
    setQuery('');
    setActiveIndex(0);
    return undefined;
  }, [open]);

  if (!open) return null;

  const flat = [
    ...results.apps.map((app) => ({ kind: 'app' as const, id: app.id, run: () => launchApp(app.id) })),
    ...results.files.map((node) => ({ kind: 'file' as const, id: node.id, run: () => openNode(node) })),
    ...results.settings.map((section) => ({
      kind: 'setting' as const,
      id: section.id,
      run: () => launchApp('settings', { section: section.id }),
    })),
  ];

  const close = () => setPanel(null);

  return (
    <div
      ref={ref}
      className="panel animate-slide-up fixed z-[7000] flex flex-col overflow-hidden"
      style={{
        bottom: TASKBAR_HEIGHT + 10,
        left: isRTL ? undefined : '50%',
        right: isRTL ? '50%' : undefined,
        transform: 'translateX(50%)',
        width: 'min(640px, calc(100vw - 24px))',
        height: 'min(560px, calc(100vh - 100px))',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={t('common.search')}
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
        <Search size={16} className="opacity-55" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => Math.min(flat.length - 1, index + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const hit = flat[activeIndex];
              if (hit) {
                hit.run();
                close();
              } else if (query.trim()) {
                launchApp('chrome', { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
                close();
              }
            } else if (event.key === 'Escape') {
              close();
            }
          }}
          placeholder={t('start.searchPlaceholder')}
          className="w-full bg-transparent text-sm outline-none placeholder:opacity-55"
          aria-label={t('common.search')}
        />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {results.isEmpty ? (
          <div className="space-y-4">
            <p className="text-[12px] font-semibold opacity-70">{t('start.recentFiles')}</p>
            {results.recent.length ? (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {results.recent.map((node) => (
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
                      <span className="block truncate text-[10.5px] opacity-55">{resolvePath(nodes, node.parentId)}</span>
                    </span>
                    <span className="shrink-0 text-[10.5px] opacity-50">{relativeTime(node.updatedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs opacity-50">{t('start.noResults')}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {results.apps.length ? (
              <Group title={t('start.apps')}>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {results.apps.map((app, index) => (
                    <button
                      key={app.id}
                      type="button"
                      className={`list-row w-full ${flat[index]?.kind === 'app' && activeIndex === index ? 'bg-[var(--accent-soft)]' : ''}`}
                      onClick={() => {
                        close();
                        launchApp(app.id);
                      }}
                    >
                      <AppIcon appId={app.id} size={22} />
                      <span className="truncate">{app.name}</span>
                    </button>
                  ))}
                </div>
              </Group>
            ) : null}

            {results.files.length ? (
              <Group title={t('start.files')}>
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
                      {node.kind === 'folder' ? <Folder size={16} className="opacity-70" /> : <KindIcon kind={node.kind} size={18} />}
                      <span className="min-w-0 flex-1 text-start">
                        <span className="block truncate text-[12.5px]">{node.name}</span>
                        <span className="block truncate text-[10.5px] opacity-55">{resolvePath(nodes, node.parentId)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Group>
            ) : null}

            {results.settings.length ? (
              <Group title={t('start.settingsResults')}>
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
              </Group>
            ) : null}

            <Group title={t('start.web')}>
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
                <span className="ms-auto text-[10.5px] opacity-50">Chrome</span>
              </button>
            </Group>
          </div>
        )}
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[12px] font-semibold opacity-70">{title}</h3>
      {children}
    </section>
  );
}

export default SearchPanel;
