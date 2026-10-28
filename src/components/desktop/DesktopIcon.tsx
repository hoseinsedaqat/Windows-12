import { useEffect, useRef, useState } from 'react';
import type { FSNode } from '../../types';
import { AppIcon, KindIcon, RecycleBinIcon, ThisPcIcon, FolderIcon } from '../icons/AppIcons';
import { RECYCLE_BIN_ID, ROOT_ID } from '../../core/FileSystem';
import { useFileSystemStore } from '../../stores/fileSystemStore';

export interface IconMetrics {
  cellW: number;
  cellH: number;
  icon: number;
  font: number;
}

interface Props {
  node: FSNode;
  position: { x: number; y: number };
  metrics: IconMetrics;
  selected: boolean;
  dragOffset: { x: number; y: number } | null;
  renaming: boolean;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function DesktopIcon({
  node,
  position,
  metrics,
  selected,
  dragOffset,
  renaming,
  onRenameCommit,
  onRenameCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: Props) {
  const [name, setName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const trashEmpty = useFileSystemStore((state) =>
    node.id === RECYCLE_BIN_ID ? !Object.values(state.nodes).some((item) => item.deleted) : true,
  );

  useEffect(() => {
    setName(node.name);
  }, [node.name]);

  useEffect(() => {
    if (renaming) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
        const dot = name.lastIndexOf('.');
        inputRef.current?.setSelectionRange(0, dot > 0 ? dot : name.length);
      }, 20);
      return () => window.clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renaming]);

  const x = position.x + (dragOffset?.x ?? 0);
  const y = position.y + (dragOffset?.y ?? 0);

  return (
    <div
      className={`desktop-icon absolute ${selected ? 'selected' : ''}`}
      style={{ left: x, top: y, width: metrics.cellW, height: metrics.cellH, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) => event.stopPropagation()}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={-1}
      aria-label={node.name}
      data-node-id={node.id}
    >
      <span className="inline-block" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
        <IconGraphic node={node} size={metrics.icon} trashEmpty={trashEmpty} />
      </span>
      {renaming ? (
        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => onRenameCommit(name)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') onRenameCommit(name);
            if (event.key === 'Escape') onRenameCancel();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          className="w-full rounded border border-white/70 bg-black/60 px-1 text-center text-white outline-none"
          style={{ fontSize: metrics.font }}
        />
      ) : (
        <span
          className="mx-auto block max-w-full overflow-hidden px-0.5 text-center leading-tight"
          style={{
            fontSize: metrics.font,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflowWrap: 'break-word',
            textShadow: '0 1px 3px rgba(0,0,0,0.65)',
          }}
        >
          {node.name}
        </span>
      )}
    </div>
  );
}

function IconGraphic({ node, size, trashEmpty }: { node: FSNode; size: number; trashEmpty: boolean }) {
  if (node.id === RECYCLE_BIN_ID || node.metadata.targetId === RECYCLE_BIN_ID) {
    return <RecycleBinIcon size={size} full={!trashEmpty} />;
  }
  if (node.id === ROOT_ID || node.metadata.targetId === ROOT_ID) {
    return <ThisPcIcon size={size} />;
  }
  if (node.kind === 'shortcut') {
    const appId = node.metadata.appId as string | undefined;
    const targetId = node.metadata.targetId as string | undefined;
    if (appId) {
      return (
        <span className="relative inline-block">
          <AppIcon appId={appId} size={size} />
          {/* Classic Windows shortcut arrow overlay */}
          <span className="absolute -bottom-0.5 -left-0.5 rounded-[3px] bg-white shadow ring-1 ring-black/20">
            <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 16 16" aria-hidden>
              <path d="M3.5 12.5 10 6M10 6H6.5M10 6v3.5" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      );
    }
    if (targetId) return <FolderIcon size={size} />;
    return <KindIcon kind="shortcut" size={size} />;
  }
  if (node.kind === 'image' && typeof node.metadata.dataUrl === 'string') {
    return (
      <img
        src={node.metadata.dataUrl}
        alt=""
        className="rounded-md object-cover shadow-icon ring-1 ring-black/25"
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }
  return <KindIcon kind={node.kind} size={size} />;
}

export default DesktopIcon;
