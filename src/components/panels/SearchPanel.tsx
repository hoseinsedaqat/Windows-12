import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Search, Globe, Settings2, Folder, CornerDownLeft } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useT } from '../../i18n';
import { useSearchResults } from '../../hooks/useSearch';
import { AppIcon, KindIcon } from '../icons/AppIcons';
import { launchApp, openNode } from '../../services/launcher';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { relativeTime } from '../../services/format';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { resolvePath } from '../../core/FileSystem';

/** Keyboard controller shared between the taskbar pill and the flyout. */
const searchKeys = {
  move: (_delta: number): void => undefined,
  enter: (): void => undefined,
};

/**
 * Inline taskbar search. The taskbar pill IS the input on sm+ screens and the
 * results appear in a compact flyout above it — never a full-height window.
 * With an empty query (pill source) nothing is shown at all.
 */
export function SearchPill() {
  const { t } = useT();
  const query = useShellStore((state) => state.searchQuery);
  const open = useShellStore((state) => state.searchOpen);
  const source = useShellStore((state) => state.searchSource);
  const setSearchQuery = useShellStore((state) => state.setSearchQuery);
  const openSearch = useShellStore((state) => state.openSearch);
  const closeSearch = useShellStore((state) => state.closeSearch);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+S (see useShortcuts) focuses the flyout input instead; keep pill in sync.
  useEffect(() => {
    if (open && source === 'pill') inputRef.current?.focus();
  }, [open, source]);

  return (
    <div
      data-search-root
      className={`mx-0.5 hidden h-9 min-w-0 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 transition-colors hover:bg-[var(--hover)] sm:flex ${
        open && source === 'pill' ? 'ring-1 ring-[var(--accent)]' : ''
      }`}
      style={{ width: 210 }}
    >
      <Search size={14} className="shrink-0 opacity-70" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={() => openSearch('pill')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSearch();
            inputRef.current?.blur();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            searchKeys.move(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            searchKeys.move(-1);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            searchKeys.enter();
          }
        }}
        placeholder={t('taskbar.search')}
        className="w-full min-w-0 bg-transparent text-[12px] outline-none placeholder:opacity-55"
        aria-label={t('taskbar.search')}
        role="searchbox"
      />
      <span
        className="ml-auto h-5 w-5 shrink-0 rounded-full ring-1 ring-white/30"
        style={{ background: 'conic-gradient(from 210deg, #60a5fa, #a78bfa, #f472b6, #60a5fa)' }}
        aria-hidden
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-1 text-[10.5px] font-semibold uppercase tracking-wide opacity-50">{title}</p>
      {children}
    </div>
  );
}

/** Compact results flyout anchored above the taskbar. */
export function SearchFlyout() {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const query = useShellStore((state) => state.searchQuery);
  const open = useShellStore((state) => state.searchOpen);
  const source = useShellStore((state) => state.searchSource);
  const setSearchQuery = useShellStore((state) => state.setSearchQuery);
  const closeSearch = useShellStore((state) => state.closeSearch);
  const ref = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const activeIndexRef = useRef(0);
  const [, bump] = useReducer((value: number) => value + 1, 0);
  const results = useSearchResults(query, { apps: 5, files: 6, settings: 4 });

  const flat = useMemo(
    () => [
      ...results.apps.map((app) => ({ kind: 'app' as const, id: app.id, run: () => launchApp(app.id) })),
      ...results.files.map((node) => ({ kind: 'file' as const, id: node.id, run: () => openNode(node) })),
      ...results.settings.map((section) => ({
        kind: 'setting' as const,
        id: section.id,
        run: () => launchApp('settings', { section: section.id }),
      })),
    ],
    [results.apps, results.files, results.settings],
  );

  const showRecents = source === 'button' && !query.trim();
  const visible = open && (showRecents || Boolean(query.trim()));

  useEffect(() => {
    if (open && source === 'button') {
      const timer = window.setTimeout(() => mobileInputRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, source]);

  // Click anywhere outside the pill + flyout dismisses the search experience.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-search-root]')) closeSearch();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, closeSearch]);

  useEffect(() => {
    activeIndexRef.current = 0;
  }, [query]);

  useEffect(() => {
    if (!visible) return undefined;
    searchKeys.move = (delta) => {
      moveActive(delta);
      bump();
    };
    searchKeys.enter = () => runActive();
    return undefined;
  });

  if (!visible) return null;

  const hitClass = (index: number) => (index === activeIndexRef.current ? 'bg-[var(--accent-soft)]' : '');
  const appOffset = 0;
  const fileOffset = results.apps.length;
  const settingOffset = results.apps.length + results.files.length;

  const runActive = () => {
    const hit = flat[activeIndexRef.current];
    if (hit) {
      hit.run();
      closeSearch();
    } else if (query.trim()) {
      launchApp('chrome', { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
      closeSearch();
    }
  };
  const moveActive = (delta: number) => {
    activeIndexRef.current = Math.min(Math.max(0, activeIndexRef.current + delta), Math.max(0, flat.length - 1));
    // highlight is derived from activeIndexRef at render time (see data-search-hit rows)
  };

  const keyProps = {
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        runActive();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
      }
    },
  };

  return (
    <div
      ref={ref}
      data-search-root
      className="panel animate-slide-up fixed z-[7000] flex flex-col overflow-hidden"
      style={{
        bottom: TASKBAR_HEIGHT + 8,
        left: 0,
        right: 0,
        marginInline: 'auto',
        width: 'min(600px, calc(100vw - 16px))',
        maxHeight: 'min(420px, calc(100vh - 96px))',
      }}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-label={t('common.search')}
    >
      {source === 'button' ? (
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-2.5">
          <Search size={15} className="opacity-55" />
          <input
            ref={mobileInputRef}
            value={query}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('start.searchPlaceholder')}
            className="w-full bg-transparent text-sm outline-none placeholder:opacity-55"
            aria-label={t('common.search')}
            {...keyProps}
          />
        </div>
      ) : null}

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
        {showRecents ? (
          <Group title={t('start.recentFiles')}>
            {results.recent.length ? (
              results.recent.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="list-row w-full"
                  onClick={() => {
                    closeSearch();
                    openNode(node);
                  }}
                >
                  <KindIcon kind={node.kind} size={18} />
                  <span className="min-w-0 flex-1 text-start">
                    <span className="block truncate text-[12.5px]">{node.name}</span>
                    <span className="block truncate text-[10.5px] opacity-55">{resolvePath(nodes, node.parentId)}</span>
                  </span>
                  <span className="shrink-0 text-[10.5px] opacity-50">{relativeTime(node.updatedAt)}</span>
                </button>
              ))
            ) : (
              <p className="px-1 py-2 text-xs opacity-50">{t('start.noResults')}</p>
            )}
          </Group>
        ) : results.apps.length || results.files.length || results.settings.length ? (
          <div className="space-y-3">
            {results.apps.length ? (
              <Group title={t('start.apps')}>
                {results.apps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    data-search-hit
                    className={`list-row w-full ${hitClass(appOffset + results.apps.indexOf(app))}`}
                    onClick={() => {
                      closeSearch();
                      launchApp(app.id);
                    }}
                  >
                    <AppIcon appId={app.id} size={20} />
                    <span className="truncate">{app.name}</span>
                  </button>
                ))}
              </Group>
            ) : null}
            {results.files.length ? (
              <Group title={t('start.files')}>
                {results.files.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    data-search-hit
                    className={`list-row w-full ${hitClass(fileOffset + results.files.indexOf(node))}`}
                    onClick={() => {
                      closeSearch();
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
              </Group>
            ) : null}
            {results.settings.length ? (
              <Group title={t('start.settingsResults')}>
                {results.settings.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    data-search-hit
                    className={`list-row w-full ${hitClass(settingOffset + results.settings.indexOf(section))}`}
                    onClick={() => {
                      closeSearch();
                      launchApp('settings', { section: section.id });
                    }}
                  >
                    <Settings2 size={16} className="opacity-70" />
                    <span className="truncate">{t(section.labelKey)}</span>
                  </button>
                ))}
              </Group>
            ) : null}
          </div>
        ) : (
          <p className="px-1 py-2 text-xs opacity-50">{t('start.noResults')}</p>
        )}

        {query.trim() ? (
          <button
            type="button"
            className="list-row mt-2 w-full border-t border-[var(--border)] pt-2"
            onClick={() => {
              closeSearch();
              launchApp('chrome', { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
            }}
          >
            <Globe size={16} className="opacity-70" />
            <span className="min-w-0 flex-1 truncate text-start text-[12.5px]">{t('search.web', { query: query.trim() })}</span>
            <CornerDownLeft size={13} className="opacity-50" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
