import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  AppWindow,
  Copy,
  Eye,
  FolderOpen,
  Grid2x2,
  Info,
  LayoutGrid,
  Monitor,
  Palette,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Scissors,
  Settings,
  Square,
  Trash2,
  X,
  Minus,
  AlignCenter,
  Activity,
  FolderPlus,
  Upload,
  Download,
  FileText,
  HardDrive,
  RotateCcw,
  Star,
  Clipboard,
} from 'lucide-react';
import type { ContextMenuItem } from '../../types';
import { useShellStore } from '../../stores/shellStore';

const ICONS: Record<string, typeof Copy> = {
  ArrowUpDown,
  AppWindow,
  Copy,
  Eye,
  FolderOpen,
  Grid2x2,
  Info,
  LayoutGrid,
  Monitor,
  Palette,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Scissors,
  Settings,
  Square,
  Trash2,
  X,
  Minus,
  AlignCenter,
  Activity,
  FolderPlus,
  Upload,
  Download,
  FileText,
  HardDrive,
  RotateCcw,
  Star,
  Clipboard,
};

/** Global context-menu renderer driven by the shell store. */
export function ContextMenuHost() {
  const menu = useShellStore((state) => state.contextMenu);
  const close = useShellStore((state) => state.closeContextMenu);

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    const onPointerDown = () => close();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', close);
    };
  }, [menu, close]);

  if (!menu) return null;
  return (
    <MenuSurface
      items={menu.items}
      title={menu.title}
      x={menu.x}
      y={menu.y}
      onAction={(item) => {
        close();
        item.action?.();
      }}
      onClose={close}
    />
  );
}

interface SurfaceProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  title?: string;
  depth?: number;
  onAction: (item: ContextMenuItem) => void;
  onClose: () => void;
}

function MenuSurface({ items, x, y, title, depth = 0, onAction, onClose }: SurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const next = { x, y };
    if (x + rect.width > window.innerWidth - 8) next.x = Math.max(8, window.innerWidth - rect.width - 8);
    if (y + rect.height > window.innerHeight - 8) next.y = Math.max(8, window.innerHeight - rect.height - 8);
    if (next.x !== pos.x || next.y !== pos.y) setPos(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, items]);

  const visible = items.filter((item) => !item.separator || true);

  return (
    <div
      ref={ref}
      className="panel animate-scale-in fixed z-[9500] min-w-[210px] max-w-[300px] overflow-visible p-1.5"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
    >
      {title ? (
        <p className="mb-1 truncate border-b border-[var(--border)] px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-55" dir="auto">
          {title}
        </p>
      ) : null}
      {visible.map((item) => {
        if (item.separator) return <div key={item.id} className="my-1 h-px bg-[var(--border)]" role="separator" />;
        const Icon = item.icon ? ICONS[item.icon] : null;
        const hasSubmenu = Boolean(item.submenu?.length);
        return (
          <div
            key={item.id}
            className="relative"
            onMouseEnter={() => setOpenSubmenu(hasSubmenu ? item.id : null)}
          >
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                if (hasSubmenu) {
                  setOpenSubmenu(item.id);
                  return;
                }
                onAction(item);
              }}
              className={`list-row w-full justify-between gap-3 ${item.danger ? 'text-red-500 hover:bg-red-500/12' : ''} ${
                item.disabled ? 'cursor-not-allowed opacity-40' : ''
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {Icon ? <Icon size={15} className="shrink-0 opacity-80" /> : <span className="w-[15px] shrink-0" />}
                <span className="truncate" dir="auto">{item.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[10.5px] opacity-55">
                {item.checked === undefined ? null : (
                  <span className={`h-2 w-2 rounded-full ${item.checked ? 'bg-[var(--accent)]' : 'border border-[var(--border-strong)]'}`} />
                )}
                {item.shortcut ? <span className="hidden sm:inline">{item.shortcut}</span> : null}
                {hasSubmenu ? <span aria-hidden>›</span> : null}
              </span>
            </button>
            {hasSubmenu && openSubmenu === item.id ? (
              <div className="absolute top-0 z-[9600]" style={{ insetInlineStart: '100%' }}>
                <MenuSurface
                  items={item.submenu ?? []}
                  x={pos.x + 210}
                  y={pos.y}
                  depth={depth + 1}
                  onAction={onAction}
                  onClose={onClose}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default ContextMenuHost;
