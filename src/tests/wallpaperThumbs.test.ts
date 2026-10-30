import { describe, expect, it } from 'vitest';
import { WALLPAPERS, getWallpaper, registerCustomWallpaper } from '../data/wallpapers';

/** Thumbnails are painted with CSS background-image: url(...) which breaks on
 *  raw parentheses/quotes — the encoded data URIs must not contain any. */
describe('wallpaper data URIs', () => {
  it('encode every character that would break an unquoted CSS url()', () => {
    for (const wallpaper of WALLPAPERS) {
      const payload = wallpaper.url.slice(wallpaper.url.indexOf(',') + 1);
      expect(payload, wallpaper.id).not.toMatch(/[()'"]/);
      expect(wallpaper.url.length).toBeGreaterThan(50);
    }
  });

  it('still decodes back to a valid SVG document', () => {
    for (const wallpaper of WALLPAPERS.slice(0, 4)) {
      const decoded = decodeURIComponent(wallpaper.url.slice(wallpaper.url.indexOf(',') + 1));
      expect(decoded.startsWith('<svg')).toBe(true);
      expect(decoded.endsWith('</svg>')).toBe(true);
    }
  });

  it('keeps custom (base64) wallpapers safe too', () => {
    const custom = registerCustomWallpaper('thumb-test', 'data:image/png;base64,iVBORw0KGgo=', 'Thumb test');
    expect(custom.url).not.toMatch(/[()]/);
    expect(getWallpaper('thumb-test').id).toBe('thumb-test');
  });

  it('resolves the dynamic wallpaper for every part of the day', () => {
    for (const hour of [2, 8, 13, 19]) {
      expect(getWallpaper('auto', new Date(2026, 3, 4, hour, 0)).url).toContain('data:image/svg+xml');
    }
  });
});
