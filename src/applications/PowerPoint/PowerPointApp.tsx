import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Play,
  Save,
  Type as TypeIcon,
  Image as ImageIcon,
  Square,
  Circle,
  Triangle,
  Minus,
  LayoutTemplate,
  Palette,
  Download,
  FileDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCw,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { AppWindowProps } from '../registry';
import type { PresentationDocument, Slide, SlideElement } from '../../types';
import { useDocument } from '../../hooks/useDocument';
import { isPresentation, createPresentation, createSlide } from '../../core/Documents';
import { useT } from '../../i18n';
import { Toolbar, ToolButton, Modal, Field, Select, Badge, Segmented, EmptyState } from '../../components/ui/Controls';
import { downloadBlob, pickFiles, readFileAsDataUrl } from '../../services/files';
import { exportPptx } from '../../services/office/pptx';
import { useShellStore } from '../../stores/shellStore';
import { DOCUMENTS_ID } from '../../core/FileSystem';
import { uid } from '../../services/id';
import { drawSlide, LAYOUT_PRESETS, SLIDE_HEIGHT, SLIDE_WIDTH, TEMPLATE_BACKGROUNDS } from './slideRender';

const SHAPES: { id: NonNullable<SlideElement['shape']>; label: string; icon: React.ReactNode }[] = [
  { id: 'rect', label: 'Rectangle', icon: <Square size={15} /> },
  { id: 'ellipse', label: 'Ellipse', icon: <Circle size={15} /> },
  { id: 'triangle', label: 'Triangle', icon: <Triangle size={15} /> },
  { id: 'line', label: 'Line', icon: <Minus size={15} /> },
];

const TEXT_COLORS = ['#0f172a', '#334155', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ffffff', '#e2e8f0'];
const FILL_COLORS = ['transparent', '#2563eb', '#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#e2e8f0', '#0f172a'];

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export function PowerPointApp({ props }: AppWindowProps) {
  const { t } = useT();
  const fileId = props.fileId as string | undefined;
  const openDialog = useShellStore((state) => state.openDialog);

  const document$ = useDocument<PresentationDocument>({
    fileId,
    kind: 'slides',
    appId: 'powerpoint',
    factory: () => createPresentation(),
    validate: isPresentation,
    titleOf: (_doc, node) => node?.name?.replace(/\.pptx$/i, '') ?? t('ppt.untitled'),
    defaultFolder: DOCUMENTS_ID,
    defaultName: t('ppt.untitled'),
    autosaveDelay: 1200,
  });

  const doc = document$.doc;
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [slideshow, setSlideshow] = useState(false);
  const [showIndex, setShowIndex] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [dragSlideIndex, setDragSlideIndex] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  const slide: Slide | undefined = doc.slides[Math.min(activeIndex, doc.slides.length - 1)];
  const selected = slide?.elements.find((element) => element.id === selectedId) ?? null;

  /* Keep the stage scaled to the available space. */
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      const next = Math.min((rect.width - 48) / SLIDE_WIDTH, (rect.height - 48) / SLIDE_HEIGHT);
      setScale(Math.max(0.2, Math.min(1.6, next || 0.6)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (activeIndex > doc.slides.length - 1) setActiveIndex(Math.max(0, doc.slides.length - 1));
  }, [doc.slides.length, activeIndex]);

  /* ---------------- mutations ---------------- */
  const updateSlides = useCallback(
    (updater: (slides: Slide[]) => Slide[]) => {
      document$.setDoc((current) => ({ ...current, slides: updater(current.slides), updatedAt: Date.now() }));
    },
    [document$],
  );

  const updateSlide = useCallback(
    (index: number, updater: (current: Slide) => Slide) => {
      updateSlides((slides) => slides.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)));
    },
    [updateSlides],
  );

  const updateElement = useCallback(
    (elementId: string, patch: Partial<SlideElement>) => {
      if (!slide) return;
      updateSlide(activeIndex, (current) => ({
        ...current,
        elements: current.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element)),
      }));
    },
    [activeIndex, slide, updateSlide],
  );

  const addSlide = (after = activeIndex) => {
    const next = createSlide(slide?.layout ?? 'title-content', slide?.background ?? '#ffffff');
    updateSlides((slides) => {
      const copy = [...slides];
      copy.splice(after + 1, 0, next);
      return copy;
    });
    setActiveIndex(after + 1);
    setSelectedId(null);
  };

  const duplicateSlide = (index: number) => {
    const source = doc.slides[index];
    const copy: Slide = {
      ...source,
      id: uid('slide'),
      layout: source.layout,
      elements: source.elements.map((element) => ({ ...element, id: uid('el') })),
      notes: source.notes,
      background: source.background,
    };
    updateSlides((slides) => {
      const next = [...slides];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setActiveIndex(index + 1);
  };

  const deleteSlide = (index: number) => {
    if (doc.slides.length <= 1) {
      openDialog({ kind: 'alert', title: t('common.notice'), message: 'A presentation needs at least one slide.' });
      return;
    }
    updateSlides((slides) => slides.filter((_, itemIndex) => itemIndex !== index));
    setActiveIndex(Math.max(0, Math.min(index, doc.slides.length - 2)));
    setSelectedId(null);
  };

  const moveSlide = (from: number, to: number) => {
    if (from === to || to < 0 || to >= doc.slides.length) return;
    updateSlides((slides) => {
      const next = [...slides];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setActiveIndex(to);
  };

  const applyLayout = (layout: string) => {
    if (!slide) return;
    const preset = LAYOUT_PRESETS[layout] ?? [];
    const typed = layout as Slide['layout'];
    updateSlide(activeIndex, (current) => ({
      ...current,
      layout: typed,
      elements: [
        ...current.elements.filter((element) => element.type !== 'title' && element.type !== 'text'),
        ...preset.map((item) => ({
          id: uid('el'),
          type: item.type,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          rotation: 0,
          text: item.type === 'title' ? t('ppt.titlePlaceholder') : t('ppt.textPlaceholder'),
          fontSize: item.type === 'title' ? 40 : 20,
          fontFamily: 'Segoe UI',
          color: item.type === 'title' ? '#0f172a' : '#334155',
          align: item.type === 'title' ? ('center' as const) : ('left' as const),
          bold: item.type === 'title',
        })),
      ],
    }));
  };

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATE_BACKGROUNDS.find((item) => item.id === templateId);
    if (!template) return;
    updateSlides((slides) =>
      slides.map((item) => ({
        ...item,
        background: template.background,
        elements: item.elements.map((element) =>
          element.type === 'title'
            ? { ...element, color: template.titleColor }
            : element.type === 'text'
              ? { ...element, color: template.bodyColor }
              : element,
        ),
      })),
    );
    setTemplatesOpen(false);
  };

  const addElement = (kind: 'text' | 'title' | 'image' | 'shape', shape?: SlideElement['shape']) => {
    const base: SlideElement = {
      id: uid('el'),
      type: kind === 'shape' ? 'shape' : kind,
      x: 120,
      y: 120,
      w: kind === 'title' ? 720 : kind === 'text' ? 420 : kind === 'image' ? 360 : 220,
      h: kind === 'title' ? 80 : kind === 'text' ? 140 : kind === 'image' ? 240 : 140,
      rotation: 0,
    };
    if (kind === 'text' || kind === 'title') {
      base.text = kind === 'title' ? t('ppt.titlePlaceholder') : t('ppt.textPlaceholder');
      base.fontSize = kind === 'title' ? 40 : 20;
      base.fontFamily = 'Segoe UI';
      base.color = '#0f172a';
      base.align = 'left';
      base.bold = kind === 'title';
    }
    if (kind === 'shape') {
      base.shape = shape ?? 'rect';
      base.fill = '#2563eb';
      base.stroke = '#1e3a8a';
      base.strokeWidth = 2;
    }
    updateSlide(activeIndex, (current) => ({ ...current, elements: [...current.elements, base] }));
    setSelectedId(base.id);
    if (kind === 'text' || kind === 'title') setEditingTextId(base.id);
  };

  const insertImage = async () => {
    const files = await pickFiles('image/*', false);
    if (!files.length) return;
    const src = await readFileAsDataUrl(files[0]);
    const element: SlideElement = { id: uid('el'), type: 'image', x: 240, y: 130, w: 480, h: 280, rotation: 0, src };
    updateSlide(activeIndex, (current) => ({ ...current, elements: [...current.elements, element] }));
    setSelectedId(element.id);
  };

  const reorderElement = (direction: 'up' | 'down') => {
    if (!selected || !slide) return;
    const index = slide.elements.findIndex((element) => element.id === selected.id);
    const target = direction === 'up' ? index + 1 : index - 1;
    if (target < 0 || target >= slide.elements.length) return;
    updateSlide(activeIndex, (current) => {
      const elements = [...current.elements];
      const [moved] = elements.splice(index, 1);
      elements.splice(target, 0, moved);
      return { ...current, elements };
    });
  };

  /* ---------------- element dragging / resizing ---------------- */
  const beginElementDrag = (event: React.PointerEvent, element: SlideElement, handle: Handle | null) => {
    if (editingTextId === element.id) return;
    event.stopPropagation();
    event.preventDefault();
    setSelectedId(element.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = { x: element.x, y: element.y, w: element.w, h: element.h, rotation: element.rotation ?? 0 };
    const factor = 1 / scale;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) * factor;
      const dy = (moveEvent.clientY - startY) * factor;
      if (handle === null) {
        updateElement(element.id, {
          x: Math.round(Math.max(0, Math.min(SLIDE_WIDTH - origin.w, origin.x + dx))),
          y: Math.round(Math.max(0, Math.min(SLIDE_HEIGHT - origin.h, origin.y + dy))),
        });
        return;
      }
      if (handle === 'rotate') {
        const centerX = origin.x + origin.w / 2;
        const centerY = origin.y + origin.h / 2;
        const stage = stageRef.current?.getBoundingClientRect();
        if (!stage) return;
        const pointerX = (moveEvent.clientX - stage.left - (stage.width - SLIDE_WIDTH * scale) / 2) / scale;
        const pointerY = (moveEvent.clientY - stage.top - (stage.height - SLIDE_HEIGHT * scale) / 2) / scale;
        const angle = (Math.atan2(pointerY - centerY, pointerX - centerX) * 180) / Math.PI + 90;
        updateElement(element.id, { rotation: Math.round(((angle % 360) + 360) % 360) });
        return;
      }
      let { x, y, w, h } = origin;
      if (handle.includes('w')) {
        x = Math.max(0, origin.x + dx);
        w = Math.max(24, origin.w - (x - origin.x));
      }
      if (handle.includes('e')) w = Math.max(24, origin.w + dx);
      if (handle.includes('n')) {
        y = Math.max(0, origin.y + dy);
        h = Math.max(24, origin.h - (y - origin.y));
      }
      if (handle.includes('s')) h = Math.max(24, origin.h + dy);
      updateElement(element.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (slideshow) {
        if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(event.key)) {
          event.preventDefault();
          setShowIndex((index) => Math.min(doc.slides.length - 1, index + 1));
        } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(event.key)) {
          event.preventDefault();
          setShowIndex((index) => Math.max(0, index - 1));
        } else if (event.key === 'Escape' || event.key === 'Home') {
          event.preventDefault();
          if (event.key === 'Home') setShowIndex(0);
          else setSlideshow(false);
        } else if (event.key === 'End') {
          event.preventDefault();
          setShowIndex(doc.slides.length - 1);
        }
        return;
      }

      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void document$.save();
        return;
      }
      if (event.key === 'F5') {
        event.preventDefault();
        setShowIndex(activeIndex);
        setSlideshow(true);
        return;
      }
      if (selected && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        updateSlide(activeIndex, (current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selected.id) }));
        setSelectedId(null);
        return;
      }
      if (selected && event.key.startsWith('Arrow')) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 2;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key] ?? [0, 0];
        updateElement(selected.id, {
          x: Math.max(0, Math.min(SLIDE_WIDTH - selected.w, selected.x + delta[0])),
          y: Math.max(0, Math.min(SLIDE_HEIGHT - selected.h, selected.y + delta[1])),
        });
        return;
      }
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, doc.slides.length, document$.save, selected, slideshow, updateElement, updateSlide]);

  /* ---------------- export ---------------- */
  const exportPng = async () => {
    if (!slide) return;
    const canvas = document.createElement('canvas');
    await drawSlide(canvas, slide, SLIDE_WIDTH * 2);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'));
    if (blob) downloadBlob(blob, `${document$.node?.name?.replace(/\.pptx$/i, '') ?? 'presentation'}-slide-${activeIndex + 1}.png`);
    setExportOpen(false);
  };

  const exportAllPng = async () => {
    for (let index = 0; index < doc.slides.length; index += 1) {
      const canvas = document.createElement('canvas');
      await drawSlide(canvas, doc.slides[index], SLIDE_WIDTH);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/png'));
      if (blob) downloadBlob(blob, `slide-${String(index + 1).padStart(2, '0')}.png`);
    }
    setExportOpen(false);
  };

  const exportPdf = () => {
    setExportOpen(false);
    setShowIndex(activeIndex);
    setSlideshow(false);
    window.setTimeout(() => window.print(), 200);
  };

  const exportPptxFile = async () => {
    await exportPptx(doc, `${document$.node?.name?.replace(/\.pptx$/i, '') ?? 'presentation'}.pptx`);
    setExportOpen(false);
  };

  if (!slide) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={<LayoutTemplate size={40} />} title={t('ppt.empty')} message={t('ppt.emptyHint')} actionLabel={t('ppt.newSlide')} onAction={() => addSlide(-1)} />
      </div>
    );
  }

  const stageWidth = SLIDE_WIDTH * scale;
  const stageHeight = SLIDE_HEIGHT * scale;

  return (
    <div className="relative flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <Toolbar>
        <ToolButton icon={<Save size={15} />} label={t('common.save')} onClick={() => void document$.save()} />
        <ToolButton icon={<Plus size={15} />} label={t('ppt.newSlide')} onClick={() => addSlide()} />
        <ToolButton icon={<Copy size={15} />} label={t('common.duplicate')} onClick={() => duplicateSlide(activeIndex)} />
        <ToolButton icon={<Trash2 size={15} />} title={t('ppt.deleteSlide')} onClick={() => deleteSlide(activeIndex)} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<TypeIcon size={15} />} title={t('ppt.addText')} onClick={() => addElement('text')} />
        <ToolButton icon={<LayoutTemplate size={15} />} title={t('ppt.addTitle')} onClick={() => addElement('title')} />
        <ToolButton icon={<ImageIcon size={15} />} title={t('ppt.insertImage')} onClick={() => void insertImage()} />
        {SHAPES.map((shape) => (
          <ToolButton key={shape.id} icon={shape.icon} title={shape.label} onClick={() => addElement('shape', shape.id)} />
        ))}
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <LayoutMenu value={slide.layout} onPick={applyLayout} />
        <ToolButton icon={<Palette size={15} />} label={t('ppt.templates')} onClick={() => setTemplatesOpen(true)} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Play size={15} />} label={t('ppt.slideshow')} onClick={() => { setShowIndex(activeIndex); setSlideshow(true); }} />
        <ToolButton icon={<FileDown size={15} />} label={t('common.export')} onClick={() => setExportOpen(true)} />
        <span className="ms-auto flex items-center gap-2 pe-1">
          {document$.dirty ? <Badge tone="warning">{t('common.unsaved')}</Badge> : <Badge tone="success">{t('common.saved')}</Badge>}
          <span className="text-[11px] opacity-60">
            {t('ppt.slide')} {activeIndex + 1}/{doc.slides.length}
          </span>
        </span>
      </Toolbar>

      <div className="flex min-h-0 flex-1">
        {/* Slide list */}
        <aside className="scroll-thin flex w-40 shrink-0 flex-col gap-2 overflow-y-auto border-e border-[var(--border)] bg-[var(--surface-2)] p-2">
          {doc.slides.map((item, index) => (
            <SlideThumb
              key={item.id}
              slide={item}
              index={index}
              active={index === activeIndex}
              dragging={dragSlideIndex === index}
              onSelect={() => {
                setActiveIndex(index);
                setSelectedId(null);
              }}
              onDragStart={() => setDragSlideIndex(index)}
              onDrop={() => {
                if (dragSlideIndex !== null) moveSlide(dragSlideIndex, index);
                setDragSlideIndex(null);
              }}
              onMenu={(event) => {
                event.preventDefault();
                setActiveIndex(index);
                openSlideMenu(event.clientX, event.clientY, index);
              }}
            />
          ))}
          <button type="button" className="win-button flex items-center justify-center gap-1 py-1.5 text-[11.5px]" onClick={() => addSlide()}>
            <Plus size={13} /> {t('ppt.newSlide')}
          </button>
        </aside>

        {/* Stage */}
        <div
          ref={stageRef}
          className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#3f4653] p-4 dark:bg-[#15171c]"
          onPointerDown={() => {
            setSelectedId(null);
            setEditingTextId(null);
          }}
        >
          <div
            className="print-area relative shadow-[0_18px_44px_rgba(0,0,0,.45)]"
            style={{ width: stageWidth, height: stageHeight, background: slide.background ?? '#fff' }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-0" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: SLIDE_WIDTH, height: SLIDE_HEIGHT }}>
              {slide.elements.map((element) => (
                <ElementView
                  key={element.id}
                  element={element}
                  selected={selectedId === element.id}
                  editing={editingTextId === element.id}
                  scale={scale}
                  onSelect={() => setSelectedId(element.id)}
                  onStartEdit={() => {
                    setSelectedId(element.id);
                    setEditingTextId(element.id);
                  }}
                  onEndEdit={(text) => {
                    updateElement(element.id, { text });
                    setEditingTextId(null);
                  }}
                  onDragStart={(event, handle) => beginElementDrag(event, element, handle)}
                  onMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedId(element.id);
                    openElementMenu(event.clientX, event.clientY, element);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <aside className="scroll-thin w-60 shrink-0 overflow-y-auto border-s border-[var(--border)] bg-[var(--surface-2)] p-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('ppt.slideOptions')}</p>
          <div className="space-y-2">
            <Field label={t('ppt.background')}>
              <div className="flex flex-wrap gap-1">
                {['#ffffff', '#f8fafc', '#0b1020', '#052e2b', '#2b1220', '#f8f4ec', '#111827', '#e0f2fe'].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-6 w-6 rounded border ${slide.background === color ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border-strong)]'}`}
                    style={{ background: color }}
                    onClick={() => updateSlide(activeIndex, (current) => ({ ...current, background: color }))}
                    aria-label={color}
                  />
                ))}
              </div>
            </Field>
            <Field label={t('ppt.notes')}>
              <textarea
                className="win-input min-h-16 resize-y text-[11.5px]"
                value={slide.notes ?? ''}
                placeholder={t('ppt.notesPlaceholder')}
                onChange={(event) => updateSlide(activeIndex, (current) => ({ ...current, notes: event.target.value }))}
              />
            </Field>
          </div>

          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('ppt.elementOptions')}</p>
          {selected ? (
            <div className="space-y-2">
              {selected.type === 'text' || selected.type === 'title' ? (
                <>
                  <Field label={t('ppt.text')}>
                    <textarea
                      className="win-input min-h-20 resize-y text-[12px]"
                      value={selected.text ?? ''}
                      onChange={(event) => updateElement(selected.id, { text: event.target.value })}
                    />
                  </Field>
                  <Field label={t('word.font')}>
                    <Select
                      value={selected.fontFamily ?? 'Segoe UI'}
                      onChange={(value) => updateElement(selected.id, { fontFamily: value })}
                      options={['Segoe UI', 'Arial', 'Calibri', 'Georgia', 'Tahoma', 'Vazirmatn', 'Verdana'].map((font) => ({ value: font, label: font }))}
                    />
                  </Field>
                  <Field label={t('word.size')}>
                    <input
                      type="number"
                      min={8}
                      max={200}
                      className="win-input"
                      value={selected.fontSize ?? 18}
                      onChange={(event) => updateElement(selected.id, { fontSize: Number(event.target.value) })}
                    />
                  </Field>
                  <Field label="Alignment">
                    <Segmented
                      size="sm"
                      value={selected.align ?? 'left'}
                      onChange={(value) => updateElement(selected.id, { align: value as SlideElement['align'] })}
                      options={[
                        { value: 'left', label: <AlignLeft size={13} /> },
                        { value: 'center', label: <AlignCenter size={13} /> },
                        { value: 'right', label: <AlignRight size={13} /> },
                      ]}
                    />
                  </Field>
                  <Swatches label={t('ppt.textColor')} colors={TEXT_COLORS} value={selected.color} onPick={(color) => updateElement(selected.id, { color })} />
                  <div className="flex items-center justify-between rounded-md border border-[var(--border)] px-2 py-1.5">
                    <span className="text-[11.5px] font-medium">{t('word.bold')}</span>
                    <button
                      type="button"
                      className={`win-button px-2 py-0.5 text-[11px] ${selected.bold ? 'win-button-accent' : ''}`}
                      onClick={() => updateElement(selected.id, { bold: !selected.bold })}
                    >
                      {selected.bold ? 'On' : 'Off'}
                    </button>
                  </div>
                </>
              ) : null}

              {selected.type === 'shape' ? (
                <>
                  <Swatches label={t('ppt.fill')} colors={FILL_COLORS} value={selected.fill} onPick={(color) => updateElement(selected.id, { fill: color === 'transparent' ? undefined : color })} />
                  <Swatches label={t('ppt.border')} colors={TEXT_COLORS} value={selected.stroke} onPick={(color) => updateElement(selected.id, { stroke: color })} />
                  <Field label="Border width">
                    <input
                      type="range"
                      min={0}
                      max={12}
                      className="w-full accent-[var(--accent)]"
                      value={selected.strokeWidth ?? 2}
                      onChange={(event) => updateElement(selected.id, { strokeWidth: Number(event.target.value) })}
                    />
                  </Field>
                </>
              ) : null}

              <Field label="Rotation">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={360}
                    className="flex-1 accent-[var(--accent)]"
                    value={selected.rotation ?? 0}
                    onChange={(event) => updateElement(selected.id, { rotation: Number(event.target.value) })}
                  />
                  <button type="button" className="icon-button h-6 w-6" onClick={() => updateElement(selected.id, { rotation: ((selected.rotation ?? 0) + 15) % 360 })} aria-label="Rotate 15°">
                    <RotateCw size={12} />
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <ToolButton icon={<ArrowUp size={14} />} label="Bring forward" onClick={() => reorderElement('up')} />
                <ToolButton icon={<ArrowDown size={14} />} label="Send back" onClick={() => reorderElement('down')} />
                <ToolButton
                  icon={<Copy size={14} />}
                  label={t('common.duplicate')}
                  onClick={() => {
                    const copy: SlideElement = { ...selected, id: uid('el'), x: Math.min(SLIDE_WIDTH - selected.w, selected.x + 24), y: Math.min(SLIDE_HEIGHT - selected.h, selected.y + 24) };
                    updateSlide(activeIndex, (current) => ({ ...current, elements: [...current.elements, copy] }));
                    setSelectedId(copy.id);
                  }}
                />
                <ToolButton
                  icon={<Trash2 size={14} />}
                  label={t('common.delete')}
                  onClick={() => {
                    updateSlide(activeIndex, (current) => ({ ...current, elements: current.elements.filter((element) => element.id !== selected.id) }));
                    setSelectedId(null);
                  }}
                />
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10.5px]">
                {(['x', 'y', 'w', 'h'] as const).map((axis) => (
                  <label key={axis} className="flex flex-col gap-0.5">
                    <span className="uppercase opacity-55">{axis}</span>
                    <input
                      type="number"
                      className="win-input h-7 px-1 text-[11px]"
                      value={Math.round(selected[axis])}
                      onChange={(event) => updateElement(selected.id, { [axis]: Number(event.target.value) } as Partial<SlideElement>)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11.5px] opacity-60">{t('ppt.selectElementHint')}</p>
          )}
        </aside>
      </div>

      {/* Slideshow */}
      {slideshow ? (
        <div className="absolute inset-0 z-50 flex flex-col bg-black" onPointerDown={() => setShowIndex((index) => Math.min(doc.slides.length - 1, index + 1))}>
          <SlideshowStage slide={doc.slides[showIndex]} />
          <div className="flex items-center gap-3 bg-black/70 px-4 py-2 text-white">
            <button type="button" className="icon-button h-7 w-7 text-white" onClick={(event) => { event.stopPropagation(); setShowIndex((index) => Math.max(0, index - 1)); }} aria-label={t('common.back')}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-[12px] tabular-nums">
              {showIndex + 1} / {doc.slides.length}
            </span>
            <button type="button" className="icon-button h-7 w-7 text-white" onClick={(event) => { event.stopPropagation(); setShowIndex((index) => Math.min(doc.slides.length - 1, index + 1)); }} aria-label={t('common.next')}>
              <ChevronRight size={16} />
            </button>
            <span className="ms-auto text-[11px] opacity-70">Arrows / Space to navigate · Esc to exit</span>
            <button type="button" className="icon-button h-7 w-7 text-white" onClick={(event) => { event.stopPropagation(); setSlideshow(false); }} aria-label={t('common.close')}>
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Templates */}
      <Modal open={templatesOpen} title={t('ppt.templates')} onClose={() => setTemplatesOpen(false)}>
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATE_BACKGROUNDS.map((template) => (
            <button
              key={template.id}
              type="button"
              className="overflow-hidden rounded-lg border border-[var(--border)] transition hover:border-[var(--accent)]"
              onClick={() => applyTemplate(template.id)}
            >
              <span className="flex h-14 items-center justify-center text-[11px] font-semibold" style={{ background: template.background, color: template.titleColor }}>
                Aa
              </span>
              <span className="block px-2 py-1 text-[11px]">{template.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] opacity-60">{t('ppt.simulatedNote')}</p>
      </Modal>

      {/* Export */}
      <Modal open={exportOpen} title={t('common.export')} onClose={() => setExportOpen(false)}>
        <div className="space-y-2">
          <ExportRow icon={<ImageIcon size={16} />} label={t('ppt.exportPng')} hint="Current slide as a PNG image" onClick={() => void exportPng()} />
          <ExportRow icon={<Layers size={16} />} label="All slides as PNG" hint={`${doc.slides.length} images downloaded`} onClick={() => void exportAllPng()} />
          <ExportRow icon={<Printer size={16} />} label={t('ppt.exportPdf')} hint="Browser print dialog — choose “Save as PDF”" onClick={exportPdf} />
          <ExportRow icon={<Download size={16} />} label={t('ppt.exportPptx')} hint={t('ppt.pptxNote')} onClick={() => void exportPptxFile()} />
        </div>
      </Modal>
    </div>
  );

  function openSlideMenu(x: number, y: number, index: number) {
    openSlideContextMenu(x, y, index, {
      add: () => addSlide(index),
      duplicate: () => duplicateSlide(index),
      remove: () => deleteSlide(index),
      moveUp: () => moveSlide(index, index - 1),
      moveDown: () => moveSlide(index, index + 1),
      t,
    });
  }

  function openElementMenu(x: number, y: number, element: SlideElement) {
    useShellStore.getState().openContextMenu({
      x,
      y,
      title: element.type,
      items: [
        { id: 'edit', label: 'Edit text', icon: 'Edit', disabled: element.type !== 'text' && element.type !== 'title', action: () => setEditingTextId(element.id) },
        { id: 'duplicate', label: t('common.duplicate'), icon: 'Copy', action: () => {
          const copy: SlideElement = { ...element, id: uid('el'), x: element.x + 24, y: element.y + 24 };
          updateSlide(activeIndex, (current) => ({ ...current, elements: [...current.elements, copy] }));
          setSelectedId(copy.id);
        } },
        { id: 'forward', label: 'Bring forward', icon: 'ArrowUp', action: () => reorderElement('up') },
        { id: 'back', label: 'Send backward', icon: 'ArrowDown', action: () => reorderElement('down') },
        { id: 'delete', label: t('common.delete'), icon: 'Trash2', danger: true, action: () => {
          updateSlide(activeIndex, (current) => ({ ...current, elements: current.elements.filter((item) => item.id !== element.id) }));
          setSelectedId(null);
        } },
      ],
    });
  }
}

function openSlideContextMenu(
  x: number,
  y: number,
  index: number,
  handlers: { add: () => void; duplicate: () => void; remove: () => void; moveUp: () => void; moveDown: () => void; t: (key: string) => string },
) {
  useShellStore.getState().openContextMenu({
    x,
    y,
    title: `${handlers.t('ppt.slide')} ${index + 1}`,
    items: [
      { id: 'add', label: handlers.t('ppt.newSlide'), icon: 'Plus', action: handlers.add },
      { id: 'duplicate', label: handlers.t('common.duplicate'), icon: 'Copy', action: handlers.duplicate },
      { id: 'up', label: 'Move up', icon: 'ArrowUp', action: handlers.moveUp },
      { id: 'down', label: 'Move down', icon: 'ArrowDown', action: handlers.moveDown },
      { id: 'delete', label: handlers.t('ppt.deleteSlide'), icon: 'Trash2', danger: true, action: handlers.remove },
    ],
  });
}

function ExportRow({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="list-row w-full items-start gap-3 py-2" onClick={onClick}>
      <span className="mt-0.5 shrink-0 opacity-75">{icon}</span>
      <span className="min-w-0 text-start">
        <span className="block text-[12.5px] font-medium">{label}</span>
        <span className="block text-[11px] leading-snug opacity-60">{hint}</span>
      </span>
    </button>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value?: string; onPick: (color: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`h-5 w-5 rounded border ${value === color ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border-strong)]'}`}
            style={{ background: color === 'transparent' ? 'repeating-conic-gradient(#fff 0% 25%, #ddd 0% 50%) 50% / 6px 6px' : color }}
            onClick={() => onPick(color)}
            aria-label={color}
          />
        ))}
      </div>
    </Field>
  );
}

function LayoutMenu({ value, onPick }: { value: string; onPick: (layout: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useT();
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  const layouts = [
    { id: 'blank', label: t('ppt.layoutBlank') },
    { id: 'title', label: t('ppt.layoutTitle') },
    { id: 'title-content', label: t('ppt.layoutTitleContent') },
    { id: 'two-column', label: t('ppt.layoutTwo') },
    { id: 'section', label: t('ppt.layoutSection') },
  ];
  return (
    <div className="relative" ref={ref}>
      <ToolButton icon={<LayoutTemplate size={15} />} label={t('ppt.layout')} active={open} onClick={() => setOpen((state) => !state)} />
      {open ? (
        <div className="panel absolute start-0 top-full z-40 mt-1 w-48 p-1">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              type="button"
              className="list-row w-full justify-between"
              onClick={() => {
                onPick(layout.id);
                setOpen(false);
              }}
            >
              {layout.label}
              {value === layout.id ? <span className="text-[var(--accent)]">●</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SlideThumb({
  slide,
  index,
  active,
  dragging,
  onSelect,
  onDragStart,
  onDrop,
  onMenu,
}: {
  slide: Slide;
  index: number;
  active: boolean;
  dragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onMenu: (event: React.MouseEvent) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void drawSlide(canvas, slide, 148);
  }, [slide]);

  return (
    <div
      className={`relative cursor-pointer overflow-hidden rounded-md border-2 transition ${active ? 'border-[var(--accent)]' : 'border-[var(--border)] hover:border-[var(--accent-soft)]'} ${dragging ? 'opacity-40' : ''}`}
      onPointerDown={onSelect}
      onContextMenu={onMenu}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: '16 / 9' }} />
      <span className="absolute bottom-0.5 end-1 rounded bg-black/55 px-1 text-[9.5px] font-semibold text-white">{index + 1}</span>
    </div>
  );
}

function ElementView({
  element,
  selected,
  editing,
  onSelect,
  onStartEdit,
  onEndEdit,
  onDragStart,
  onMenu,
}: {
  element: SlideElement;
  selected: boolean;
  editing: boolean;
  scale: number;
  onSelect: () => void;
  onStartEdit: () => void;
  onEndEdit: (text: string) => void;
  onDragStart: (event: React.PointerEvent, handle: Handle | null) => void;
  onMenu: (event: React.MouseEvent) => void;
}) {
  const [draft, setDraft] = useState(element.text ?? '');
  useEffect(() => setDraft(element.text ?? ''), [element.text, editing]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    cursor: editing ? 'text' : 'move',
  };

  const textStyle: React.CSSProperties = {
    fontFamily: `${element.fontFamily ?? 'Segoe UI'}, sans-serif`,
    fontSize: element.fontSize ?? 18,
    color: element.color ?? '#0f172a',
    fontWeight: element.bold ? 700 : 400,
    textAlign: element.align ?? 'left',
    lineHeight: 1.25,
  };

  const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  return (
    <div
      style={style}
      onPointerDown={(event) => {
        onSelect();
        onDragStart(event, null);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (element.type === 'text' || element.type === 'title') onStartEdit();
      }}
      onContextMenu={onMenu}
      className={selected ? 'outline outline-1 outline-[var(--accent)]' : 'hover:outline hover:outline-1 hover:outline-white/40'}
    >
      {element.type === 'image' && element.src ? (
        <img src={element.src} alt="" draggable={false} className="h-full w-full object-contain" style={{ pointerEvents: 'none' }} />
      ) : null}

      {element.type === 'shape' ? (
        <div
          className="h-full w-full"
          style={{
            background: element.fill ?? 'transparent',
            border: element.stroke ? `${element.strokeWidth ?? 2}px solid ${element.stroke}` : undefined,
            borderRadius: element.shape === 'ellipse' ? '50%' : element.shape === 'triangle' ? 0 : 2,
            clipPath: element.shape === 'triangle' ? 'polygon(50% 0%, 100% 100%, 0% 100%)' : element.shape === 'line' ? 'inset(48% 0 48% 0)' : undefined,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {element.type === 'text' || element.type === 'title' ? (
        editing ? (
          <textarea
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => onEndEdit(draft)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') onEndEdit(draft);
            }}
            className="h-full w-full resize-none border border-[var(--accent)] bg-white/80 p-1 outline-none"
            style={textStyle}
          />
        ) : (
          <div className="h-full w-full overflow-hidden whitespace-pre-wrap p-1" style={textStyle}>
            {element.text}
          </div>
        )
      ) : null}

      {selected && !editing ? (
        <>
          {handles.map((handle) => (
            <span
              key={handle}
              className="absolute h-2.5 w-2.5 rounded-[2px] border border-[var(--accent)] bg-white"
              style={{
                left: handle.includes('w') ? -5 : handle.includes('e') ? undefined : '50%',
                right: handle.includes('e') ? -5 : undefined,
                top: handle.includes('n') ? -5 : handle.includes('s') ? undefined : '50%',
                bottom: handle.includes('s') ? -5 : undefined,
                transform: handle === 'n' || handle === 's' ? 'translateX(-50%)' : handle === 'e' || handle === 'w' ? 'translateY(-50%)' : undefined,
                cursor: `${handle}-resize`,
              }}
              onPointerDown={(event) => onDragStart(event, handle)}
            />
          ))}
          <span
            className="absolute left-1/2 -top-6 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border border-[var(--accent)] bg-white"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onPointerDown={(event) => onDragStart(event, 'rotate')}
            title="Rotate"
          >
            <RotateCw size={9} className="text-[var(--accent)]" />
          </span>
        </>
      ) : null}
    </div>
  );
}

function SlideshowStage({ slide }: { slide?: Slide }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 960, height: 540 });
  useEffect(() => {
    const compute = () => {
      const ratio = SLIDE_WIDTH / SLIDE_HEIGHT;
      const width = Math.min(window.innerWidth, (window.innerHeight - 44) * ratio);
      setSize({ width, height: width / ratio });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && slide) void drawSlide(canvas, slide, size.width);
  }, [slide, size.width]);

  return (
    <div className="flex flex-1 items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} style={{ width: size.width, height: size.height }} className="shadow-2xl" />
    </div>
  );
}

export default PowerPointApp;
