import type { Slide, SlideElement } from '../../types';

/** Slide canvas size used by the model (960×540 = 16:9). */
export const SLIDE_WIDTH = 960;
export const SLIDE_HEIGHT = 540;

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

/** Draws one slide onto a canvas — used for thumbnails and PNG export. */
export async function drawSlide(canvas: HTMLCanvasElement, slide: Slide, width = SLIDE_WIDTH): Promise<void> {
  const scale = width / SLIDE_WIDTH;
  canvas.width = Math.round(SLIDE_WIDTH * scale);
  canvas.height = Math.round(SLIDE_HEIGHT * scale);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.save();
  context.scale(scale, scale);
  context.fillStyle = slide.background ?? '#ffffff';
  context.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

  for (const element of slide.elements) {
    await drawElement(context, element);
  }
  context.restore();
}

async function drawElement(context: CanvasRenderingContext2D, element: SlideElement): Promise<void> {
  context.save();
  if (element.rotation) {
    context.translate(element.x + element.w / 2, element.y + element.h / 2);
    context.rotate((element.rotation * Math.PI) / 180);
    context.translate(-(element.x + element.w / 2), -(element.y + element.h / 2));
  }

  if (element.type === 'image' && element.src) {
    const image = await loadImage(element.src);
    if (image) {
      context.drawImage(image, element.x, element.y, element.w, element.h);
    } else {
      context.fillStyle = '#e2e8f0';
      context.fillRect(element.x, element.y, element.w, element.h);
      context.fillStyle = '#64748b';
      context.font = '14px Segoe UI, sans-serif';
      context.textAlign = 'center';
      context.fillText('image unavailable', element.x + element.w / 2, element.y + element.h / 2);
    }
    context.restore();
    return;
  }

  if (element.type === 'shape') {
    const { x, y, w, h } = element;
    context.beginPath();
    if (element.shape === 'ellipse') context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (element.shape === 'triangle') {
      context.moveTo(x + w / 2, y);
      context.lineTo(x + w, y + h);
      context.lineTo(x, y + h);
      context.closePath();
    } else if (element.shape === 'line') {
      context.moveTo(x, y + h / 2);
      context.lineTo(x + w, y + h / 2);
    } else context.rect(x, y, w, h);
    if (element.fill && element.shape !== 'line') {
      context.fillStyle = element.fill;
      context.fill();
    }
    if (element.stroke) {
      context.strokeStyle = element.stroke;
      context.lineWidth = element.strokeWidth ?? 2;
      context.stroke();
    }
    context.restore();
    return;
  }

  // Text / title
  const size = element.fontSize ?? (element.type === 'title' ? 40 : 18);
  const weight = element.bold || element.type === 'title' ? 700 : 400;
  context.font = `${weight} ${size}px ${element.fontFamily ?? 'Segoe UI'}, sans-serif`;
  context.fillStyle = element.color ?? '#0f172a';
  context.textBaseline = 'top';
  context.textAlign = (element.align ?? 'left') as CanvasTextAlign;
  const lines = wrapText(context, element.text ?? '', element.w);
  const lineHeight = size * 1.25;
  const anchorX = element.align === 'center' ? element.x + element.w / 2 : element.align === 'right' ? element.x + element.w : element.x;
  lines.forEach((line, index) => {
    context.fillText(line, anchorX, element.y + index * lineHeight);
  });
  context.restore();
}

export async function slideToCanvas(slide: Slide, width = SLIDE_WIDTH): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  await drawSlide(canvas, slide, width);
  return canvas;
}

export async function slideToBlob(slide: Slide, width = SLIDE_WIDTH): Promise<Blob | null> {
  const canvas = await slideToCanvas(slide, width);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/** Layout presets: where new elements land for each slide layout. */
export const LAYOUT_PRESETS: Record<string, { x: number; y: number; w: number; h: number; type: 'title' | 'text' }[]> = {
  blank: [],
  title: [
    { type: 'title', x: 90, y: 190, w: 780, h: 90 },
    { type: 'text', x: 90, y: 300, w: 780, h: 60 },
  ],
  'title-content': [
    { type: 'title', x: 60, y: 40, w: 840, h: 70 },
    { type: 'text', x: 60, y: 140, w: 840, h: 340 },
  ],
  'two-column': [
    { type: 'title', x: 60, y: 40, w: 840, h: 70 },
    { type: 'text', x: 60, y: 140, w: 400, h: 340 },
    { type: 'text', x: 500, y: 140, w: 400, h: 340 },
  ],
  section: [
    { type: 'title', x: 90, y: 230, w: 780, h: 80 },
    { type: 'text', x: 90, y: 320, w: 780, h: 50 },
  ],
};

export const TEMPLATE_BACKGROUNDS: { id: string; name: string; background: string; titleColor: string; bodyColor: string }[] = [
  { id: 'paper', name: 'Paper', background: '#ffffff', titleColor: '#0f172a', bodyColor: '#334155' },
  { id: 'night', name: 'Night', background: '#0b1020', titleColor: '#e2e8f0', bodyColor: '#94a3b8' },
  { id: 'aurora', name: 'Aurora', background: '#052e2b', titleColor: '#a7f3d0', bodyColor: '#6ee7b7' },
  { id: 'sunset', name: 'Sunset', background: '#2b1220', titleColor: '#fda4af', bodyColor: '#fecdd3' },
  { id: 'sand', name: 'Sand', background: '#f8f4ec', titleColor: '#7c5b2a', bodyColor: '#8a7355' },
  { id: 'steel', name: 'Steel', background: '#111827', titleColor: '#93c5fd', bodyColor: '#cbd5e1' },
];
