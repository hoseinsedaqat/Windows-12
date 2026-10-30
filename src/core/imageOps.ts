/** Pure image-edit helpers shared by the Photos app (rotate/flip/filter/crop). */

export type ImageFilter = 'none' | 'grayscale' | 'sepia' | 'invert' | 'bright';

export const FILTER_CSS: Record<ImageFilter, string> = {
  none: 'none',
  grayscale: 'grayscale(1)',
  sepia: 'sepia(0.85)',
  invert: 'invert(1)',
  bright: 'brightness(1.25) saturate(1.2)',
};

export interface EditOptions {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  filter: ImageFilter;
  /** crop rect in natural image pixels; null = whole image */
  crop: { x: number; y: number; w: number; h: number } | null;
}

export const NO_EDITS: EditOptions = { rotation: 0, flipH: false, flipV: false, filter: 'none', crop: null };

export function nextRotation(current: number, direction: 1 | -1): number {
  return (current + direction * 90 + 720) % 360;
}

export function editedFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name}-edited.png`;
  return `${name.slice(0, dot)}-edited.png`;
}

export function clampCrop(crop: { x: number; y: number; w: number; h: number }, imageWidth: number, imageHeight: number, min = 16) {
  const w = Math.max(min, Math.min(crop.w, imageWidth));
  const h = Math.max(min, Math.min(crop.h, imageHeight));
  const x = Math.max(0, Math.min(crop.x, imageWidth - w));
  const y = Math.max(0, Math.min(crop.y, imageHeight - h));
  return { x, y, w, h };
}

export function isEdited(options: EditOptions): boolean {
  return options.rotation !== 0 || options.flipH || options.flipV || options.filter !== 'none' || options.crop !== null;
}

/** Renders the edited image into a canvas and returns a PNG data URL. */
export function renderEditedImage(image: HTMLImageElement, options: EditOptions): string {
  const source = options.crop ?? { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
  const rotated = options.rotation % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = rotated ? source.h : source.w;
  canvas.height = rotated ? source.w : source.h;
  const context = canvas.getContext('2d');
  if (!context) return image.src;
  context.filter = FILTER_CSS[options.filter];
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((options.rotation * Math.PI) / 180);
  context.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
  context.drawImage(image, source.x, source.y, source.w, source.h, -source.w / 2, -source.h / 2, source.w, source.h);
  return canvas.toDataURL('image/png');
}
