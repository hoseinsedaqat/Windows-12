import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw, Info, Trash2, Download, Image as ImageIcon, Play, Pause, Maximize2, Search } from 'lucide-react';
import { useT } from '../../i18n';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShellStore } from '../../stores/shellStore';
import { formatBytes, formatDate, formatTime } from '../../services/format';
import { downloadDataUrl } from '../../services/files';
import { notify } from '../../stores/notificationStore';
import { registerCustomWallpaper } from '../../data/wallpapers';
import { EmptyState, Badge } from '../../components/ui/Controls';
import type { FSNode } from '../../types';

interface PhotoItemView {
  id: string;
  title: string;
  src: string;
  album: string;
  createdAt: number;
  updatedAt: number;
  size: number;
  node?: FSNode;
  mime?: string;
}

export function PhotosApp() {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const softDelete = useFileSystemStore((state) => state.softDelete);
  const exportNode = useFileSystemStore((state) => state.exportNode);
  const openDialog = useShellStore((state) => state.openDialog);
  const setWallpaper = useSettingsStore((state) => state.setWallpaper);
  const setLockWallpaper = useSettingsStore((state) => state.setLockWallpaper);

  const [query, setQuery] = useState('');
  const [album, setAlbum] = useState<string | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [infoOpen, setInfoOpen] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const photos = useMemo<PhotoItemView[]>(() => {
    const list: PhotoItemView[] = [];
    for (const node of Object.values(nodes)) {
      if (node.kind !== 'image' || node.deleted) continue;
      const src = typeof node.content === 'string' ? node.content : (node.metadata?.dataUrl as string | undefined);
      if (!src) continue;
      const parent = node.parentId ? nodes[node.parentId] : undefined;
      list.push({
        id: node.id,
        title: node.name.replace(/\.(svg|png|jpe?g|gif|webp|bmp|avif)$/i, ''),
        src,
        album: parent?.name ?? t('photos.unsorted'),
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        size: node.size,
        node,
        mime: (node.metadata?.mime as string | undefined) ?? 'image/*',
      });
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }, [nodes, t]);

  const albums = useMemo(() => {
    const counts = new Map<string, number>();
    photos.forEach((photo) => counts.set(photo.album, (counts.get(photo.album) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [photos]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return photos.filter((photo) => (album ? photo.album === album : true) && (!needle || photo.title.toLowerCase().includes(needle)));
  }, [album, photos, query]);

  const current = index !== null ? filtered[index] : undefined;

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const step = useCallback(
    (delta: number) => {
      setIndex((value) => {
        if (value === null) return value;
        const next = (value + delta + filtered.length) % filtered.length;
        return next;
      });
      resetView();
    },
    [filtered.length],
  );

  useEffect(() => {
    if (!slideshow) return undefined;
    const interval = window.setInterval(() => step(1), 3200);
    return () => window.clearInterval(interval);
  }, [slideshow, step]);

  useEffect(() => {
    if (index === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      } else if (event.key === 'Escape') {
        setIndex(null);
        setSlideshow(false);
      } else if (event.key === '+' || event.key === '=') {
        setZoom((value) => Math.min(6, value + 0.25));
      } else if (event.key === '-') {
        setZoom((value) => Math.max(0.25, value - 0.25));
      } else if (event.key === '0') {
        resetView();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, step]);

  const useAsWallpaper = (photo: PhotoItemView, lock: boolean) => {
    // Wallpapers are ids in the theme system; a custom image is stored as a data-URL wallpaper entry.
    const id = `custom:${photo.src.slice(0, 24)}`;
    registerCustomWallpaper(id, photo.src, photo.title);
    if (lock) setLockWallpaper(id);
    else setWallpaper(id);
    notify(t('photos.wallpaperSet'), photo.title, 'success', 'photos');
  };

  const remove = (photo: PhotoItemView) => {
    if (!photo.node) return;
    openDialog({
      kind: 'confirm',
      title: t('common.confirmTitle'),
      message: t('photos.deleteConfirm', { name: photo.title }),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => {
        softDelete([photo.node!.id]);
        setIndex(null);
      },
    });
  };

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
        <ImageIcon size={17} className="text-[var(--accent)]" />
        <h2 className="text-[14px] font-semibold">{t('app.photos')}</h2>
        <div className="relative ms-2">
          <Search size={13} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 opacity-50" />
          <input className="win-input h-8 w-44 ps-7 text-[12px]" placeholder={t('photos.searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Badge tone="neutral">{photos.length}</Badge>
          <button type="button" className="win-button flex items-center gap-1.5 px-2.5 py-1 text-[12px]" onClick={() => { if (index === null && filtered.length) setIndex(0); setSlideshow((value) => !value); }} disabled={!filtered.length}>
            {slideshow ? <Pause size={13} /> : <Play size={13} />} {slideshow ? t('photos.stopSlideshow') : t('photos.slideshow')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Albums */}
        <aside className="scroll-thin w-44 shrink-0 overflow-y-auto border-e border-[var(--border)] bg-[var(--surface-2)] p-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('photos.albums')}</p>
          <button type="button" className={`list-row w-full justify-between ${album === null ? 'bg-[var(--accent-soft)]' : ''}`} onClick={() => setAlbum(null)}>
            <span className="text-[12px]">{t('photos.allPhotos')}</span>
            <span className="text-[11px] opacity-55">{photos.length}</span>
          </button>
          {albums.map(([name, count]) => (
            <button key={name} type="button" className={`list-row w-full justify-between ${album === name ? 'bg-[var(--accent-soft)]' : ''}`} onClick={() => setAlbum(name)}>
              <span className="truncate text-[12px]">{name}</span>
              <span className="text-[11px] opacity-55">{count}</span>
            </button>
          ))}
          <p className="mt-4 text-[10.5px] leading-relaxed opacity-50">{t('photos.simulatedNote')}</p>
        </aside>

        {/* Grid */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <EmptyState icon={<ImageIcon size={40} />} title={t('photos.empty')} message={t('photos.emptyHint')} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
              {filtered.map((photo, photoIndex) => (
                <button
                  key={photo.id}
                  type="button"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)] transition hover:border-[var(--accent)]"
                  onClick={() => {
                    setIndex(photoIndex);
                    resetView();
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openPhotoMenu(event.clientX, event.clientY, photo, {
                      open: () => {
                        setIndex(photoIndex);
                        resetView();
                      },
                      wallpaper: () => useAsWallpaper(photo, false),
                      lock: () => useAsWallpaper(photo, true),
                      download: () => (photo.node ? exportNode(photo.node.id) : downloadDataUrl(photo.src, `${photo.title}.png`)),
                      remove: () => remove(photo),
                      t,
                    });
                  }}
                >
                  <img src={photo.src} alt={photo.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-start">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white">{photo.title}</span>
                    <span className="shrink-0 text-[10px] text-white/70">{formatBytes(photo.size)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Viewer */}
      {current && index !== null ? (
        <div className="absolute inset-0 z-40 flex flex-col bg-black/92 backdrop-blur-sm">
          <header className="flex items-center gap-2 px-3 py-2 text-white">
            <button type="button" className="icon-button h-8 w-8 text-white" onClick={() => { setIndex(null); setSlideshow(false); }} aria-label={t('common.close')}>
              <X size={17} />
            </button>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{current.title}</span>
            <span className="text-[11px] opacity-60">
              {index + 1} / {filtered.length}
            </span>
            <div className="mx-2 flex items-center gap-1">
              <button type="button" className="icon-button h-8 w-8 text-white" onClick={() => setZoom((value) => Math.max(0.25, value - 0.25))} aria-label={t('photos.zoomOut')}>
                <ZoomOut size={16} />
              </button>
              <span className="w-14 text-center text-[11.5px] tabular-nums">{Math.round(zoom * 100)}%</span>
              <button type="button" className="icon-button h-8 w-8 text-white" onClick={() => setZoom((value) => Math.min(6, value + 0.25))} aria-label={t('photos.zoomIn')}>
                <ZoomIn size={16} />
              </button>
              <button type="button" className="icon-button h-8 w-8 text-white" onClick={resetView} aria-label={t('photos.resetZoom')}>
                <RotateCcw size={15} />
              </button>
              <button type="button" className="icon-button h-8 w-8 text-white" onClick={() => setInfoOpen((value) => !value)} aria-label={t('photos.fileInfo')}>
                <Info size={16} />
              </button>
            </div>
            <button type="button" className="icon-button h-8 w-8 text-white" title={t('photos.setWallpaper')} onClick={() => useAsWallpaper(current, false)}>
              <Maximize2 size={15} />
            </button>
            <button
              type="button"
              className="icon-button h-8 w-8 text-white"
              title={t('common.download')}
              onClick={() => (current.node ? exportNode(current.node.id) : downloadDataUrl(current.src, `${current.title}.png`))}
            >
              <Download size={16} />
            </button>
            {current.node ? (
              <button type="button" className="icon-button h-8 w-8 text-red-400" title={t('common.delete')} onClick={() => remove(current)}>
                <Trash2 size={16} />
              </button>
            ) : null}
          </header>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
            onPointerDown={(event) => {
              if (zoom > 1) dragging.current = { x: event.clientX - offset.x, y: event.clientY - offset.y };
            }}
            onPointerMove={(event) => {
              if (!dragging.current) return;
              setOffset({ x: event.clientX - dragging.current.x, y: event.clientY - dragging.current.y });
            }}
            onPointerUp={() => {
              dragging.current = null;
            }}
            onWheel={(event) => setZoom((value) => Math.max(0.25, Math.min(6, value + (event.deltaY < 0 ? 0.15 : -0.15))))}
          >
            <img
              src={current.src}
              alt={current.title}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
              draggable={false}
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, cursor: zoom > 1 ? 'grab' : 'default' }}
            />
            <button type="button" className="icon-button absolute start-3 top-1/2 h-10 w-10 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20" onClick={() => step(-1)} aria-label={t('photos.previous')}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" className="icon-button absolute end-3 top-1/2 h-10 w-10 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20" onClick={() => step(1)} aria-label={t('photos.next')}>
              <ChevronRight size={22} />
            </button>
          </div>

          {infoOpen ? (
            <aside className="border-t border-white/15 bg-black/70 px-4 py-3 text-white">
              <p className="mb-1.5 text-[12px] font-semibold">{t('photos.fileInfo')}</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11.5px] md:grid-cols-4">
                <Row label={t('common.name')} value={current.node?.name ?? current.title} />
                <Row label={t('explorer.location')} value={current.album} />
                <Row label={t('properties.size')} value={formatBytes(current.size)} />
                <Row label={t('properties.type')} value={current.mime ?? 'image'} />
                <Row label={t('properties.created')} value={`${formatDate(current.createdAt)} ${formatTime(current.createdAt)}`} />
                <Row label={t('properties.modified')} value={`${formatDate(current.updatedAt)} ${formatTime(current.updatedAt)}`} />
              </dl>
            </aside>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] uppercase tracking-wide opacity-50">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function openPhotoMenu(
  x: number,
  y: number,
  photo: PhotoItemView,
  handlers: { open: () => void; wallpaper: () => void; lock: () => void; download: () => void; remove: () => void; t: (key: string, vars?: Record<string, string | number>) => string },
) {
  useShellStore.getState().openContextMenu({
    x,
    y,
    title: photo.title,
    items: [
      { id: 'open', label: handlers.t('photos.open'), icon: 'Eye', action: handlers.open },
      { id: 'wallpaper', label: handlers.t('photos.setWallpaper'), icon: 'Image', action: handlers.wallpaper },
      { id: 'lock', label: handlers.t('photos.setLockWallpaper'), icon: 'Lock', action: handlers.lock },
      { id: 'download', label: handlers.t('common.download'), icon: 'Download', action: handlers.download },
      { id: 'sep', label: '', separator: true },
      { id: 'delete', label: handlers.t('common.delete'), icon: 'Trash2', danger: true, disabled: !photo.node, action: handlers.remove },
    ],
  });
}

export default PhotosApp;
