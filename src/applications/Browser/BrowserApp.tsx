import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Star,
  MoreVertical,
  Plus,
  X,
  Lock,
  Globe2,
  History as HistoryIcon,
  Download as DownloadIcon,
  Bookmark,
  Settings as SettingsIcon,
  ExternalLink,
  Info,
  Printer,
  ShieldAlert,
  Trash2,
  Search,
  AlertTriangle,
} from 'lucide-react';
import type { AppWindowProps } from '../registry';
import { useT } from '../../i18n';
import {
  useBrowserStore,
  selectActiveTab,
  normaliseInput,
  canEmbed,
  labelFor,
  SEARCH_ENGINES,
  EMBEDDABLE_SUGGESTIONS,
  NEW_TAB,
} from '../../stores/browserStore';
import { useShellStore } from '../../stores/shellStore';
import { useWindowStore } from '../../stores/windowStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { DOWNLOADS_ID } from '../../core/FileSystem';
import { formatDate, formatTime, formatBytes } from '../../services/format';
import { downloadText } from '../../services/files';
import { ToggleRow, Field, Select, Badge, EmptyState } from '../../components/ui/Controls';
import { notify } from '../../stores/notificationStore';

export function BrowserApp({ props, windowId }: AppWindowProps) {
  const { t } = useT();
  const store = useBrowserStore();
  const openDialog = useShellStore((state) => state.openDialog);
  const createFile = useFileSystemStore((state) => state.createFile);

  const tab = selectActiveTab(store);
  const [address, setAddress] = useState(tab?.url ?? NEW_TAB);
  const [addressFocused, setAddressFocused] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [forced, setForced] = useState<Record<string, boolean>>({});
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const bootstrapped = useRef(false);

  /* First mount: make sure there is a tab, and honour `props.url`. */
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    store.hydrateIfNeeded();
    const requested = props.url as string | undefined;
    if (requested) {
      const state = useBrowserStore.getState();
      const target = selectActiveTab(state);
      if (target) state.navigate(target.id, normaliseInput(requested, state.settings.searchEngine));
      else state.newTab(normaliseInput(requested, state.settings.searchEngine));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!addressFocused) setAddress(tab?.url ?? NEW_TAB);
  }, [tab?.url, tab?.historyIndex, addressFocused]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const navigate = useCallback(
    (raw: string) => {
      if (!tab) return;
      const url = normaliseInput(raw, store.settings.searchEngine);
      useBrowserStore.getState().navigate(tab.id, url);
      if (url.startsWith('http')) {
        window.setTimeout(() => useBrowserStore.getState().updateTab(tab.id, { loading: false }), 1400);
      }
      setAddressFocused(false);
      setSuggestionsOpen(false);
    },
    [store.settings.searchEngine, tab],
  );

  const suggestions = useMemo(() => {
    const needle = address.trim().toLowerCase();
    if (!needle) return [];
    const marks = store.bookmarks.filter((bookmark) => bookmark.title.toLowerCase().includes(needle) || bookmark.url.includes(needle)).slice(0, 4);
    const past = store.history.filter((entry) => entry.url.includes(needle) || entry.title.toLowerCase().includes(needle)).slice(0, 4);
    const internals = ['win://history', 'win://downloads', 'win://bookmarks', 'win://settings', 'win://about'].filter((page) => page.includes(needle));
    return [
      ...marks.map((item) => ({ kind: 'bookmark' as const, title: item.title, url: item.url })),
      ...past.map((item) => ({ kind: 'history' as const, title: item.title, url: item.url })),
      ...internals.map((page) => ({ kind: 'internal' as const, title: labelFor(page), url: page })),
    ].slice(0, 8);
  }, [address, store.bookmarks, store.history]);

  const isBookmarked = Boolean(tab && store.bookmarks.some((bookmark) => bookmark.url === tab.url));

  const toggleBookmark = () => {
    if (!tab) return;
    if (isBookmarked) {
      const existing = store.bookmarks.find((bookmark) => bookmark.url === tab.url);
      if (existing) store.removeBookmark(existing.id);
      return;
    }
    store.addBookmark({ title: tab.title || tab.url, url: tab.url });
    notify(t('browser.bookmarkAdded'), tab.title, 'success', 'chrome');
  };

  const openRealTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    notify(t('browser.openedRealTab'), url, 'info', 'chrome');
  };

  const downloadSample = () => {
    const name = `concept-page-${new Date().toISOString().slice(0, 10)}.txt`;
    const body = [
      'Windows 12 Concept — simulated browser download',
      `Tab URL: ${tab?.url ?? NEW_TAB}`,
      `Saved: ${new Date().toString()}`,
      '',
      'This file was generated locally and also stored in the virtual Downloads folder.',
    ].join('\n');
    downloadText(body, name);
    createFile('text', DOWNLOADS_ID, name, body);
    store.addDownload({ name, url: tab?.url ?? NEW_TAB, size: body.length, status: 'done', note: 'Generated locally' });
  };

  const printPage = () => window.print();

  const dragIndex = useRef<number | null>(null);

  if (!tab) return <div className="p-6 text-[12px] opacity-60">{t('browser.noTabs')}</div>;

  const external = tab.url.startsWith('http');
  const embeddable = canEmbed(tab.url) || forced[tab.id];
  const page = tab.url.replace('win://', '');

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      {/* Tab strip */}
      <div className="flex items-end gap-1 border-b border-[var(--border)] bg-[var(--surface-2)] px-2 pt-1.5">
        <div className="scroll-thin flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
          {store.tabs.map((item, index) => (
            <div
              key={item.id}
              className={`group flex h-8 min-w-0 max-w-52 shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-2.5 text-[12px] transition ${
                item.id === tab.id ? 'border-[var(--border)] bg-[var(--surface-solid)]' : 'border-transparent bg-[var(--hover)] opacity-75 hover:opacity-100'
              }`}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null && dragIndex.current !== index) store.reorderTabs(dragIndex.current, index);
                dragIndex.current = null;
              }}
              onClick={() => store.activateTab(item.id)}
              onAuxClick={(event) => {
                if (event.button === 1) store.closeTab(item.id);
              }}
              onDoubleClick={() => store.updateTab(item.id, { pinned: !item.pinned })}
              title={`${item.title} — ${item.url}\n${t('browser.tabHint')}`}
            >
              {item.loading ? (
                <RotateCw size={12} className="shrink-0 animate-spin text-[var(--accent)]" />
              ) : item.url.startsWith('http') ? (
                <Globe2 size={12} className="shrink-0 opacity-55" />
              ) : (
                <Lock size={12} className="shrink-0 text-[var(--accent)]" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.pinned ? '📌 ' : ''}{item.title}</span>
              <button
                type="button"
                className="icon-button h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100"
                aria-label={`${t('common.close')} ${item.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (store.tabs.length === 1) {
                    const finish = () => useWindowStore.getState().closeWindow(windowId);
                    if (store.settings.confirmOnClose) {
                      openDialog({
                        kind: 'confirm',
                        title: t('browser.closeTitle'),
                        message: t('browser.closeMessage'),
                        confirmLabel: t('common.close'),
                        onConfirm: finish,
                      });
                    } else finish();
                    return;
                  }
                  store.closeTab(item.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="icon-button mb-0.5 h-7 w-7 shrink-0" title={t('browser.newTab')} onClick={() => store.newTab()}>
          <Plus size={15} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
        <NavButton icon={<ArrowLeft size={16} />} label={t('common.back')} disabled={tab.historyIndex <= 0} onClick={() => store.goBack(tab.id)} />
        <NavButton icon={<ArrowRight size={16} />} label={t('common.forward')} disabled={tab.historyIndex >= tab.history.length - 1} onClick={() => store.goForward(tab.id)} />
        <NavButton
          icon={<RotateCw size={15} className={tab.loading ? 'animate-spin' : ''} />}
          label={t('browser.reload')}
          onClick={() => {
            store.reload(tab.id);
            if (external) {
              const frame = frameRef.current;
              if (frame) frame.src = tab.url;
              window.setTimeout(() => useBrowserStore.getState().updateTab(tab.id, { loading: false }), 1200);
            }
          }}
        />
        <NavButton icon={<Home size={15} />} label={t('browser.home')} onClick={() => navigate(store.settings.homepage || NEW_TAB)} />

        <div className="relative mx-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-solid)] px-3 py-1.5 focus-within:border-[var(--accent)]">
            {external ? (
              embeddable ? (
                <Globe2 size={13} className="shrink-0 opacity-55" />
              ) : (
                <ShieldAlert size={13} className="shrink-0 text-amber-500" />
              )
            ) : (
              <Lock size={13} className="shrink-0 text-[var(--accent)]" />
            )}
            <input
              className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] outline-none"
              value={address}
              dir="ltr"
              spellCheck={false}
              aria-label={t('browser.addressBar')}
              onFocus={(event) => {
                setAddressFocused(true);
                event.currentTarget.select();
                setSuggestionsOpen(true);
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  setAddressFocused(false);
                  setSuggestionsOpen(false);
                }, 140);
              }}
              onChange={(event) => {
                setAddress(event.target.value);
                setSuggestionsOpen(true);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') navigate(address);
                if (event.key === 'Escape') {
                  setAddress(tab.url);
                  setSuggestionsOpen(false);
                  event.currentTarget.blur();
                }
                if (event.key === 'ArrowDown' && suggestions.length) navigate(suggestions[0].url);
              }}
            />
            {tab.loading ? <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" /> : null}
          </div>

          {suggestionsOpen && suggestions.length ? (
            <div className="panel absolute inset-x-0 top-full z-40 mt-1 p-1">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.kind}-${suggestion.url}`}
                  type="button"
                  className="list-row w-full gap-2 text-[12px]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => navigate(suggestion.url)}
                >
                  {suggestion.kind === 'bookmark' ? <Star size={12} className="opacity-60" /> : suggestion.kind === 'history' ? <HistoryIcon size={12} className="opacity-60" /> : <Lock size={12} className="text-[var(--accent)]" />}
                  <span className="min-w-0 flex-1 truncate text-start">{suggestion.title}</span>
                  <span className="shrink-0 truncate text-[10.5px] opacity-45" dir="ltr">
                    {suggestion.url}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <NavButton icon={<Star size={15} className={isBookmarked ? 'fill-amber-400 text-amber-400' : ''} />} label={t('browser.bookmarkPage')} onClick={toggleBookmark} />

        <div className="relative" ref={menuRef}>
          <NavButton icon={<MoreVertical size={16} />} label={t('browser.menu')} active={menuOpen} onClick={() => setMenuOpen((value) => !value)} />
          {menuOpen ? (
            <div className="panel absolute end-0 top-full z-40 mt-1 w-60 p-1">
              <MenuItem icon={<Plus size={14} />} label={t('browser.newTab')} onClick={() => { store.newTab(); setMenuOpen(false); }} />
              <MenuItem icon={<Bookmark size={14} />} label={t('browser.bookmarks')} onClick={() => { navigate('win://bookmarks'); setMenuOpen(false); }} />
              <MenuItem icon={<HistoryIcon size={14} />} label={t('browser.history')} onClick={() => { navigate('win://history'); setMenuOpen(false); }} />
              <MenuItem icon={<DownloadIcon size={14} />} label={t('browser.downloads')} onClick={() => { navigate('win://downloads'); setMenuOpen(false); }} />
              <MenuItem icon={<Printer size={14} />} label={t('browser.print')} onClick={() => { printPage(); setMenuOpen(false); }} />
              <MenuItem icon={<ExternalLink size={14} />} label={t('browser.openReal')} disabled={!external} onClick={() => { openRealTab(tab.url); setMenuOpen(false); }} />
              <MenuItem icon={<DownloadIcon size={14} />} label={t('browser.downloadSample')} onClick={() => { downloadSample(); setMenuOpen(false); }} />
              <div className="my-1 h-px bg-[var(--border)]" />
              <MenuItem icon={<SettingsIcon size={14} />} label={t('browser.settings')} onClick={() => { navigate('win://settings'); setMenuOpen(false); }} />
              <MenuItem icon={<Info size={14} />} label={t('browser.aboutPage')} onClick={() => { navigate('win://about'); setMenuOpen(false); }} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Bookmarks bar */}
      {store.settings.showBookmarksBar ? (
        <div className="scroll-thin flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
          {store.bookmarks.map((bookmark) => (
            <button key={bookmark.id} type="button" className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-[11.5px] transition hover:bg-[var(--hover)]" onClick={() => navigate(bookmark.url)}>
              <Star size={11} className="opacity-55" />
              <span className="max-w-32 truncate">{bookmark.title}</span>
            </button>
          ))}
          {!store.bookmarks.length ? <span className="px-2 text-[11px] opacity-45">{t('browser.noBookmarks')}</span> : null}
        </div>
      ) : null}

      {/* Page */}
      <div className="relative min-h-0 flex-1 bg-[var(--surface-solid)]">
        {external ? (
          embeddable ? (
            <iframe
              key={`${tab.id}-${tab.url}`}
              ref={frameRef}
              src={tab.url}
              title={tab.title}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={() => useBrowserStore.getState().updateTab(tab.id, { loading: false })}
              onError={() => useBrowserStore.getState().updateTab(tab.id, { loading: false, error: 'frame' })}
            />
          ) : (
            <BlockedPage url={tab.url} onTry={() => setForced((current) => ({ ...current, [tab.id]: true }))} onOpen={() => openRealTab(tab.url)} t={t} />
          )
        ) : page === 'history' ? (
          <HistoryPage />
        ) : page === 'downloads' ? (
          <DownloadsPage />
        ) : page === 'bookmarks' ? (
          <BookmarksPage onNavigate={navigate} />
        ) : page === 'settings' ? (
          <BrowserSettingsPage />
        ) : page === 'about' ? (
          <AboutPage />
        ) : (
          <NewTabPage onNavigate={navigate} onDownload={downloadSample} />
        )}
      </div>

      {/* Status bar */}
      <footer className="flex shrink-0 items-center gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[10.5px] opacity-65">
        <span className="flex items-center gap-1">
          {external ? <Globe2 size={11} /> : <Lock size={11} />}
          {external ? (embeddable ? t('browser.embedded') : t('browser.notEmbedded')) : t('browser.internalPage')}
        </span>
        <span className="truncate" dir="ltr">
          {tab.url}
        </span>
        <span className="ms-auto flex items-center gap-2">
          {store.tabs.length} {t('browser.tabs')} · {store.history.length} {t('browser.historyEntries')}
        </span>
      </footer>
    </div>
  );
}

function NavButton({ icon, label, onClick, disabled, active }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" className={`icon-button h-8 w-8 shrink-0 ${active ? 'text-[var(--accent)]' : ''}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {icon}
    </button>
  );
}

function MenuItem({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="list-row w-full gap-2 text-[12px]" onClick={onClick} disabled={disabled}>
      <span className="opacity-70">{icon}</span>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Internal pages                                                      */
/* ------------------------------------------------------------------ */

function InternalShell({ title, icon, children, actions }: { title: string; icon?: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl p-5">
        <header className="mb-4 flex items-center gap-2">
          {icon ? <span className="text-[var(--accent)]">{icon}</span> : null}
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <div className="ms-auto flex items-center gap-2">{actions}</div>
        </header>
        {children}
      </div>
    </div>
  );
}

function NewTabPage({ onNavigate, onDownload }: { onNavigate: (url: string) => void; onDownload: () => void }) {
  const { t } = useT();
  const store = useBrowserStore();
  const [query, setQuery] = useState('');
  return (
    <InternalShell title={t('browser.newTab')} icon={<Globe2 size={20} />}>
      <div className="mb-6 flex flex-col items-center gap-3 pt-4">
        <p className="text-[22px] font-semibold tracking-tight">{t('browser.searchOrType')}</p>
        <div className="flex w-full max-w-xl items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-2.5 focus-within:border-[var(--accent)]">
          <Search size={15} className="opacity-55" />
          <input
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none"
            placeholder={t('browser.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter' && query.trim()) onNavigate(query);
            }}
          />
        </div>
        <p className="max-w-xl text-center text-[11px] leading-relaxed opacity-55">{t('browser.embedNotice')}</p>
      </div>

      <section className="mb-5">
        <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide opacity-55">{t('browser.shortcuts')}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {[...store.bookmarks.slice(0, 6), ...EMBEDDABLE_SUGGESTIONS.slice(0, 2).map((url) => ({ id: url, title: labelFor(url), url }))].map((item) => (
            <button key={item.id} type="button" className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 transition hover:border-[var(--accent)]" onClick={() => onNavigate(item.url)}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <Globe2 size={16} />
              </span>
              <span className="w-full truncate text-center text-[11px]">{item.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide opacity-55">{t('browser.embeddableSites')}</p>
        <div className="flex flex-wrap gap-1.5">
          {EMBEDDABLE_SUGGESTIONS.map((url) => (
            <button key={url} type="button" className="rounded-full border border-[var(--border)] px-2.5 py-1 font-mono text-[11px] transition hover:bg-[var(--hover)]" onClick={() => onNavigate(url)} dir="ltr">
              {url.replace('https://', '')}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
            <HistoryIcon size={13} /> {t('browser.recentHistory')}
          </p>
          {store.history.slice(0, 5).map((entry) => (
            <button key={entry.id} type="button" className="list-row w-full gap-2 text-[11.5px]" onClick={() => onNavigate(entry.url)}>
              <span className="min-w-0 flex-1 truncate text-start">{entry.title}</span>
              <span className="shrink-0 text-[10px] opacity-45">{formatTime(entry.visitedAt)}</span>
            </button>
          ))}
          {!store.history.length ? <p className="py-2 text-[11.5px] opacity-50">{t('browser.noHistory')}</p> : null}
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
            <DownloadIcon size={13} /> {t('browser.tryDownloads')}
          </p>
          <p className="mb-2 text-[11.5px] leading-relaxed opacity-65">{t('browser.downloadHint')}</p>
          <button type="button" className="win-button win-button-accent flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={onDownload}>
            <DownloadIcon size={13} /> {t('browser.downloadSample')}
          </button>
        </div>
      </section>
    </InternalShell>
  );
}

function BlockedPage({ url, onTry, onOpen, t }: { url: string; onTry: () => void; onOpen: () => void; t: (key: string, vars?: Record<string, string | number>) => string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 text-center">
        <ShieldAlert size={34} className="mx-auto mb-3 text-amber-500" />
        <h3 className="text-[15px] font-semibold">{t('browser.cannotEmbedTitle')}</h3>
        <p className="mt-2 text-[12px] leading-relaxed opacity-70">{t('browser.cannotEmbedBody')}</p>
        <p className="mt-2 truncate rounded bg-[var(--hover)] px-2 py-1 font-mono text-[11px]" dir="ltr">
          {url}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="win-button win-button-accent flex items-center gap-1.5" onClick={onOpen}>
            <ExternalLink size={14} /> {t('browser.openReal')}
          </button>
          <button type="button" className="win-button flex items-center gap-1.5" onClick={onTry}>
            <AlertTriangle size={14} /> {t('browser.tryAnyway')}
          </button>
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed opacity-50">{t('browser.tryAnywayNote')}</p>
      </div>
    </div>
  );
}

function HistoryPage() {
  const { t } = useT();
  const store = useBrowserStore();
  const grouped = useMemo(() => {
    const map = new Map<string, typeof store.history>();
    for (const entry of store.history) {
      const key = formatDate(entry.visitedAt);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return [...map.entries()];
  }, [store.history]);

  return (
    <InternalShell
      title={t('browser.history')}
      icon={<HistoryIcon size={20} />}
      actions={
        <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => store.clearHistory()} disabled={!store.history.length}>
          <Trash2 size={13} /> {t('browser.clearHistory')}
        </button>
      }
    >
      {!store.history.length ? <EmptyState icon={<HistoryIcon size={36} />} title={t('browser.noHistory')} message={t('browser.noHistoryHint')} /> : null}
      {grouped.map(([day, entries]) => (
        <section key={day} className="mb-4">
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide opacity-55">{day}</p>
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-1.5 text-[12px] last:border-0 hover:bg-[var(--hover)]">
                <span className="w-14 shrink-0 font-mono text-[11px] opacity-55" dir="ltr">
                  {formatTime(entry.visitedAt)}
                </span>
                <button type="button" className="min-w-0 flex-1 truncate text-start hover:underline" onClick={() => store.navigate(useBrowserStore.getState().activeTabId ?? '', entry.url)}>
                  {entry.title}
                </button>
                <span className="hidden max-w-56 truncate text-[10.5px] opacity-45 md:block" dir="ltr">
                  {entry.url}
                </span>
                <button type="button" className="icon-button h-6 w-6" onClick={() => store.removeHistoryEntry(entry.id)} aria-label={t('common.remove')}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </InternalShell>
  );
}

function DownloadsPage() {
  const { t } = useT();
  const store = useBrowserStore();
  return (
    <InternalShell title={t('browser.downloads')} icon={<DownloadIcon size={20} />}>
      {!store.downloads.length ? <EmptyState icon={<DownloadIcon size={36} />} title={t('browser.noDownloads')} message={t('browser.noDownloadsHint')} /> : null}
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        {store.downloads.map((download) => (
          <div key={download.id} className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-[12px] last:border-0">
            <DownloadIcon size={15} className="shrink-0 opacity-55" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{download.name}</span>
              <span className="block truncate text-[10.5px] opacity-55">
                {formatDate(download.at, true)} · {download.size ? formatBytes(download.size) : '—'} · {download.note ?? download.url}
              </span>
            </span>
            <Badge tone={download.status === 'done' ? 'success' : 'neutral'}>{download.status === 'done' ? t('browser.downloadDone') : t('common.simulated')}</Badge>
            <button type="button" className="icon-button h-6 w-6" onClick={() => store.removeDownload(download.id)} aria-label={t('common.remove')}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed opacity-55">{t('browser.downloadsNote')}</p>
    </InternalShell>
  );
}

function BookmarksPage({ onNavigate }: { onNavigate: (url: string) => void }) {
  const { t } = useT();
  const store = useBrowserStore();
  return (
    <InternalShell title={t('browser.bookmarks')} icon={<Bookmark size={20} />}>
      {!store.bookmarks.length ? <EmptyState icon={<Bookmark size={36} />} title={t('browser.noBookmarks')} message={t('browser.noBookmarksHint')} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {store.bookmarks.map((bookmark) => (
          <div key={bookmark.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
            <Star size={14} className="shrink-0 text-amber-400" />
            <button type="button" className="min-w-0 flex-1 text-start" onClick={() => onNavigate(bookmark.url)}>
              <span className="block truncate text-[12.5px] font-medium">{bookmark.title}</span>
              <span className="block truncate text-[10.5px] opacity-50" dir="ltr">
                {bookmark.url}
              </span>
            </button>
            <button type="button" className="icon-button h-6 w-6" onClick={() => store.removeBookmark(bookmark.id)} aria-label={t('common.remove')}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </InternalShell>
  );
}

function BrowserSettingsPage() {
  const { t } = useT();
  const store = useBrowserStore();
  return (
    <InternalShell title={t('browser.settings')} icon={<SettingsIcon size={20} />}>
      <div className="space-y-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <Field label={t('browser.homepage')}>
            <input className="win-input" dir="ltr" value={store.settings.homepage} onChange={(event) => store.setSettings({ homepage: event.target.value })} />
          </Field>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <Field label={t('browser.searchEngine')}>
            <Select
              value={store.settings.searchEngine}
              onChange={(value) => store.setSettings({ searchEngine: value })}
              options={SEARCH_ENGINES.map((engine) => ({ value: engine.template, label: engine.name }))}
            />
          </Field>
          <p className="mt-1 text-[10.5px] opacity-55">{t('browser.searchEngineNote')}</p>
        </div>
        <ToggleRow label={t('browser.showBookmarksBar')} description={t('browser.showBookmarksBarHint')} checked={store.settings.showBookmarksBar} onChange={(value) => store.setSettings({ showBookmarksBar: value })} />
        <ToggleRow label={t('browser.confirmOnClose')} description={t('browser.confirmOnCloseHint')} checked={store.settings.confirmOnClose} onChange={(value) => store.setSettings({ confirmOnClose: value })} />
        <ToggleRow label={t('browser.blockThirdParty')} description={t('browser.blockThirdPartyHint')} checked={store.settings.blockThirdPartyFrames} onChange={(value) => store.setSettings({ blockThirdPartyFrames: value })} />
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <p className="mb-2 text-[12px] font-semibold">{t('browser.privacy')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => store.clearHistory()}>
              <HistoryIcon size={13} /> {t('browser.clearHistory')}
            </button>
            <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => store.downloads.forEach((download) => store.removeDownload(download.id))}>
              <DownloadIcon size={13} /> {t('browser.clearDownloads')}
            </button>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed opacity-55">{t('browser.privacyNote')}</p>
        </div>
      </div>
    </InternalShell>
  );
}

function AboutPage() {
  const { t } = useT();
  const store = useBrowserStore();
  return (
    <InternalShell title={t('browser.aboutPage')} icon={<Info size={20} />}>
      <div className="space-y-3 text-[12.5px] leading-relaxed">
        <p>
          <strong>{t('browser.aboutTitle')}</strong> — {t('browser.aboutBody')}
        </p>
        <ul className="list-disc space-y-1 ps-5 opacity-80">
          <li>{t('browser.aboutFraming')}</li>
          <li>{t('browser.aboutSecurity')}</li>
          <li>{t('browser.aboutData')}</li>
        </ul>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t('browser.tabs')} value={String(store.tabs.length)} />
          <Stat label={t('browser.bookmarks')} value={String(store.bookmarks.length)} />
          <Stat label={t('browser.historyEntries')} value={String(store.history.length)} />
          <Stat label={t('browser.downloads')} value={String(store.downloads.length)} />
        </div>
        <p className="text-[11px] opacity-55">{t('browser.simulatedNote')}</p>
      </div>
    </InternalShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <p className="text-[11px] uppercase tracking-wide opacity-55">{label}</p>
      <p className="text-[18px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default BrowserApp;
