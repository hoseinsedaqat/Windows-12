import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { EditorState, type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  Files,
  Search,
  GitBranch,
  Play,
  Puzzle,
  X,
  ChevronRight,
  ChevronDown,
  Save,
  FilePlus2,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import type { AppWindowProps } from '../registry';
import type { FSNode } from '../../types';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useShellStore } from '../../stores/shellStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useT } from '../../i18n';
import { ROOT_ID, DOCUMENTS_ID } from '../../core/FileSystem';

/** Concept code editor in the visual language of Visual Studio Code.
 *  Editing is real: files live in the virtual file system (IndexedDB). */

interface OpenTab {
  fileId: string;
  name: string;
}

function languageFor(name: string): { id: string; ext: Extension[] } {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return { id: 'JSON', ext: [json()] };
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return { id: 'HTML', ext: [html()] };
  if (lower.endsWith('.css')) return { id: 'CSS', ext: [css()] };
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return { id: 'Markdown', ext: [markdown()] };
  if (lower.endsWith('.py')) return { id: 'Python', ext: [python()] };
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return { id: 'TypeScript', ext: [javascript({ typescript: true, jsx: lower.endsWith('.tsx') })] };
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return { id: 'JavaScript', ext: [javascript({ jsx: lower.endsWith('.jsx') })] };
  return { id: 'Plain Text', ext: [] };
}

export function VSCodeApp({ props }: AppWindowProps) {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const updateContent = useFileSystemStore((state) => state.updateContent);
  const createFile = useFileSystemStore((state) => state.createFile);
  const openDialog = useShellStore((state) => state.openDialog);

  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [sidebar, setSidebar] = useState(true);
  const [dark, setDark] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [savedFlash, setSavedFlash] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [ROOT_ID]: true, [DOCUMENTS_ID]: true });

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const statesRef = useRef<Map<string, EditorState>>(new Map());
  const docsRef = useRef<Map<string, string>>(new Map());
  const dirtyRef = useRef<Record<string, boolean>>({});
  const tabsRef = useRef<OpenTab[]>([]);
  const activeRef = useRef<string | null>(null);
  tabsRef.current = tabs;
  activeRef.current = activeId;

  const markDirty = useCallback((fileId: string, value: boolean) => {
    dirtyRef.current = { ...dirtyRef.current, [fileId]: value };
    setDirty(dirtyRef.current);
  }, []);

  const saveActive = useCallback(() => {
    const id = activeRef.current;
    if (!id) return;
    const text = docsRef.current.get(id);
    if (text === undefined) return;
    updateContent(id, text);
    markDirty(id, false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1400);
  }, [markDirty, updateContent]);

  const buildState = useCallback(
    (fileId: string, text: string, name: string) => {
      const lang = languageFor(name);
      return EditorState.create({
        doc: text,
        extensions: [
          basicSetup,
          lang.ext,
          dark ? oneDark : [],
          keymap.of([
            { key: 'Mod-s', run: () => (saveActive(), true) },
            { key: 'Mod-Shift-p', run: () => (setPaletteOpen(true), true) },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              docsRef.current.set(fileId, update.state.doc.toString());
              markDirty(fileId, true);
            }
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              setCursor({ line: line.number, col: head - line.from + 1 });
            }
          }),
          EditorView.theme({ '&': { height: '100%', fontSize: '13px' }, '.cm-scroller': { fontFamily: "'Cascadia Code', Consolas, monospace" } }),
        ],
      });
    },
    [dark, markDirty, saveActive],
  );

  const openFile = useCallback(
    (node: FSNode) => {
      if (node.kind !== 'text') return;
      if (!tabsRef.current.some((tab) => tab.fileId === node.id)) {
        setTabs((current) => [...current, { fileId: node.id, name: node.name }]);
      }
      setActiveId(node.id);
      if (!docsRef.current.has(node.id)) {
        docsRef.current.set(node.id, typeof node.content === 'string' ? node.content : '');
      }
    },
    [],
  );

  // Open a file passed as props (e.g. "Open with Visual Studio Code").
  useEffect(() => {
    const fileId = props.fileId as string | undefined;
    if (fileId && nodes[fileId]) openFile(nodes[fileId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create/destroy the single EditorView; swap states when the tab changes.
  useEffect(() => {
    if (!hostRef.current) return undefined;
    const view = new EditorView({ parent: hostRef.current, state: EditorState.create({ extensions: [EditorView.editable.of(false)] }) });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !activeId) return;
    const tab = tabs.find((item) => item.fileId === activeId);
    if (!tab) return;
    let state = statesRef.current.get(activeId);
    const storedDoc = docsRef.current.get(activeId);
    if (!state || (storedDoc !== undefined && state.doc.toString() !== storedDoc && !dirtyRef.current[activeId])) {
      state = buildState(activeId, storedDoc ?? '', tab.name);
      statesRef.current.set(activeId, state);
    }
    view.setState(state);
  }, [activeId, tabs, buildState]);

  // Rebuild editor states when the theme flips.
  useEffect(() => {
    statesRef.current.clear();
    if (activeId) {
      const tab = tabsRef.current.find((item) => item.fileId === activeId);
      if (tab) {
        const state = buildState(activeId, docsRef.current.get(activeId) ?? '', tab.name);
        statesRef.current.set(activeId, state);
        viewRef.current?.setState(state);
      }
    }
  }, [dark, activeId, buildState]);

  const closeTab = (fileId: string) => {
    if (dirtyRef.current[fileId]) {
      openDialog({
        kind: 'confirm',
        title: t('vscode.unsavedTitle'),
        message: t('vscode.unsavedBody'),
        confirmLabel: t('vscode.saveAndClose'),
        onConfirm: () => {
          const text = docsRef.current.get(fileId);
          if (text !== undefined) updateContent(fileId, text);
          markDirty(fileId, false);
          removeTab(fileId);
        },
      });
      return;
    }
    removeTab(fileId);
  };

  const removeTab = (fileId: string) => {
    setTabs((current) => {
      const next = current.filter((tab) => tab.fileId !== fileId);
      if (activeRef.current === fileId) setActiveId(next[next.length - 1]?.fileId ?? null);
      return next;
    });
    statesRef.current.delete(fileId);
    docsRef.current.delete(fileId);
    markDirty(fileId, false);
  };

  const newFile = () => {
    openDialog({
      kind: 'prompt',
      title: t('vscode.newFile'),
      message: t('vscode.newFileHint'),
      defaultValue: 'untitled.js',
      confirmLabel: t('common.create'),
      onConfirm: (value) => {
        const name = value.trim() || 'untitled.txt';
        const id = createFile('text', DOCUMENTS_ID, name);
        const node = useFileSystemStore.getState().nodes[id];
        if (node) openFile(node);
      },
    });
  };

  const textNodes = useMemo(() => Object.values(nodes).filter((node) => !node.deleted), [nodes]);

  const commands = useMemo(
    () => [
      { id: 'new', label: t('vscode.newFile'), run: newFile },
      { id: 'save', label: t('vscode.save'), run: saveActive },
      { id: 'sidebar', label: t('vscode.toggleSidebar'), run: () => setSidebar((value) => !value) },
      { id: 'theme', label: t('vscode.toggleTheme'), run: () => setDark((value) => !value) },
      { id: 'close', label: t('vscode.closeEditor'), run: () => activeId && closeTab(activeId) },
      ...textNodes
        .filter((node) => node.kind === 'text')
        .map((node) => ({ id: `open-${node.id}`, label: `${t('vscode.openFile')}: ${node.name}`, run: () => openFile(node) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, activeId, saveActive, openFile, textNodes],
  );

  const activeTab = tabs.find((tab) => tab.fileId === activeId) ?? null;
  const activeLang = activeTab ? languageFor(activeTab.name).id : 'Plain Text';

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#1e1e1e] text-[#cccccc]" onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveActive();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }}>
      {/* Menu bar */}
      <div className="flex h-8 shrink-0 items-center gap-1 bg-[#3c3c3c] px-2 text-[12px]">
        <MenuBar label={t('vscode.menuFile')}>
          <MenuAction onClick={newFile}>{t('vscode.newFile')}</MenuAction>
          <MenuAction onClick={saveActive}>{t('vscode.save')}</MenuAction>
          <MenuAction onClick={() => activeId && closeTab(activeId)}>{t('vscode.closeEditor')}</MenuAction>
        </MenuBar>
        <MenuBar label={t('vscode.menuEdit')}>
          <MenuAction onClick={() => viewRef.current?.focus()}>{t('vscode.focusEditor')}</MenuAction>
        </MenuBar>
        <MenuBar label={t('vscode.menuView')}>
          <MenuAction onClick={() => setSidebar((value) => !value)}>{t('vscode.toggleSidebar')}</MenuAction>
          <MenuAction onClick={() => setPaletteOpen(true)}>{t('vscode.commandPalette')}</MenuAction>
          <MenuAction onClick={() => setDark((value) => !value)}>{t('vscode.toggleTheme')}</MenuAction>
        </MenuBar>
        <MenuBar label={t('vscode.menuHelp')}>
          <MenuAction onClick={() => useNotificationStore.getState().push({ title: 'Visual Studio Code', body: t('vscode.aboutNote'), kind: 'info' })}>
            {t('browser.aboutPage')}
          </MenuAction>
        </MenuBar>
        <span className="ml-auto truncate opacity-60">{activeTab ? `${activeTab.name} — ` : ''}Visual Studio Code</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Activity bar */}
        <div className="flex w-12 shrink-0 flex-col items-center gap-1 bg-[#333333] py-2">
          <ActivityButton active={sidebar} label={t('vscode.explorer')} onClick={() => setSidebar((value) => !value)}>
            <Files size={20} />
          </ActivityButton>
          <ActivityButton label={t('vscode.searchConcept')} onClick={() => useNotificationStore.getState().push({ title: 'Visual Studio Code', body: t('vscode.conceptOnly'), kind: 'info' })}>
            <Search size={20} />
          </ActivityButton>
          <ActivityButton label={t('vscode.sourceControl')} onClick={() => useNotificationStore.getState().push({ title: 'Visual Studio Code', body: t('vscode.conceptOnly'), kind: 'info' })}>
            <GitBranch size={20} />
          </ActivityButton>
          <ActivityButton label={t('vscode.runDebug')} onClick={() => useNotificationStore.getState().push({ title: 'Visual Studio Code', body: t('vscode.conceptOnly'), kind: 'info' })}>
            <Play size={20} />
          </ActivityButton>
          <ActivityButton label={t('vscode.extensions')} onClick={() => useNotificationStore.getState().push({ title: 'Visual Studio Code', body: t('vscode.conceptOnly'), kind: 'info' })}>
            <Puzzle size={20} />
          </ActivityButton>
        </div>

        {/* Sidebar */}
        {sidebar ? (
          <div className="flex w-56 shrink-0 flex-col border-r border-black/40 bg-[#252526]">
            <div className="px-3 py-2 text-[10.5px] uppercase tracking-wide opacity-70">{t('vscode.explorerTitle')}</div>
            <div className="min-h-0 flex-1 overflow-auto pb-2 text-[12.5px]">
              <TreeNodes parentId={ROOT_ID} depth={0} expanded={expanded} setExpanded={setExpanded} onOpen={openFile} />
            </div>
          </div>
        ) : null}

        {/* Editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-stretch overflow-x-auto bg-[#252526]">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.fileId}
                onClick={() => setActiveId(tab.fileId)}
                className={`group flex min-w-0 items-center gap-2 border-r border-black/40 px-3 text-[12px] ${
                  tab.fileId === activeId ? 'bg-[#1e1e1e] text-white' : 'bg-[#2d2d2d] opacity-80 hover:opacity-100'
                }`}
              >
                <span className="truncate">{tab.name}</span>
                {dirty[tab.fileId] ? <span className="h-2 w-2 rounded-full bg-[#e2c08d]" /> : null}
                <span
                  role="button"
                  tabIndex={-1}
                  className="rounded p-0.5 hover:bg-white/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.fileId);
                  }}
                  aria-label={t('vscode.closeEditor')}
                >
                  <X size={12} />
                </span>
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1">
            <div ref={hostRef} className="absolute inset-0 overflow-hidden" style={{ display: activeTab ? undefined : 'none' }} />
            {!activeTab ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-[13px] opacity-80">
                <span className="text-4xl font-light opacity-40">{'</>'}</span>
                <span>{t('vscode.welcome')}</span>
                <span className="opacity-60">{t('vscode.welcomeHint')}</span>
                <button type="button" className="win-button h-8 px-3" onClick={() => setPaletteOpen(true)}>
                  {t('vscode.commandPalette')} (Ctrl+Shift+P)
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex h-6 shrink-0 items-center gap-3 bg-[#007acc] px-2 text-[11px] text-white">
        <span className="flex items-center gap-1"><GitBranch size={11} /> main</span>
        <span className="flex items-center gap-1"><AlertTriangle size={11} /> 0</span>
        <span className="ml-auto tabular-nums">{t('vscode.lnCol', { line: cursor.line, col: cursor.col })}</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>{activeLang}</span>
        {savedFlash ? <span className="flex items-center gap-1"><Save size={11} /> {t('vscode.saved')}</span> : null}
        <Bell size={11} />
      </div>

      {/* Command palette */}
      {paletteOpen ? (
        <CommandPalette
          commands={commands}
          onClose={() => setPaletteOpen(false)}
          placeholder={t('vscode.commandPalette')}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MenuBar({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button type="button" className={`rounded px-2 py-0.5 hover:bg-white/10 ${open ? 'bg-white/10' : ''}`} onClick={() => setOpen((value) => !value)}>
        {label}
      </button>
      {open ? (
        <div className="panel absolute left-0 top-full z-10 w-52 overflow-hidden p-1" onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function MenuAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="list-row w-full justify-start text-[12px]" onClick={onClick}>
      {children}
    </button>
  );
}

function ActivityButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded ${active ? 'text-white' : 'opacity-60 hover:opacity-100'}`}
      style={active ? { borderLeft: '2px solid #fff' } : undefined}
    >
      {children}
    </button>
  );
}

function TreeNodes({
  parentId,
  depth,
  expanded,
  setExpanded,
  onOpen,
}: {
  parentId: string;
  depth: number;
  expanded: Record<string, boolean>;
  setExpanded: (fn: (current: Record<string, boolean>) => Record<string, boolean>) => void;
  onOpen: (node: FSNode) => void;
}) {
  const nodes = useFileSystemStore((state) => state.nodes);
  const children = useMemo(
    () =>
      Object.values(nodes)
        .filter((node) => node.parentId === parentId && !node.deleted)
        .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1)),
    [nodes, parentId],
  );
  return (
    <>
      {children.map((node) =>
        node.kind === 'folder' ? (
          <div key={node.id}>
            <button
              type="button"
              className="flex w-full items-center gap-1 px-2 py-0.5 text-left hover:bg-white/5"
              style={{ paddingInlineStart: 8 + depth * 12 }}
              onClick={() => setExpanded((current) => ({ ...current, [node.id]: !current[node.id] }))}
            >
              {expanded[node.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="truncate">{node.name}</span>
            </button>
            {expanded[node.id] ? (
              <TreeNodes parentId={node.id} depth={depth + 1} expanded={expanded} setExpanded={setExpanded} onOpen={onOpen} />
            ) : null}
          </div>
        ) : node.kind === 'text' ? (
          <button
            type="button"
            key={node.id}
            className="flex w-full items-center gap-1 px-2 py-0.5 text-left hover:bg-white/5"
            style={{ paddingInlineStart: 20 + depth * 12 }}
            onClick={() => onOpen(node)}
          >
            <FilePlus2 size={12} className="opacity-60" />
            <span className="truncate">{node.name}</span>
          </button>
        ) : null,
      )}
    </>
  );
}

function CommandPalette({
  commands,
  onClose,
  placeholder,
}: {
  commands: { id: string; label: string; run: () => void }[];
  onClose: () => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  return (
    <div className="absolute inset-x-0 top-10 z-20 mx-auto w-[480px] max-w-[90%]" onPointerDown={(event) => event.stopPropagation()}>
      <div className="panel overflow-hidden p-1">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') onClose();
            if (event.key === 'Enter' && filtered[0]) {
              filtered[0].run();
              onClose();
            }
          }}
          placeholder={`> ${placeholder}`}
          className="h-9 w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[13px] outline-none"
        />
        <div className="mt-1 max-h-64 overflow-auto">
          {filtered.map((command) => (
            <button
              type="button"
              key={command.id}
              className="list-row w-full justify-start text-[12.5px]"
              onClick={() => {
                command.run();
                onClose();
              }}
            >
              {command.label}
            </button>
          ))}
          {filtered.length === 0 ? <div className="px-3 py-2 text-[12px] opacity-60">—</div> : null}
        </div>
      </div>
    </div>
  );
}

export default VSCodeApp;
