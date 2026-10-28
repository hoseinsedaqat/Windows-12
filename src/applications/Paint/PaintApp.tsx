import { useCallback, useEffect, useRef, useState } from 'react';
import { Brush, Eraser, Minus, Square, Circle, Undo2, Redo2, Trash2, Save, Download, Pipette, PaintBucket } from 'lucide-react';
import { useT } from '../../i18n';
import { Toolbar, ToolButton, Badge } from '../../components/ui/Controls';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { createNode, estimateSize } from '../../core/FileSystem';
import { downloadDataUrl } from '../../services/files';
import { notify } from '../../stores/notificationStore';
import { PICTURES_ID } from '../../core/FileSystem';
import { useShellStore } from '../../stores/shellStore';

type Tool = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill';

const PALETTE = [
  '#0f172a', '#ffffff', '#dc2626', '#ea580c', '#f59e0b', '#facc15',
  '#16a34a', '#10b981', '#06b6d4', '#0ea5e9', '#2563eb', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#78716c', '#a3a3a3',
];

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 600;

export function PaintApp() {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const mutate = useFileSystemStore((state) => state.mutate);
  const openDialog = useShellStore((state) => state.openDialog);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#2563eb');
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(1);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [strokes, setStrokes] = useState(0);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const drawing = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  /* White background so PNG export is not transparent. */
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const snapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL('image/png');
    setUndoStack((current) => [...current.slice(-24), data]);
    setRedoStack([]);
  }, []);

  const restore = (dataUrl: string) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
    };
    image.src = dataUrl;
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || !undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, canvas.toDataURL('image/png')]);
    restore(previous);
  };

  const redo = () => {
    const canvas = canvasRef.current;
    if (!canvas || !redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, canvas.toDataURL('image/png')]);
    restore(next);
  };

  const clearCanvas = () => {
    openDialog({
      kind: 'confirm',
      title: t('paint.clear'),
      message: t('paint.clearConfirm'),
      danger: true,
      onConfirm: () => {
        snapshot();
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        setStrokes(0);
      },
    });
  };

  const dataUrl = () => canvasRef.current?.toDataURL('image/png') ?? '';

  const exportPng = () => {
    downloadDataUrl(dataUrl(), `painting-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`);
  };

  const saveToPictures = () => {
    openDialog({
      kind: 'prompt',
      title: t('paint.saveTitle'),
      message: t('paint.saveHint'),
      defaultValue: 'My painting.png',
      confirmLabel: t('common.save'),
      onConfirm: (value) => {
        const name = value.endsWith('.png') ? value : `${value}.png`;
        const url = dataUrl();
        const node = createNode({
          name,
          kind: 'image',
          parentId: PICTURES_ID,
          content: null,
          size: estimateSize(url),
          metadata: { dataUrl: url, mime: 'image/png', appId: 'photos' },
        });
        mutate((current) => ({ ...current, [node.id]: node }));
        setSavedName(name);
        notify(t('paint.savedToPictures'), name, 'success', 'paint');
      },
    });
  };

  const pointFrom = (event: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const beginStroke = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const point = pointFrom(event);
    snapshot();

    if (tool === 'fill') {
      floodFill(context, Math.round(point.x), Math.round(point.y), color);
      setStrokes((value) => value + 1);
      return;
    }

    drawing.current = { ...point, startX: point.x, startY: point.y };
    context.globalAlpha = opacity;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = tool === 'eraser' ? size * 3 : size;
    context.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    context.fillStyle = color;

    if (tool === 'brush' || tool === 'eraser') {
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.lineTo(point.x + 0.01, point.y + 0.01);
      context.stroke();
    }
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const moveStroke = (event: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    const context = canvas?.getContext('2d');
    const previewContext = preview?.getContext('2d');
    if (!canvas || !context || !drawing.current) return;
    const point = pointFrom(event);

    if (tool === 'brush' || tool === 'eraser') {
      context.lineTo(point.x, point.y);
      context.stroke();
      drawing.current = { ...drawing.current, x: point.x, y: point.y };
      return;
    }

    if (!preview || !previewContext) return;
    previewContext.clearRect(0, 0, preview.width, preview.height);
    previewContext.globalAlpha = opacity;
    previewContext.lineWidth = size;
    previewContext.strokeStyle = color;
    previewContext.fillStyle = color;
    previewContext.beginPath();
    const { startX, startY } = drawing.current;
    if (tool === 'line') {
      previewContext.moveTo(startX, startY);
      previewContext.lineTo(point.x, point.y);
      previewContext.stroke();
    } else if (tool === 'rect') {
      previewContext.strokeRect(Math.min(startX, point.x), Math.min(startY, point.y), Math.abs(point.x - startX), Math.abs(point.y - startY));
    } else if (tool === 'ellipse') {
      previewContext.ellipse(
        (startX + point.x) / 2,
        (startY + point.y) / 2,
        Math.abs(point.x - startX) / 2,
        Math.abs(point.y - startY) / 2,
        0,
        0,
        Math.PI * 2,
      );
      previewContext.stroke();
    }
  };

  const endStroke = () => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    const context = canvas?.getContext('2d');
    const previewContext = preview?.getContext('2d');
    if (!drawing.current) return;
    if (preview && previewContext && context && (tool === 'line' || tool === 'rect' || tool === 'ellipse')) {
      context.drawImage(preview, 0, 0);
      previewContext.clearRect(0, 0, preview.width, preview.height);
    }
    if (context) {
      context.closePath();
      context.globalAlpha = 1;
    }
    if (drawing.current) setStrokes((value) => value + 1);
    drawing.current = null;
  };

  const pickColor = (event: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const point = pointFrom(event);
    const pixel = context.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data;
    const hex = `#${[pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    setColor(hex);
    setTool('brush');
  };

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveToPictures();
      } else if (event.key === 'b') setTool('brush');
      else if (event.key === 'e') setTool('eraser');
      else if (event.key === 'l') setTool('line');
      else if (event.key === 'r') setTool('rect');
      else if (event.key === 'o') setTool('ellipse');
      else if (event.key === 'g') setTool('fill');
      else if (event.key === '[') setSize((value) => Math.max(1, value - 2));
      else if (event.key === ']') setSize((value) => Math.min(80, value + 2));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <Toolbar>
        <ToolButton icon={<Save size={15} />} label={t('paint.saveToPictures')} onClick={saveToPictures} />
        <ToolButton icon={<Download size={15} />} label={t('paint.exportPng')} onClick={exportPng} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Brush size={15} />} title={`${t('paint.brush')} (B)`} active={tool === 'brush'} onClick={() => setTool('brush')} />
        <ToolButton icon={<Eraser size={15} />} title={`${t('paint.eraser')} (E)`} active={tool === 'eraser'} onClick={() => setTool('eraser')} />
        <ToolButton icon={<Minus size={15} />} title="Line (L)" active={tool === 'line'} onClick={() => setTool('line')} />
        <ToolButton icon={<Square size={15} />} title="Rectangle (R)" active={tool === 'rect'} onClick={() => setTool('rect')} />
        <ToolButton icon={<Circle size={15} />} title="Ellipse (O)" active={tool === 'ellipse'} onClick={() => setTool('ellipse')} />
        <ToolButton icon={<PaintBucket size={15} />} title={`${t('paint.fill')} (G)`} active={tool === 'fill'} onClick={() => setTool('fill')} />
        <ToolButton icon={<Pipette size={15} />} title={`${t('paint.picker')} (Shift+click also works)`} active={picker} onClick={() => setPicker((value) => !value)} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Undo2 size={15} />} title={t('common.undo')} onClick={undo} disabled={!undoStack.length} />
        <ToolButton icon={<Redo2 size={15} />} title={t('common.redo')} onClick={redo} disabled={!redoStack.length} />
        <ToolButton icon={<Trash2 size={15} />} title={t('paint.clear')} onClick={clearCanvas} danger />
        <span className="ms-auto flex items-center gap-2 pe-1">
          {savedName ? <Badge tone="success">{savedName}</Badge> : null}
          <Badge tone="neutral">{strokes} strokes</Badge>
        </span>
      </Toolbar>

      {/* Colour + size */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`h-6 w-6 rounded border transition ${color === swatch ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border-strong)] hover:scale-110'}`}
              style={{ background: swatch }}
              onClick={() => setColor(swatch)}
              aria-label={swatch}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11.5px]">
          <span className="opacity-60">{t('paint.customColor')}</span>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-7 w-9 cursor-pointer rounded border border-[var(--border)] bg-transparent" />
        </label>
        <label className="flex items-center gap-2 text-[11.5px]">
          <span className="opacity-60">{t('paint.thickness')}</span>
          <input type="range" min={1} max={80} value={size} onChange={(event) => setSize(Number(event.target.value))} className="w-28 accent-[var(--accent)]" />
          <span className="w-8 tabular-nums">{size}px</span>
        </label>
        <label className="flex items-center gap-2 text-[11.5px]">
          <span className="opacity-60">{t('paint.opacity')}</span>
          <input type="range" min={10} max={100} value={Math.round(opacity * 100)} onChange={(event) => setOpacity(Number(event.target.value) / 100)} className="w-24 accent-[var(--accent)]" />
          <span className="w-9 tabular-nums">{Math.round(opacity * 100)}%</span>
        </label>
        <span
          className="h-8 w-8 rounded-full border border-[var(--border-strong)]"
          style={{ background: color, opacity }}
          title={`${color} · ${size}px`}
        />
      </div>

      {/* Canvas */}
      <div className="scroll-thin flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[#4b5563] p-4 dark:bg-[#101216]">
        <div className="relative shadow-[0_16px_40px_rgba(0,0,0,.4)]" style={{ width: '100%', maxWidth: CANVAS_WIDTH }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block w-full touch-none rounded-sm bg-white"
            style={{ cursor: picker ? 'copy' : tool === 'fill' ? 'cell' : 'crosshair', aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
            onPointerDown={(event) => {
              if (event.shiftKey || picker) {
                pickColor(event);
                setPicker(false);
                return;
              }
              beginStroke(event);
            }}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={endStroke}
            onContextMenu={(event) => event.preventDefault()}
          />
          <canvas
            ref={previewRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="pointer-events-none absolute inset-0 w-full"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          />
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px] opacity-70">
        <span>{CANVAS_WIDTH} × {CANVAS_HEIGHT}</span>
        <span>{t('paint.toolHint')}</span>
        <span className="ms-auto">{t('paint.simulatedNote')}</span>
      </footer>
    </div>
  );
}

/** Scanline flood fill — bounded so a click on a large area cannot hang the tab. */
function floodFill(context: CanvasRenderingContext2D, x: number, y: number, hex: string): void {
  const width = context.canvas.width;
  const height = context.canvas.height;
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const index = (y * width + x) * 4;
  const target = [data[index], data[index + 1], data[index + 2], data[index + 3]];
  const fill = hexToRgb(hex);
  if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2]) return;

  const matches = (offset: number) =>
    Math.abs(data[offset] - target[0]) < 8 &&
    Math.abs(data[offset + 1] - target[1]) < 8 &&
    Math.abs(data[offset + 2] - target[2]) < 8 &&
    Math.abs(data[offset + 3] - target[3]) < 8;

  const stack: [number, number][] = [[x, y]];
  let guard = 0;
  const maxSteps = width * height;
  while (stack.length && guard < maxSteps) {
    guard += 1;
    const [currentX, currentY] = stack.pop() as [number, number];
    let left = currentX;
    let right = currentX;
    while (left >= 0 && matches((currentY * width + left) * 4)) left -= 1;
    while (right < width && matches((currentY * width + right) * 4)) right += 1;
    for (let pixel = left + 1; pixel < right; pixel += 1) {
      const offset = (currentY * width + pixel) * 4;
      data[offset] = fill[0];
      data[offset + 1] = fill[1];
      data[offset + 2] = fill[2];
      data[offset + 3] = 255;
      if (currentY > 0 && matches(((currentY - 1) * width + pixel) * 4)) stack.push([pixel, currentY - 1]);
      if (currentY < height - 1 && matches(((currentY + 1) * width + pixel) * 4)) stack.push([pixel, currentY + 1]);
    }
  }
  context.putImageData(image, 0, 0);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
}

export default PaintApp;
