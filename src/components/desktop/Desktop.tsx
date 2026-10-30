import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FSNode } from '../../types';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShellStore } from '../../stores/shellStore';
import { DESKTOP_ID, sortNodes, getChildren } from '../../core/FileSystem';
import { getWallpaper } from '../../data/wallpapers';
import { DesktopIcon, type IconMetrics } from './DesktopIcon';
import { openNode } from '../../services/launcher';
import { useT } from '../../i18n';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';

const METRICS: Record<'small' | 'medium' | 'large', IconMetrics> = {
  small: { cellW: 78, cellH: 86, icon: 30, font: 11 },
  medium: { cellW: 94, cellH: 102, icon: 38, font: 12 },
  large: { cellW: 116, cellH: 126, icon: 54, font: 13 },
};

interface Position {
  x: number;
  y: number;
}

/** Column-major auto layout, the way the real desktop arranges icons. */
function autoLayout(count: number, metrics: IconMetrics, areaHeight: number, offset = 12): Position[] {
  const perColumn = Math.max(1, Math.floor((areaHeight - offset * 2) / metrics.cellH));
  return Array.from({ length: count }, (_, index) => {
    const column = Math.floor(index / perColumn);
    const row = index % perColumn;
    return { x: offset + column * metrics.cellW, y: offset + row * metrics.cellH };
  });
}

export function Desktop() {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const setIconPosition = useFileSystemStore((state) => state.setIconPosition);
  const createFolder = useFileSystemStore((state) => state.createFolder);
  const createFile = useFileSystemStore((state) => state.createFile);
  const softDelete = useFileSystemStore((state) => state.softDelete);
  const rename = useFileSystemStore((state) => state.rename);
  const setClipboard = useFileSystemStore((state) => state.setClipboard);

  const personalization = useSettingsStore((state) => state.settings.personalization);
  const selection = useShellStore((state) => state.desktopSelection);
  const setSelection = useShellStore((state) => state.setDesktopSelection);
  const openContextMenu = useShellStore((state) => state.openContextMenu);
  const openDialog = useShellStore((state) => state.openDialog);
  const setProperties = useShellStore((state) => state.setProperties);
  const openPanel = useShellStore((state) => state.setPanel);
  const setDialog = useShellStore((state) => state.openDialog);

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<Position | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const dragRef = useRef<{ ids: string[]; startX: number; startY: number; origins: Record<string, Position>; moved: boolean; captured: boolean; element: HTMLElement | null; wasSelected: boolean } | null>(null);
  /** Manual double-click tracking: pointer capture quirks make the native
   *  `dblclick` event unreliable across browsers, so two quick clean clicks
   *  (no movement in between) open the icon ourselves. */
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);

  const wallpaper = useMemo(() => getWallpaper(personalization.wallpaperId), [personalization.wallpaperId]);
  const metrics = METRICS[personalization.desktopIconSize];

  useEffect(() => {
    const measure = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight - TASKBAR_HEIGHT });
    };
    measure();
    window.addEventListener('resize', measure);
    const custom = () => measure();
    window.addEventListener('win12:resize', custom);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('win12:resize', custom);
    };
  }, [personalization.taskbarPosition]);

  const [dropHint, setDropHint] = useState(false);

  const icons = useMemo(() => {
    const children = getChildren(nodes, DESKTOP_ID);
    const sorted = sortNodes(children, { key: 'name', direction: 'asc', foldersFirst: false });
    const auto = autoLayout(sorted.length, metrics, size.height);
    const placed: { x: number; y: number }[] = [];
    const collides = (p: Position) =>
      placed.some(
        (q) => Math.abs(p.x - q.x) < metrics.cellW - 6 && Math.abs(p.y - q.y) < metrics.cellH - 6,
      );
    return sorted.map((node, index) => {
      let position: Position;
      if (personalization.desktopIconLayout === 'free' && typeof node.metadata.iconX === 'number' && typeof node.metadata.iconY === 'number') {
        position = { x: node.metadata.iconX, y: node.metadata.iconY };
      } else {
        position = auto[index];
      }
      // Clamp inside the work area and resolve overlaps (e.g. nodes added by
      // migrations on top of user-placed icons) by falling back to the first
      // free auto slot.
      position = {
        x: Math.max(4, Math.min(position.x, Math.max(4, size.width - metrics.cellW))),
        y: Math.max(4, Math.min(position.y, Math.max(4, size.height - metrics.cellH))),
      };
      if (collides(position)) {
        const fallback = auto.find((slot) => !collides(slot));
        position = fallback ?? position;
      }
      placed.push(position);
      return { node, position };
    });
  }, [nodes, metrics, size.height, size.width, personalization.desktopIconLayout]);


  /* ---------------- icon dragging ---------------- */
  const beginIconDrag = useCallback(
    (event: React.PointerEvent, node: FSNode) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      event.stopPropagation();
      const additive = event.ctrlKey || event.metaKey;
      let ids = selection;
      const wasSelected = selection.includes(node.id);
      if (!wasSelected) {
        ids = additive ? [...selection, node.id] : [node.id];
        setSelection(ids);
      }
      const origins: Record<string, Position> = {};
      icons.forEach(({ node: item, position }) => {
        if (ids.includes(item.id)) origins[item.id] = position;
      });
      // NOTE: no pointer capture here — capturing on pointer-down swallows
      // click/dblclick in some browsers. We capture only once a real drag
      // starts (see onIconPointerMove).
      dragRef.current = { ids, startX: event.clientX, startY: event.clientY, origins, moved: false, captured: false, element: null, wasSelected };
    },
    [icons, selection, setSelection],
  );

  const onIconPointerMove = useCallback((event: React.PointerEvent) => {
    const state = dragRef.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 4) return;
    if (!state.captured) {
      state.element = event.currentTarget as HTMLElement;
      try {
        state.element.setPointerCapture?.(event.pointerId);
      } catch {
        state.element = null;
      }
      state.captured = true;
    }
    state.moved = true;
    setDragOffset({ x: dx, y: dy });
  }, []);

  const onIconPointerUp = useCallback(
    (event: React.PointerEvent, node: FSNode) => {
      const state = dragRef.current;
      if (state?.captured && state.element) {
        try {
          state.element.releasePointerCapture?.(event.pointerId);
        } catch {
          /* already released */
        }
      }
      dragRef.current = null;
      if (!state) return;
      const drift = dragOffset ? Math.hypot(dragOffset.x, dragOffset.y) : 0;
      if (state.moved && dragOffset && drift >= 7) {
        state.ids.forEach((id) => {
          const origin = state.origins[id];
          if (!origin) return;
          const x = Math.max(4, Math.min(size.width - metrics.cellW + 8, origin.x + dragOffset.x));
          const y = Math.max(4, Math.min(size.height - metrics.cellH + 8, origin.y + dragOffset.y));
          setIconPosition(id, Math.round(x), Math.round(y));
        });
        if (personalization.desktopIconLayout === 'auto') {
          useSettingsStore.getState().setPersonalization({ desktopIconLayout: 'free' });
        }
        lastClickRef.current = null;
        setDragOffset(null);
        return;
      }
      setDragOffset(null);
      // Clean click (no real movement). Windows-style: the first click
      // selects, and clicking an already-selected icon opens it — so a
      // double-click always opens, even with a slow or slightly shaky hand.
      const now = Date.now();
      const last = lastClickRef.current;
      if (state.wasSelected) {
        lastClickRef.current = null;
        openNode(node);
        return;
      }
      if (last && last.id === node.id && now - last.at < 500) {
        lastClickRef.current = null;
        openNode(node);
      } else {
        lastClickRef.current = { id: node.id, at: now };
      }
    },
    [dragOffset, metrics.cellH, metrics.cellW, personalization.desktopIconLayout, setIconPosition, size.height, size.width],
  );

  /* ---------------- marquee selection ---------------- */
  const marqueeRef = useRef<{ startX: number; startY: number } | null>(null);

  const onBackgroundPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (!event.ctrlKey && !event.metaKey) setSelection([]);
    marqueeRef.current = { startX: event.clientX - rect.left, startY: event.clientY - rect.top };
    setMarquee({ x: event.clientX - rect.left, y: event.clientY - rect.top, w: 0, h: 0 });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const onBackgroundPointerMove = (event: React.PointerEvent) => {
    const start = marqueeRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!start || !rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const box = {
      x: Math.min(start.startX, x),
      y: Math.min(start.startY, y),
      w: Math.abs(x - start.startX),
      h: Math.abs(y - start.startY),
    };
    setMarquee(box);
    const hits = icons
      .filter(({ position }) => {
        const iconBox = { x: position.x, y: position.y, w: metrics.cellW, h: metrics.cellH };
        return !(iconBox.x > box.x + box.w || iconBox.x + iconBox.w < box.x || iconBox.y > box.y + box.h || iconBox.y + iconBox.h < box.y);
      })
      .map(({ node }) => node.id);
    setSelection(hits);
  };

  const onBackgroundPointerUp = (event: React.PointerEvent) => {
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    marqueeRef.current = null;
    setMarquee(null);
  };

  /* ---------------- context menus ---------------- */
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
            { id: 'view-large', label: t('desktop.iconSizeLarge'), checked: personalization.desktopIconSize === 'large', action: () => useSettingsStore.getState().setPersonalization({ desktopIconSize: 'large' }) },
            { id: 'view-medium', label: t('desktop.iconSizeMedium'), checked: personalization.desktopIconSize === 'medium', action: () => useSettingsStore.getState().setPersonalization({ desktopIconSize: 'medium' }) },
            { id: 'view-small', label: t('desktop.iconSizeSmall'), checked: personalization.desktopIconSize === 'small', action: () => useSettingsStore.getState().setPersonalization({ desktopIconSize: 'small' }) },
            { id: 'view-sep', label: '', separator: true },
            { id: 'view-auto', label: t('desktop.autoArrange'), checked: personalization.desktopIconLayout === 'auto', action: () => useSettingsStore.getState().setPersonalization({ desktopIconLayout: 'auto' }) },
            { id: 'view-visible', label: t('desktop.showDesktopIcons'), checked: personalization.desktopIconsVisible, action: () => useSettingsStore.getState().setPersonalization({ desktopIconsVisible: !personalization.desktopIconsVisible }) },
          ],
        },
        {
          id: 'sort',
          label: t('desktop.sortBy'),
          icon: 'ArrowUpDown',
          submenu: [
            { id: 'sort-name', label: t('common.name'), action: () => arrangeBy('name') },
            { id: 'sort-modified', label: t('common.dateModified'), action: () => arrangeBy('updatedAt') },
            { id: 'sort-type', label: t('common.type'), action: () => arrangeBy('kind') },
            { id: 'sort-size', label: t('common.size'), action: () => arrangeBy('size') },
          ],
        },
        { id: 'refresh', label: t('common.refresh'), icon: 'RefreshCw', action: () => useFileSystemStore.getState().mutate((current) => ({ ...current })) },
        { id: 'sep-1', label: '', separator: true },
        {
          id: 'new',
          label: t('common.new'),
          icon: 'Plus',
          submenu: [
            { id: 'new-folder', label: t('desktop.newFolder'), action: () => { const id = createFolder(DESKTOP_ID); setSelection([id]); setRenamingId(id); } },
            { id: 'new-sep', label: '', separator: true },
            { id: 'new-doc', label: t('explorer.wordDoc'), action: () => createFile('doc', DESKTOP_ID) },
            { id: 'new-sheet', label: t('explorer.excelWorkbook'), action: () => createFile('sheet', DESKTOP_ID) },
            { id: 'new-slides', label: t('explorer.pptPresentation'), action: () => createFile('slides', DESKTOP_ID) },
            { id: 'new-text', label: t('explorer.textDoc'), action: () => createFile('text', DESKTOP_ID) },
            { id: 'new-note', label: t('explorer.note'), action: () => createFile('note', DESKTOP_ID) },
            { id: 'new-sep2', label: '', separator: true },
            { id: 'new-shortcut', label: t('desktop.newShortcut'), action: () => openShortcutWizard() },
          ],
        },
        { id: 'sep-2', label: '', separator: true },
        { id: 'display', label: t('desktop.displaySettings'), icon: 'Monitor', action: () => { openPanel(null); import('../../services/launcher').then((m) => m.launchApp('settings', { section: 'display' })); } },
        { id: 'personalize', label: t('desktop.personalize'), icon: 'Palette', action: () => { openPanel(null); import('../../services/launcher').then((m) => m.launchApp('settings', { section: 'personalization' })); } },
      ],
    });
  };

  const arrangeBy = (key: 'name' | 'updatedAt' | 'kind' | 'size') => {
    const children = getChildren(nodes, DESKTOP_ID);
    const sorted = sortNodes(children, { key, direction: 'asc', foldersFirst: true });
    const auto = autoLayout(sorted.length, metrics, size.height);
    sorted.forEach((node, index) => setIconPosition(node.id, auto[index].x, auto[index].y));
    useSettingsStore.getState().setPersonalization({ desktopIconLayout: 'free' });
  };

  const openShortcutWizard = () => {
    setDialog({
      kind: 'prompt',
      title: t('desktop.newShortcut'),
      message: 'App id or name (chrome, excel, accounting, settings…)',
      defaultValue: 'chrome',
      confirmLabel: t('common.create'),
      onConfirm: (value) => {
        const id = createFile('shortcut', DESKTOP_ID, value.trim() || 'Shortcut');
        useFileSystemStore.getState().updateMetadata(id, { appId: value.trim().toLowerCase() });
      },
    });
  };

  const iconMenu = (event: React.MouseEvent, node: FSNode) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selection.includes(node.id)) setSelection([node.id]);
    const items = [
      { id: 'open', label: t('common.open'), icon: 'FolderOpen', action: () => openNode(node) },
    ];
    if (node.kind !== 'folder' && node.kind !== 'shortcut') {
      items.push({
        id: 'open-with',
        label: t('common.openWith'),
        icon: 'AppWindow',
        action: () => import('../../services/launcher').then((m) => m.openWith(node, defaultAppFor(node))),
      });
    }
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: node.name,
      items: [
        ...items,
        { id: 'sep-a', label: '', separator: true },
        { id: 'cut', label: t('common.cut'), icon: 'Scissors', shortcut: 'Ctrl+X', action: () => setClipboard({ mode: 'cut', ids: selection.length ? selection : [node.id] }) },
        { id: 'copy', label: t('common.copy'), icon: 'Copy', shortcut: 'Ctrl+C', action: () => setClipboard({ mode: 'copy', ids: selection.length ? selection : [node.id] }) },
        { id: 'sep-b', label: '', separator: true },
        {
          id: 'rename',
          label: t('common.rename'),
          icon: 'Pencil',
          shortcut: 'F2',
          disabled: Boolean(node.system),
          action: () => setRenamingId(node.id),
        },
        {
          id: 'delete',
          label: t('common.delete'),
          icon: 'Trash2',
          shortcut: 'Del',
          danger: true,
          disabled: Boolean(node.system && node.parentId === 'root'),
          action: () => {
            const ids = selection.length ? selection : [node.id];
            openDialog({
              kind: 'confirm',
              title: t('common.confirmTitle'),
              message: ids.length === 1 ? t('explorer.deleteConfirm', { name: node.name }) : `${ids.length} items → Recycle Bin`,
              danger: true,
              onConfirm: () => softDelete(ids),
            });
          },
        },
        { id: 'sep-c', label: '', separator: true },
        { id: 'properties', label: t('common.properties'), icon: 'Info', action: () => setProperties(node.id) },
      ],
    });
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'Escape') setSelection([]);
      if (event.key === 'F2' && selection.length === 1) {
        event.preventDefault();
        setRenamingId(selection[0]);
      }
      if (event.key === 'Delete' && selection.length) {
        event.preventDefault();
        softDelete(selection);
      }
      if (event.key === 'Enter' && selection.length === 1) {
        event.preventDefault();
        openNode(nodes[selection[0]]);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(icons.map(({ node }) => node.id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [icons, nodes, selection, setSelection, softDelete]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-x-0 top-0 overflow-hidden"
      style={{ height: size.height, cursor: 'default' }}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onBackgroundPointerMove}
      onPointerUp={onBackgroundPointerUp}
      onPointerCancel={onBackgroundPointerUp}
      onContextMenu={backgroundMenu}
      onDoubleClick={() => setSelection([])}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
          setDropHint(true);
        }
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDropHint(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        setDropHint(false);
        void useFileSystemStore.getState().importFiles(Array.from(event.dataTransfer.files), DESKTOP_ID);
      }}
      data-testid="desktop-surface"
    >
      {dropHint ? (
        <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/60 backdrop-blur-sm">
          <p className="rounded-full bg-[var(--surface-solid)] px-4 py-2 text-[13px] font-semibold shadow-lg">
            {t('desktop.dropHint')}
          </p>
        </div>
      ) : null}
      <img src={wallpaper.url} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="pointer-events-none absolute inset-0 bg-black/5" />

      {personalization.desktopIconsVisible ? (
        <div className="absolute inset-0" style={{ touchAction: 'none' }}>
          {icons.map(({ node, position }) => (
            <DesktopIcon
              key={node.id}
              node={node}
              position={position}
              metrics={metrics}
              selected={selection.includes(node.id)}
              dragOffset={selection.includes(node.id) ? dragOffset : null}
              renaming={renamingId === node.id}
              onRenameCommit={(name) => {
                setRenamingId(null);
                if (name.trim()) rename(node.id, name);
              }}
              onRenameCancel={() => setRenamingId(null)}
              onPointerDown={(event) => beginIconDrag(event, node)}
              onPointerMove={onIconPointerMove}
              onPointerUp={(event) => onIconPointerUp(event, node)}
              onContextMenu={(event) => iconMenu(event, node)}
            />
          ))}
        </div>
      ) : null}

      {marquee && marquee.w > 2 ? (
        <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
      ) : null}
    </div>
  );
}

function defaultAppFor(node: FSNode): string {
  switch (node.kind) {
    case 'doc':
      return 'word';
    case 'sheet':
      return 'excel';
    case 'slides':
      return 'powerpoint';
    case 'note':
      return 'notes';
    case 'image':
      return 'photos';
    default:
      return 'notepad';
  }
}

export default Desktop;
