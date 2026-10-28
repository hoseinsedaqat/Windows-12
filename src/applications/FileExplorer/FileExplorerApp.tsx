import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsUpDown,
  Copy,
  Download,
  Eye,
  Folder,
  FolderInput,
  FolderPlus,
  Grid3x3,
  HardDrive,
  Info,
  LayoutList,
  Monitor,
  Music,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
  Upload,
  Video,
  Cloud,
  X,
  FileText,
  Clipboard,
  ArrowUpDown,
} from 'lucide-react';
import type { AppWindowProps } from '../../applications/registry';
import type { ExplorerView, FileKind, FSNode, SortDirection, SortKey } from '../../types';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useShellStore } from '../../stores/shellStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  DESKTOP_ID,
  DOCUMENTS_ID,
  DOWNLOADS_ID,
  getChildren,
  KIND_LABELS,
  MUSIC_ID,
  nodeSize,
  ONEDRIVE_ID,
  PICTURES_ID,
  RECYCLE_BIN_ID,
  resolvePath,
  ROOT_ID,
  searchNodes,
  sortNodes,
  VIDEOS_ID,
  countDescendants,
} from '../../core/FileSystem';
import { AppIcon, KindIcon, ThisPcIcon, RecycleBinIcon } from '../../components/icons/AppIcons';
import { useT } from '../../i18n';
import { formatBytes, formatDate } from '../../services/format';
import { launchApp, openNode, openWith } from '../../services/launcher';
import { pickFiles } from '../../services/files';
import { appsForKind } from '../../core/ApplicationRegistry';
import { Toolbar, ToolButton, EmptyState, Badge, ProgressBar } from '../../components/ui/Controls';
import { playSound } from '../../services/sound';

const SIDEBAR: { id: string; labelKey: string; icon: typeof Folder; folderId: string | null }[] = [
  { id: 'home', labelKey: 'explorer.home', icon: Monitor, folderId: ROOT_ID },
  { id: 'desktop', labelKey: 'explorer.desktop', icon: Folder, folderId: DESKTOP_ID },
  { id: 'documents', labelKey: 'explorer.documents', icon: Folder, folderId: DOCUMENTS_ID },
  { id: 'downloads', labelKey: 'explorer.downloads', icon: Download, folderId: DOWNLOADS_ID },
  { id: 'pictures', labelKey: 'explorer.pictures', icon: Folder, folderId: PICTURES_ID },
  { id: 'music', labelKey: 'explorer.music', icon: Music, folderId: MUSIC_ID },
  { id: 'videos', labelKey: 'explorer.videos', icon: Video, folderId: VIDEOS_ID },
  { id: 'onedrive', labelKey: 'explorer.oneDrive', icon: Cloud, folderId: ONEDRIVE_ID },
  { id: 'recycle', labelKey: 'explorer.recycleBin', icon: Trash2, folderId: RECYCLE_BIN_ID },
];

const KIND_FILTERS: { value: FileKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'folder', label: 'Folders' },
  { value: 'doc', label: 'Documents' },
  { value: 'sheet', label: 'Spreadsheets' },
  { value: 'slides', label: 'Presentations' },
  { value: 'text', label: 'Text' },
  { value: 'note', label: 'Notes' },
  { value: 'image', label: 'Pictures' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
];

export function FileExplorerApp({ props }: AppWindowProps) {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const clipboard = useFileSystemStore((state) => state.clipboard);
  const setClipboard = useFileSystemStore((state) => state.setClipboard);
  const createFolder = useFileSystemStore((state) => state.createFolder);
  const createFile = useFileSystemStore((state) => state.createFile);
  const renameNode = useFileSystemStore((state) => state.rename);
  const softDelete = useFileSystemStore((state) => state.softDelete);
  const restore = useFileSystemStore((state) => state.restore);
  const purge = useFileSystemStore((state) => state.purge);
  const emptyTrash = useFileSystemStore((state) => state.emptyTrash);
  const move = useFileSystemStore((state) => state.move);
  const paste = useFileSystemStore((state) => state.paste);
  const duplicate = useFileSystemStore((state) => state.duplicate);
  const importFiles = useFileSystemStore((state) => state.importFiles);
  const exportNode = useFileSystemStore((state) => state.exportNode);
  const usedBytes = useFileSystemStore((state) => state.usedBytes);

  const openContextMenu = useShellStore((state) => state.openContextMenu);
  const openDialog = useShellStore((state) => state.openDialog);
  const setProperties = useShellStore((state) => state.setProperties);
  const quotaMB = useSettingsStore((state) => state.settings.storageQuotaMB);

  const initialPath = (props.path as string | undefined) ?? ROOT_ID;
  const isRecycleProp = Boolean(props.recycle);
  const [path, setPath] = useState<string | null>(isRecycleProp ? RECYCLE_BIN_ID : initialPath);
  const [history, setHistory] = useState<(string | null)[]>([isRecycleProp ? RECYCLE_BIN_ID : initialPath]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [view, setView] = useState<ExplorerView>('details');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [kindFilter, setKindFilter] = useState<FileKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<string[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /* react to window prop changes (e.g. launching "Documents" while open) */
  useEffect(() => {
    const target = isRecycleProp ? RECYCLE_BIN_ID : ((props.path as string | undefined) ?? null);
    if (target !== null && target !== path) navigate(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.path, props.recycle]);

  const navigate = useCallback(
    (next: string | null) => {
      setPath(next);
      setSelection([]);
      setQuery('');
      setHistory((previous) => {
        const trimmed = previous.slice(0, historyIndex + 1);
        return [...trimmed, next];
      });
      setHistoryIndex((index) => index + 1);
      playSound('click');
    },
    [historyIndex],
  );

  const goBack = () => {
    if (historyIndex <= 0) return;
    const next = historyIndex - 1;
    setHistoryIndex(next);
    setPath(history[next]);
    setSelection([]);
  };

  const goForward = () => {
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    setHistoryIndex(next);
    setPath(history[next]);
    setSelection([]);
  };

  const goUp = () => {
    if (!path || path === ROOT_ID) return;
    const parent = nodes[path]?.parentId ?? ROOT_ID;
    navigate(parent);
  };

  const inRecycle = path === RECYCLE_BIN_ID;
  const isThisPc = path === ROOT_ID;

  const items = useMemo(() => {
    if (query.trim()) {
      return searchNodes(nodes, query, { includeDeleted: inRecycle, scopeId: inRecycle ? undefined : path, limit: 300 });
    }
    let children = inRecycle
      ? Object.values(nodes).filter((node) => node.deleted && !(node.parentId ? nodes[node.parentId]?.deleted : false))
      : getChildren(nodes, path);
    if (kindFilter !== 'all') children = children.filter((node) => node.kind === kindFilter);
    return sortNodes(children, { key: sortKey, direction: sortDir, foldersFirst: true });
  }, [nodes, path, query, inRecycle, kindFilter, sortKey, sortDir]);

  const quotaBytes = quotaMB * 1024 * 1024;

  const toggleSelection = (id: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      setSelection((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    } else if (event.shiftKey && selection.length) {
      const ids = items.map((item) => item.id);
      const from = ids.indexOf(selection[selection.length - 1]);
      const to = ids.indexOf(id);
      if (from >= 0 && to >= 0) setSelection(ids.slice(Math.min(from, to), Math.max(from, to) + 1));
    } else {
      setSelection([id]);
    }
  };

  const commitRename = () => {
    if (!renamingId) return;
    const ok = renameNode(renamingId, renameValue);
    if (!ok) {
      pushExplorerWarning(t('explorer.nameExists'));
    }
    setRenamingId(null);
  };

  const startRename = (node: FSNode) => {
    setRenamingId(node.id);
    setRenameValue(node.name);
  };

  const handleNew = (kind: FileKind | 'folder') => {
    const parentId = inRecycle ? DOCUMENTS_ID : (path ?? ROOT_ID);
    if (kind === 'folder') {
      const id = createFolder(parentId);
      setSelection([id]);
      startRename(useFileSystemStore.getState().nodes[id]);
    } else {
      const id = createFile(kind, parentId);
      const node = useFileSystemStore.getState().nodes[id];
      openNode(node);
      setSelection([id]);
    }
  };

  const onUpload = async () => {
    const files = await pickFiles();
    if (files.length) await importFiles(files, inRecycle ? DOWNLOADS_ID : (path ?? ROOT_ID));
  };

  const itemMenu = (event: React.MouseEvent, node: FSNode) => {
    event.preventDefault();
    event.stopPropagation();
    const ids = selection.includes(node.id) ? selection : [node.id];
    if (!selection.includes(node.id)) setSelection([node.id]);
    const openWithApps = appsForKind(node.kind);

    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: node.name,
      items: inRecycle
        ? [
            { id: 'restore', label: t('explorer.restoreItem'), icon: 'RotateCcw', action: () => restore(ids) },
            {
              id: 'purge',
              label: t('explorer.deleteForever'),
              icon: 'Trash2',
              danger: true,
              action: () =>
                openDialog({
                  kind: 'confirm',
                  title: t('common.confirmTitle'),
                  message: t('explorer.deleteForeverConfirm', { name: node.name }),
                  danger: true,
                  onConfirm: () => purge(ids),
                }),
            },
            { id: 'sep', label: '', separator: true },
            { id: 'props', label: t('common.properties'), icon: 'Info', action: () => setProperties(node.id) },
          ]
        : [
            { id: 'open', label: t('common.open'), icon: 'FolderOpen', action: () => openNode(node) },
            ...(openWithApps.length
              ? [
                  {
                    id: 'open-with',
                    label: t('common.openWith'),
                    icon: 'AppWindow',
                    submenu: openWithApps.map((app) => ({
                      id: `open-${app.id}`,
                      label: app.name,
                      action: () => openWith(node, app.id),
                    })),
                  },
                ]
              : []),
            { id: 'sep1', label: '', separator: true },
            { id: 'cut', label: t('common.cut'), icon: 'Scissors', shortcut: 'Ctrl+X', action: () => setClipboard({ mode: 'cut', ids }) },
            { id: 'copy', label: t('common.copy'), icon: 'Copy', shortcut: 'Ctrl+C', action: () => setClipboard({ mode: 'copy', ids }) },
            { id: 'paste', label: t('common.paste'), icon: 'Clipboard', shortcut: 'Ctrl+V', disabled: !clipboard || node.kind !== 'folder', action: () => paste(node.id) },
            { id: 'duplicate', label: t('explorer.duplicate'), icon: 'Copy', action: () => ids.forEach((id) => duplicate(id)) },
            { id: 'sep2', label: '', separator: true },
            {
              id: 'rename',
              label: t('common.rename'),
              icon: 'Pencil',
              shortcut: 'F2',
              disabled: Boolean(node.system),
              action: () => startRename(node),
            },
            {
              id: 'delete',
              label: t('common.delete'),
              icon: 'Trash2',
              shortcut: 'Del',
              danger: true,
              disabled: Boolean(node.system && node.parentId === ROOT_ID),
              action: () => softDelete(ids),
            },
            { id: 'sep3', label: '', separator: true },
            { id: 'download', label: t('explorer.download'), icon: 'Download', disabled: node.kind === 'folder', action: () => exportNode(node.id) },
            { id: 'props', label: t('common.properties'), icon: 'Info', action: () => setProperties(node.id) },
          ],
    });
  };

  const backgroundMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        {
          id: 'view',
          label: t('desktop.view'),
          icon: 'LayoutGrid',
          submenu: [
            { id: 'view-details', label: t('explorer.viewDetails'), checked: view === 'details', action: () => setView('details') },
            { id: 'view-list', label: t('explorer.viewList'), checked: view === 'list', action: () => setView('list') },
            { id: 'view-grid', label: t('explorer.viewGrid'), checked: view === 'grid', action: () => setView('grid') },
          ],
        },
        {
          id: 'sort',
          label: t('desktop.sortBy'),
          icon: 'ArrowUpDown',
          submenu: [
            { id: 'sort-name', label: t('common.name'), checked: sortKey === 'name', action: () => setSortKey('name') },
            { id: 'sort-modified', label: t('common.dateModified'), checked: sortKey === 'updatedAt', action: () => setSortKey('updatedAt') },
            { id: 'sort-created', label: t('common.dateCreated'), checked: sortKey === 'createdAt', action: () => setSortKey('createdAt') },
            { id: 'sort-type', label: t('common.type'), checked: sortKey === 'kind', action: () => setSortKey('kind') },
            { id: 'sort-size', label: t('common.size'), checked: sortKey === 'size', action: () => setSortKey('size') },
            { id: 'sort-sep', label: '', separator: true },
            { id: 'sort-asc', label: t('explorer.sortAsc'), checked: sortDir === 'asc', action: () => setSortDir('asc') },
            { id: 'sort-desc', label: t('explorer.sortDesc'), checked: sortDir === 'desc', action: () => setSortDir('desc') },
          ],
        },
        { id: 'refresh', label: t('common.refresh'), icon: 'RefreshCw', action: () => setSortKey((key) => key) },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'new',
          label: t('common.new'),
          icon: 'Plus',
          disabled: inRecycle,
          submenu: [
            { id: 'new-folder', label: t('explorer.newFolder'), action: () => handleNew('folder') },
            { id: 'new-sep0', label: '', separator: true },
            { id: 'new-doc', label: t('explorer.wordDoc'), action: () => handleNew('doc') },
            { id: 'new-sheet', label: t('explorer.excelWorkbook'), action: () => handleNew('sheet') },
            { id: 'new-slides', label: t('explorer.pptPresentation'), action: () => handleNew('slides') },
            { id: 'new-text', label: t('explorer.textDoc'), action: () => handleNew('text') },
            { id: 'new-note', label: t('explorer.note'), action: () => handleNew('note') },
            { id: 'new-sep1', label: '', separator: true },
            { id: 'new-shortcut', label: t('explorer.shortcut'), action: () => createShortcut() },
          ],
        },
        { id: 'paste', label: t('common.paste'), icon: 'Clipboard', shortcut: 'Ctrl+V', disabled: !clipboard || inRecycle, action: () => paste(path) },
        { id: 'upload', label: t('explorer.upload'), icon: 'Upload', disabled: inRecycle, action: () => void onUpload() },
        { id: 'sep2', label: '', separator: true },
        { id: 'select-all', label: t('explorer.selectAll'), icon: 'Copy', shortcut: 'Ctrl+A', action: () => setSelection(items.map((item) => item.id)) },
        ...(inRecycle ? [{ id: 'empty', label: t('desktop.emptyTrash'), icon: 'Trash2', danger: true, action: () => confirmEmpty() }] : []),
        { id: 'sep3', label: '', separator: true },
        { id: 'display', label: t('desktop.displaySettings'), icon: 'Monitor', action: () => launchApp('settings', { section: 'display' }) },
        { id: 'personalize', label: t('desktop.personalize'), icon: 'Palette', action: () => launchApp('settings', { section: 'background' }) },
      ],
    });
  };

  const createShortcut = () => {
    openDialog({
      kind: 'prompt',
      title: t('explorer.shortcut'),
      message: 'App id or name (chrome, word, accounting…)',
      defaultValue: 'chrome',
      confirmLabel: t('common.create'),
      onConfirm: (value) => {
        const id = createFile('shortcut', path ?? ROOT_ID, value.trim() || 'Shortcut');
        useFileSystemStore.getState().updateMetadata(id, { appId: value.trim().toLowerCase() });
      },
    });
  };

  const confirmEmpty = () => {
    openDialog({
      kind: 'confirm',
      title: t('desktop.emptyTrash'),
      message: t('explorer.emptyTrashConfirm'),
      danger: true,
      onConfirm: () => emptyTrash(),
    });
  };

  /* Keyboard */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (event.key === 'F2' && selection.length === 1) {
        event.preventDefault();
        const node = nodes[selection[0]];
        if (node && !node.system) startRename(node);
        return;
      }
      if (event.key === 'Delete' && selection.length && !inRecycle) {
        event.preventDefault();
        softDelete(selection);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        goUp();
        return;
      }
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        goBack();
        return;
      }
      if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        goForward();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(items.map((item) => item.id));
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && selection.length) {
        event.preventDefault();
        setClipboard({ mode: 'copy', ids: selection });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'x' && selection.length && !inRecycle) {
        event.preventDefault();
        setClipboard({ mode: 'cut', ids: selection });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v' && clipboard && !inRecycle) {
        event.preventDefault();
        paste(selection.length === 1 && nodes[selection[0]]?.kind === 'folder' ? selection[0] : path);
        return;
      }
      if (event.key === 'Enter' && selection.length === 1) {
        event.preventDefault();
        openNode(nodes[selection[0]]);
      }
      if (event.key === 'Escape') setSelection([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const crumbs = useMemo(() => {
    const parts: { id: string | null; label: string }[] = [{ id: ROOT_ID, label: t('explorer.thisPc') }];
    let current = path && path !== ROOT_ID ? nodes[path] : undefined;
    const chain: FSNode[] = [];
    const guard = new Set<string>();
    while (current && current.id !== ROOT_ID && !guard.has(current.id)) {
      guard.add(current.id);
      chain.unshift(current);
      current = current.parentId ? nodes[current.parentId] : undefined;
    }
    chain.forEach((node) => parts.push({ id: node.id, label: node.name }));
    return parts;
  }, [path, nodes, t]);

  const selectedSize = selection.reduce((sum, id) => sum + nodeSize(nodes, nodes[id] ?? ({ size: 0 } as FSNode)), 0);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      {/* Navigation toolbar */}
      <Toolbar className="gap-1">
        <ToolButton icon={<ArrowLeft size={16} />} onClick={goBack} disabled={historyIndex <= 0} title={t('common.back')} />
        <ToolButton icon={<ArrowRight size={16} />} onClick={goForward} disabled={historyIndex >= history.length - 1} title={t('common.forward')} />
        <ToolButton icon={<ArrowUp size={16} />} onClick={goUp} disabled={!path || path === ROOT_ID} title={t('common.up')} />
        <ToolButton icon={<RefreshCw size={15} />} onClick={() => void useFileSystemStore.getState().hydrate()} title={t('common.refresh')} />

        <div className="mx-1 flex h-8 min-w-0 flex-1 items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--surface-solid)] px-2">
          <ThisPcIcon size={14} />
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-[12px]" aria-label="Breadcrumb">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.id}-${index}`} className="flex shrink-0 items-center gap-0.5">
                {index > 0 ? <span className="opacity-40">›</span> : null}
                <button type="button" className="rounded px-1.5 py-0.5 hover:bg-[var(--hover)]" onClick={() => navigate(crumb.id)}>
                  {crumb.label}
                </button>
              </span>
            ))}
          </nav>
        </div>

        <label className="flex h-8 w-48 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface-solid)] px-2">
          <Search size={14} className="opacity-55" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('explorer.searchPlaceholder')}
            className="w-full bg-transparent text-[12px] outline-none placeholder:opacity-50"
            aria-label={t('explorer.searchPlaceholder')}
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('common.close')}>
              <X size={13} className="opacity-55" />
            </button>
          ) : null}
        </label>
      </Toolbar>

      {/* Command bar */}
      <Toolbar className="gap-0.5 text-[12px]">
        <NewMenu onPick={handleNew} disabled={inRecycle} label={t('common.new')} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Scissors size={15} />} label={t('common.cut')} disabled={!selection.length || inRecycle} onClick={() => setClipboard({ mode: 'cut', ids: selection })} />
        <ToolButton icon={<Copy size={15} />} label={t('common.copy')} disabled={!selection.length} onClick={() => setClipboard({ mode: 'copy', ids: selection })} />
        <ToolButton icon={<Clipboard size={15} />} label={t('common.paste')} disabled={!clipboard || inRecycle} onClick={() => paste(path)} />
        <ToolButton icon={<Pencil size={15} />} label={t('common.rename')} disabled={selection.length !== 1 || Boolean(nodes[selection[0]]?.system)} onClick={() => startRename(nodes[selection[0]])} />
        {inRecycle ? (
          <>
            <ToolButton icon={<RotateCcw size={15} />} label={t('explorer.restoreItem')} disabled={!selection.length} onClick={() => restore(selection)} />
            <ToolButton icon={<Trash2 size={15} />} label={t('desktop.emptyTrash')} danger onClick={confirmEmpty} />
          </>
        ) : (
          <ToolButton
            icon={<Trash2 size={15} />}
            label={t('common.delete')}
            danger
            disabled={!selection.length}
            onClick={() => softDelete(selection)}
          />
        )}
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <SortMenu sortKey={sortKey} sortDir={sortDir} onKey={setSortKey} onDir={setSortDir} />
        <ViewMenu view={view} onChange={setView} />
        <FilterMenu value={kindFilter} onChange={setKindFilter} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Upload size={15} />} label={t('explorer.upload')} disabled={inRecycle} onClick={() => void onUpload()} />
        <ToolButton
          icon={<Download size={15} />}
          label={t('explorer.download')}
          disabled={selection.length !== 1 || nodes[selection[0]]?.kind === 'folder'}
          onClick={() => selection.forEach((id) => exportNode(id))}
        />
        <ToolButton icon={<Info size={15} />} label={t('common.properties')} disabled={selection.length !== 1} onClick={() => setProperties(selection[0])} />
        <span className="ms-auto flex items-center gap-2 pe-1 text-[11px] opacity-60">
          {clipboard ? (
            <Badge tone="accent">
              {clipboard.mode === 'cut' ? <Scissors size={10} /> : <Copy size={10} />} {clipboard.ids.length}
            </Badge>
          ) : null}
        </span>
      </Toolbar>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="scroll-thin hidden w-52 shrink-0 overflow-y-auto border-e border-[var(--border)] bg-[var(--surface-2)] p-2 sm:block">
          <p className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-wide opacity-50">{t('explorer.quickAccess')}</p>
          {SIDEBAR.map((entry) => {
            const Icon = entry.icon;
            const active = path === entry.folderId;
            return (
              <button
                key={entry.id}
                type="button"
                className={`list-row w-full ${active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : ''}`}
                onClick={() => navigate(entry.folderId)}
              >
                {entry.id === 'recycle' ? <Trash2 size={15} /> : <Icon size={15} />}
                <span className="truncate">{t(entry.labelKey)}</span>
              </button>
            );
          })}
          <p className="mb-1 mt-3 px-2 text-[10.5px] font-semibold uppercase tracking-wide opacity-50">{t('explorer.storage')}</p>
          <div className="rounded-lg border border-[var(--border)] p-2">
            <div className="mb-1 flex items-center gap-2 text-[11.5px]">
              <HardDrive size={14} className="opacity-70" />
              <span className="truncate">{t('explorer.localDisk')}</span>
            </div>
            <ProgressBar value={usedBytes} max={quotaBytes} />
            <p className="mt-1 text-[10.5px] opacity-60">
              {t('explorer.freeOf', { free: formatBytes(Math.max(0, quotaBytes - usedBytes)), total: formatBytes(quotaBytes) })}
            </p>
          </div>
        </aside>

        {/* Content */}
        <div
          ref={contentRef}
          className="scroll-thin relative min-w-0 flex-1 overflow-auto p-2"
          onContextMenu={backgroundMenu}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSelection([]);
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('Files')) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={async (event) => {
            const files = Array.from(event.dataTransfer.files ?? []);
            if (files.length) {
              event.preventDefault();
              await importFiles(files, inRecycle ? DOWNLOADS_ID : (path ?? ROOT_ID));
            }
          }}
        >
          {isThisPc && !query ? <ThisPcView onOpenFolder={navigate} usedBytes={usedBytes} quotaBytes={quotaBytes} /> : null}

          {!isThisPc || query ? (
            items.length === 0 ? (
              <EmptyState
                icon={inRecycle ? <Trash2 size={40} /> : <FolderInput size={40} />}
                title={inRecycle ? t('explorer.emptyTrash') : query ? t('start.noResults') : t('explorer.emptyFolder')}
                message={inRecycle ? undefined : 'Right-click for the New menu, or drop real files from your computer into this window.'}
                action={
                  inRecycle ? undefined : (
                    <div className="flex gap-2">
                      <button type="button" className="win-button" onClick={() => handleNew('folder')}>
                        <FolderPlus size={14} /> {t('explorer.newFolder')}
                      </button>
                      <button type="button" className="win-button win-button-accent" onClick={() => void onUpload()}>
                        <Upload size={14} /> {t('explorer.upload')}
                      </button>
                    </div>
                  )
                }
              />
            ) : view === 'grid' ? (
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))' }}>
                {items.map((node) => (
                  <GridItem
                    key={node.id}
                    node={node}
                    selected={selection.includes(node.id)}
                    renaming={renamingId === node.id}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    commitRename={commitRename}
                    cancelRename={() => setRenamingId(null)}
                    dragOver={dragOverId === node.id}
                    onPointerDown={(event) => toggleSelection(node.id, event)}
                    onDoubleClick={() => openNode(node)}
                    onContextMenu={(event) => itemMenu(event, node)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/x-win12-node', node.id);
                      event.dataTransfer.setData('text/x-win12-nodes', JSON.stringify(selection.includes(node.id) ? selection : [node.id]));
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDrop={(event) => {
                      const ids = readDragIds(event);
                      if (ids.length && node.kind === 'folder' && !inRecycle) {
                        event.preventDefault();
                        move(ids, node.id);
                        setDragOverId(null);
                      }
                    }}
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes('text/x-win12-node') && node.kind === 'folder') {
                        event.preventDefault();
                        setDragOverId(node.id);
                      }
                    }}
                    onDragLeave={() => setDragOverId(null)}
                  />
                ))}
              </div>
            ) : view === 'list' ? (
              <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {items.map((node) => (
                  <RowItem
                    key={node.id}
                    node={node}
                    compact
                    selected={selection.includes(node.id)}
                    renaming={renamingId === node.id}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    commitRename={commitRename}
                    cancelRename={() => setRenamingId(null)}
                    dragOver={dragOverId === node.id}
                    onPointerDown={(event) => toggleSelection(node.id, event)}
                    onDoubleClick={() => openNode(node)}
                    onContextMenu={(event) => itemMenu(event, node)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/x-win12-nodes', JSON.stringify(selection.includes(node.id) ? selection : [node.id]));
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDrop={(event) => {
                      const ids = readDragIds(event);
                      if (ids.length && node.kind === 'folder' && !inRecycle) {
                        event.preventDefault();
                        move(ids, node.id);
                        setDragOverId(null);
                      }
                    }}
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes('text/x-win12-node') || event.dataTransfer.types.includes('text/x-win12-nodes')) {
                        if (node.kind === 'folder') {
                          event.preventDefault();
                          setDragOverId(node.id);
                        }
                      }
                    }}
                    onDragLeave={() => setDragOverId(null)}
                  />
                ))}
              </div>
            ) : (
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 z-10 bg-[var(--surface-2)] text-[11px] uppercase tracking-wide opacity-70">
                  <tr>
                    <SortableHeader label={t('common.name')} active={sortKey === 'name'} dir={sortDir} onClick={() => headerSort('name')} />
                    <SortableHeader label={t('common.dateModified')} active={sortKey === 'updatedAt'} dir={sortDir} onClick={() => headerSort('updatedAt')} />
                    <SortableHeader label={t('common.type')} active={sortKey === 'kind'} dir={sortDir} onClick={() => headerSort('kind')} />
                    <SortableHeader label={t('common.size')} active={sortKey === 'size'} dir={sortDir} onClick={() => headerSort('size')} align="end" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((node) => (
                    <RowItem
                      key={node.id}
                      node={node}
                      asRow
                      selected={selection.includes(node.id)}
                      renaming={renamingId === node.id}
                      renameValue={renameValue}
                      setRenameValue={setRenameValue}
                      commitRename={commitRename}
                      cancelRename={() => setRenamingId(null)}
                      dragOver={dragOverId === node.id}
                      onPointerDown={(event) => toggleSelection(node.id, event)}
                      onDoubleClick={() => openNode(node)}
                      onContextMenu={(event) => itemMenu(event, node)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/x-win12-nodes', JSON.stringify(selection.includes(node.id) ? selection : [node.id]));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDrop={(event) => {
                        const ids = readDragIds(event);
                        if (ids.length && node.kind === 'folder' && !inRecycle) {
                          event.preventDefault();
                          move(ids, node.id);
                          setDragOverId(null);
                        }
                      }}
                      onDragOver={(event) => {
                        if (node.kind === 'folder' && (event.dataTransfer.types.includes('text/x-win12-nodes') || event.dataTransfer.types.includes('Files'))) {
                          event.preventDefault();
                          setDragOverId(node.id);
                        }
                      }}
                      onDragLeave={() => setDragOverId(null)}
                    />
                  ))}
                </tbody>
              </table>
            )
          ) : null}
        </div>
      </div>

      {/* Status bar */}
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px]">
        <span className="opacity-70">{t('explorer.itemCount', { count: items.length })}</span>
        <span className="truncate opacity-70">{resolvePath(nodes, path)}</span>
        {selection.length ? (
          <span className="opacity-90">
            {selection.length} {t('common.selected')} · {formatBytes(selectedSize)}
          </span>
        ) : (
          <span className="flex items-center gap-2 opacity-60">
            <HardDrive size={12} />
            {formatBytes(usedBytes)} / {formatBytes(quotaBytes)}
          </span>
        )}
      </footer>
    </div>
  );

  function headerSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }
}

function pushExplorerWarning(message: string) {
  void import('../../stores/notificationStore').then((module) => {
    module.useNotificationStore.getState().push({ appId: 'explorer', title: message, kind: 'warning' });
  });
}

function readDragIds(event: React.DragEvent): string[] {
  const raw = event.dataTransfer.getData('text/x-win12-nodes');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
      /* ignore malformed payloads */
    }
  }
  const single = event.dataTransfer.getData('text/x-win12-node');
  return single ? [single] : [];
}

function SortableHeader({ label, active, dir, onClick, align = 'start' }: { label: string; active: boolean; dir: SortDirection; onClick: () => void; align?: 'start' | 'end' }) {
  return (
    <th className={`px-2 py-1.5 text-${align} font-semibold`}>
      <button type="button" className="inline-flex items-center gap-1 hover:opacity-100" onClick={onClick}>
        {label}
        {active ? <ChevronsUpDown size={11} className={dir === 'desc' ? 'rotate-180' : ''} /> : null}
      </button>
    </th>
  );
}

function NewMenu({ onPick, disabled, label }: { onPick: (kind: FileKind | 'folder') => void; disabled?: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  const entries: { kind: FileKind | 'folder'; label: string; icon: React.ReactNode }[] = [
    { kind: 'folder', label: 'Folder', icon: <FolderPlus size={14} /> },
    { kind: 'doc', label: 'Word Document', icon: <AppIcon appId="word" size={14} /> },
    { kind: 'sheet', label: 'Excel Workbook', icon: <AppIcon appId="excel" size={14} /> },
    { kind: 'slides', label: 'PowerPoint Presentation', icon: <AppIcon appId="powerpoint" size={14} /> },
    { kind: 'text', label: 'Text Document', icon: <FileText size={14} /> },
    { kind: 'note', label: 'Note', icon: <AppIcon appId="notes" size={14} /> },
  ];
  return (
    <div className="relative" ref={ref}>
      <ToolButton icon={<Plus size={15} />} label={label} disabled={disabled} active={open} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div className="panel absolute start-0 top-full z-40 mt-1 w-56 p-1">
          {entries.map((entry) => (
            <button
              key={entry.kind}
              type="button"
              className="list-row w-full"
              onClick={() => {
                setOpen(false);
                onPick(entry.kind);
              }}
            >
              {entry.icon}
              <span className="truncate">{entry.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SortMenu({ sortKey, sortDir, onKey, onDir }: { sortKey: SortKey; sortDir: SortDirection; onKey: (key: SortKey) => void; onDir: (dir: SortDirection) => void }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  const entries: { key: SortKey; label: string }[] = [
    { key: 'name', label: t('common.name') },
    { key: 'updatedAt', label: t('common.dateModified') },
    { key: 'createdAt', label: t('common.dateCreated') },
    { key: 'kind', label: t('common.type') },
    { key: 'size', label: t('common.size') },
  ];
  return (
    <div className="relative">
      <ToolButton icon={<ArrowUpDown size={15} />} label={t('desktop.sortBy')} active={open} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div className="panel absolute start-0 top-full z-40 mt-1 w-52 p-1">
          {entries.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className="list-row w-full justify-between"
              onClick={() => {
                onKey(entry.key);
                setOpen(false);
              }}
            >
              <span>{entry.label}</span>
              {sortKey === entry.key ? <span className="text-[10px] opacity-60">{sortDir === 'asc' ? '↑' : '↓'}</span> : null}
            </button>
          ))}
          <div className="my-1 h-px bg-[var(--border)]" />
          <button type="button" className="list-row w-full" onClick={() => onDir('asc')}>
            {t('explorer.sortAsc')}
          </button>
          <button type="button" className="list-row w-full" onClick={() => onDir('desc')}>
            {t('explorer.sortDesc')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ViewMenu({ view, onChange }: { view: ExplorerView; onChange: (view: ExplorerView) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="relative">
      <ToolButton
        icon={view === 'grid' ? <Grid3x3 size={15} /> : view === 'list' ? <LayoutList size={15} /> : <Eye size={15} />}
        label={t('desktop.view')}
        active={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <div className="panel absolute start-0 top-full z-40 mt-1 w-44 p-1">
          {(['details', 'list', 'grid'] as ExplorerView[]).map((option) => (
            <button
              key={option}
              type="button"
              className="list-row w-full justify-between"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span>{option === 'details' ? t('explorer.viewDetails') : option === 'list' ? t('explorer.viewList') : t('explorer.viewGrid')}</span>
              {view === option ? <span className="text-[var(--accent)]">●</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterMenu({ value, onChange }: { value: FileKind | 'all'; onChange: (value: FileKind | 'all') => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="relative">
      <ToolButton icon={<Paperclip size={15} />} label={t('explorer.filterType')} active={open || value !== 'all'} onClick={() => setOpen((v) => !v)} />
      {open ? (
        <div className="panel absolute start-0 top-full z-40 mt-1 w-44 p-1">
          {KIND_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="list-row w-full justify-between"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {value === option.value ? <span className="text-[var(--accent)]">●</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ThisPcView({ onOpenFolder, usedBytes, quotaBytes }: { onOpenFolder: (id: string | null) => void; usedBytes: number; quotaBytes: number }) {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const folders = SIDEBAR.filter((entry) => entry.folderId && entry.folderId !== ROOT_ID && entry.folderId !== RECYCLE_BIN_ID);
  const percent = Math.round((usedBytes / quotaBytes) * 100);

  return (
    <div className="space-y-5 p-2">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('explorer.folders')}</h3>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {folders.map((entry) => {
            const id = entry.folderId as string;
            const node = nodes[id];
            if (!node) return null;
            const stats = countDescendants(nodes, id);
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                className="card flex items-center gap-3 p-3 text-start transition hover:border-[var(--accent)]"
                onClick={() => onOpenFolder(id)}
                onDoubleClick={() => onOpenFolder(id)}
              >
                <Icon size={26} className="shrink-0 opacity-80" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-medium">{t(entry.labelKey)}</span>
                  <span className="block text-[10.5px] opacity-55">
                    {stats.files} files · {stats.folders} folders
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('explorer.devicesAndDrives')}</h3>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          <button type="button" className="card p-3 text-start transition hover:border-[var(--accent)]" onClick={() => onOpenFolder(ROOT_ID)}>
            <div className="mb-2 flex items-center gap-3">
              <HardDrive size={26} className="opacity-80" />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">{t('explorer.localDisk')}</span>
                <span className="block text-[10.5px] opacity-55">
                  {t('explorer.freeOf', { free: formatBytes(Math.max(0, quotaBytes - usedBytes)), total: formatBytes(quotaBytes) })}
                </span>
              </span>
            </div>
            <ProgressBar value={usedBytes} max={quotaBytes} color={percent > 85 ? '#ef4444' : undefined} />
            <p className="mt-1 text-[10.5px] opacity-55">{percent}% {t('settings.storageUsed')}</p>
          </button>
          <div className="card p-3 opacity-80">
            <div className="flex items-center gap-3">
              <Cloud size={26} className="opacity-80" />
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">{t('explorer.oneDrive')}</span>
                <span className="block text-[10.5px] opacity-55">{t('common.simulated')}</span>
              </span>
            </div>
            <p className="mt-2 text-[10.5px] leading-snug opacity-55">No cloud service is contacted by this simulator.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

interface ItemProps {
  node: FSNode;
  selected: boolean;
  renaming: boolean;
  renameValue: string;
  setRenameValue: (value: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
  dragOver: boolean;
  compact?: boolean;
  asRow?: boolean;
  onPointerDown: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onDragStart: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
}

function GridItem(props: ItemProps) {
  const { node, selected, renaming, renameValue, setRenameValue, commitRename, cancelRename, dragOver } = props;
  return (
    <div
      className={`flex cursor-default flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition ${
        selected ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-transparent hover:bg-[var(--hover)]'
      } ${dragOver ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : ''}`}
      draggable={!renaming}
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onDoubleClick}
      onContextMenu={props.onContextMenu}
      onDragStart={props.onDragStart}
      onDrop={props.onDrop}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      role="button"
      tabIndex={0}
      aria-label={node.name}
    >
      <NodeThumb node={node} size={44} />
      {renaming ? (
        <RenameInput value={renameValue} onChange={setRenameValue} onCommit={commitRename} onCancel={cancelRename} />
      ) : (
        <span className="line-clamp-2 w-full break-words text-[11.5px] leading-tight" dir="auto">
          {node.name}
        </span>
      )}
    </div>
  );
}

function RowItem(props: ItemProps) {
  const { node, selected, renaming, renameValue, setRenameValue, commitRename, cancelRename, dragOver, compact, asRow } = props;
  const nodes = useFileSystemStore((state) => state.nodes);
  const size = nodeSize(nodes, node);

  if (asRow) {
    return (
      <tr
        className={`cursor-default border-b border-[var(--border)] transition ${selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--hover)]'} ${
          dragOver ? 'bg-[var(--accent-soft)]' : ''
        }`}
        draggable={!renaming}
        onPointerDown={props.onPointerDown}
        onDoubleClick={props.onDoubleClick}
        onContextMenu={props.onContextMenu}
        onDragStart={props.onDragStart}
        onDrop={props.onDrop}
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
      >
        <td className="px-2 py-1.5">
          <span className="flex items-center gap-2">
            <NodeThumb node={node} size={18} />
            {renaming ? (
              <RenameInput value={renameValue} onChange={setRenameValue} onCommit={commitRename} onCancel={cancelRename} />
            ) : (
              <span className="truncate" dir="auto">{node.name}</span>
            )}
            {node.metadata.pinned ? <Badge tone="accent">pinned</Badge> : null}
          </span>
        </td>
        <td className="whitespace-nowrap px-2 py-1.5 opacity-70">{formatDate(node.updatedAt)}</td>
        <td className="whitespace-nowrap px-2 py-1.5 opacity-70">{KIND_LABELS[node.kind]}</td>
        <td className="whitespace-nowrap px-2 py-1.5 text-end tabular-nums opacity-70">{node.kind === 'folder' ? '' : formatBytes(size)}</td>
      </tr>
    );
  }

  return (
    <div
      className={`flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 transition ${
        selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--hover)]'
      } ${dragOver ? 'bg-[var(--accent-soft)]' : ''}`}
      draggable={!renaming}
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onDoubleClick}
      onContextMenu={props.onContextMenu}
      onDragStart={props.onDragStart}
      onDrop={props.onDrop}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      role="button"
      tabIndex={0}
      aria-label={node.name}
    >
      <NodeThumb node={node} size={compact ? 20 : 24} />
      {renaming ? (
        <RenameInput value={renameValue} onChange={setRenameValue} onCommit={commitRename} onCancel={cancelRename} />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[12.5px]" dir="auto">{node.name}</span>
      )}
      <span className="shrink-0 text-[10.5px] opacity-50">{node.kind === 'folder' ? KIND_LABELS.folder : formatBytes(size)}</span>
    </div>
  );
}

function RenameInput({ value, onChange, onCommit, onCancel }: { value: string; onChange: (value: string) => void; onCommit: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const dot = value.lastIndexOf('.');
    ref.current?.setSelectionRange(0, dot > 0 ? dot : value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') onCommit();
        if (event.key === 'Escape') onCancel();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className="w-full rounded border border-[var(--accent)] bg-[var(--surface-solid)] px-1 text-[11.5px] outline-none"
      dir="auto"
    />
  );
}

function NodeThumb({ node, size }: { node: FSNode; size: number }) {
  if (node.kind === 'image' && typeof node.metadata.dataUrl === 'string') {
    return <img src={node.metadata.dataUrl} alt="" className="rounded object-cover ring-1 ring-black/10" style={{ width: size, height: size }} draggable={false} />;
  }
  if (node.id === RECYCLE_BIN_ID) return <RecycleBinIcon size={size} />;
  if (node.id === ROOT_ID) return <ThisPcIcon size={size} />;
  if (node.kind === 'shortcut' && node.metadata.appId) return <AppIcon appId={String(node.metadata.appId)} size={size} />;
  return <KindIcon kind={node.kind} size={size} />;
}

export default FileExplorerApp;
