import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bookmark, BrowserDownload, BrowserSettings, BrowserTab, HistoryEntry } from '../types';
import { uid } from '../services/id';

/**
 * Browser app state: tabs, per-tab history, bookmarks, downloads and settings.
 * Everything is simulated — no network request is made by this store.
 */

export const NEW_TAB = 'win://newtab';
export const HOME_URL = 'win://newtab';

export interface BrowserState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  downloads: BrowserDownload[];
  settings: BrowserSettings;

  hydrateIfNeeded: () => void;
  newTab: (url?: string) => string;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  reorderTabs: (from: number, to: number) => void;
  updateTab: (id: string, patch: Partial<BrowserTab>) => void;
  navigate: (id: string, url: string) => void;
  goBack: (id: string) => void;
  goForward: (id: string) => void;
  reload: (id: string) => void;
  addBookmark: (bookmark: Omit<Bookmark, 'id'>) => void;
  removeBookmark: (id: string) => void;
  clearHistory: () => void;
  removeHistoryEntry: (id: string) => void;
  addDownload: (download: Omit<BrowserDownload, 'id' | 'at'>) => void;
  removeDownload: (id: string) => void;
  setSettings: (patch: Partial<BrowserSettings>) => void;
}

function createTab(url: string): BrowserTab {
  return {
    id: uid('tab'),
    url,
    title: labelFor(url),
    history: [url],
    historyIndex: 0,
    loading: false,
    internal: !url.startsWith('http'),
  };
}

export function labelFor(url: string): string {
  if (url === NEW_TAB) return 'New tab';
  if (url.startsWith('win://')) return url.replace('win://', '').replace(/-/g, ' ') || 'Concept';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

/** Normalise whatever the user typed in the address bar into a URL. */
export function normaliseInput(input: string, searchEngine: string): string {
  const value = input.trim();
  if (!value) return NEW_TAB;
  if (value.startsWith('win://')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(value)) return `https://${value}`;
  if (value.includes(' ') || !value.includes('.')) return `${searchEngine}${encodeURIComponent(value)}`;
  return `https://${value}`;
}

export const SEARCH_ENGINES: { id: string; name: string; template: string }[] = [
  { id: 'duckduckgo', name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q=' },
  { id: 'google', name: 'Google', template: 'https://www.google.com/search?q=' },
  { id: 'bing', name: 'Bing', template: 'https://www.bing.com/search?q=' },
  { id: 'wikipedia', name: 'Wikipedia', template: 'https://en.wikipedia.org/w/index.php?search=' },
];

/**
 * Origins that are known to allow being framed. Anything else is shown with an
 * honest notice instead of a silently blank iframe.
 */
const EMBEDDABLE_HOSTS = [
  'example.com',
  'example.org',
  'www.wikipedia.org',
  'en.wikipedia.org',
  'simple.wikipedia.org',
  'openlibrary.org',
  'www.gutenberg.org',
  'info.cern.ch',
  'www.openstreetmap.org',
  'developer.mozilla.org',
];

export function canEmbed(url: string): boolean {
  if (!url.startsWith('http')) return true; // internal win:// pages
  try {
    const host = new URL(url).hostname.toLowerCase();
    return EMBEDDABLE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export const EMBEDDABLE_SUGGESTIONS = EMBEDDABLE_HOSTS.map((host) => `https://${host}`);

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: 'bm-1', title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Operating_system' },
  { id: 'bm-2', title: 'Open Library', url: 'https://openlibrary.org/' },
  { id: 'bm-3', title: 'Project Gutenberg', url: 'https://www.gutenberg.org/' },
  { id: 'bm-4', title: 'Example.com', url: 'https://example.com/' },
];

export const useBrowserStore = create<BrowserState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      bookmarks: DEFAULT_BOOKMARKS,
      history: [],
      downloads: [],
      settings: {
        homepage: HOME_URL,
        searchEngine: SEARCH_ENGINES[0].template,
        showBookmarksBar: true,
        blockThirdPartyFrames: true,
        confirmOnClose: false,
      },

      hydrateIfNeeded: () => {
        if (get().tabs.length) return;
        const tab = createTab(get().settings.homepage || NEW_TAB);
        set({ tabs: [tab], activeTabId: tab.id });
      },

      newTab: (url) => {
        const tab = createTab(url ?? get().settings.homepage ?? NEW_TAB);
        set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
        return tab.id;
      },

      closeTab: (id) =>
        set((state) => {
          const index = state.tabs.findIndex((tab) => tab.id === id);
          const tabs = state.tabs.filter((tab) => tab.id !== id);
          if (!tabs.length) {
            const fresh = createTab(NEW_TAB);
            return { tabs: [fresh], activeTabId: fresh.id };
          }
          const activeTabId = state.activeTabId === id ? tabs[Math.max(0, index - 1)].id : state.activeTabId;
          return { tabs, activeTabId };
        }),

      activateTab: (id) => set({ activeTabId: id }),

      reorderTabs: (from, to) =>
        set((state) => {
          const tabs = [...state.tabs];
          const [moved] = tabs.splice(from, 1);
          tabs.splice(to, 0, moved);
          return { tabs };
        }),

      updateTab: (id, patch) =>
        set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)) })),

      navigate: (id, url) =>
        set((state) => {
          const tabs = state.tabs.map((tab) => {
            if (tab.id !== id) return tab;
            const history = [...tab.history.slice(0, tab.historyIndex + 1), url];
            return {
              ...tab,
              url,
              title: labelFor(url),
              history,
              historyIndex: history.length - 1,
              loading: url.startsWith('http'),
              internal: !url.startsWith('http'),
              error: undefined,
            };
          });
          const target = tabs.find((tab) => tab.id === id);
          const history: HistoryEntry[] =
            target && target.url.startsWith('http')
              ? [{ id: uid('h'), url: target.url, title: target.title, visitedAt: Date.now() }, ...state.history].slice(0, 200)
              : state.history;
          return { tabs, history };
        }),

      goBack: (id) =>
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== id || tab.historyIndex <= 0) return tab;
            const historyIndex = tab.historyIndex - 1;
            const url = tab.history[historyIndex];
            return { ...tab, historyIndex, url, title: labelFor(url), internal: !url.startsWith('http') };
          }),
        })),

      goForward: (id) =>
        set((state) => ({
          tabs: state.tabs.map((tab) => {
            if (tab.id !== id || tab.historyIndex >= tab.history.length - 1) return tab;
            const historyIndex = tab.historyIndex + 1;
            const url = tab.history[historyIndex];
            return { ...tab, historyIndex, url, title: labelFor(url), internal: !url.startsWith('http') };
          }),
        })),

      reload: (id) =>
        set((state) => ({ tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, loading: true } : tab)) })),

      addBookmark: (bookmark) =>
        set((state) => ({ bookmarks: [...state.bookmarks, { ...bookmark, id: uid('bm') }] })),

      removeBookmark: (id) => set((state) => ({ bookmarks: state.bookmarks.filter((bookmark) => bookmark.id !== id) })),

      clearHistory: () => set({ history: [] }),

      removeHistoryEntry: (id) => set((state) => ({ history: state.history.filter((entry) => entry.id !== id) })),

      addDownload: (download) =>
        set((state) => ({ downloads: [{ ...download, id: uid('dl'), at: Date.now() }, ...state.downloads].slice(0, 60) })),

      removeDownload: (id) => set((state) => ({ downloads: state.downloads.filter((download) => download.id !== id) })),

      setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
    }),
    {
      name: 'win12-concept.browser',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        bookmarks: state.bookmarks,
        history: state.history.slice(0, 120),
        downloads: state.downloads,
        settings: state.settings,
      }),
    },
  ),
);

export function selectActiveTab(state: BrowserState): BrowserTab | undefined {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];
}
