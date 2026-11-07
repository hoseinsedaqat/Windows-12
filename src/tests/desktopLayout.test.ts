import { describe, expect, it } from 'vitest';
import { autoSlots, layoutDesktopIcons, type DesktopArea, type IconMetrics } from '../core/desktopLayout';

const MEDIUM: IconMetrics = { cellW: 94, cellH: 102, icon: 38, font: 12 };

const areas: DesktopArea[] = [
  { width: 320, height: 480 },
  { width: 360, height: 688 },
  { width: 768, height: 600 },
  { width: 1280, height: 668 },
  { width: 2560, height: 1348 },
];

const ids = (count: number) => Array.from({ length: count }, (_, i) => `n${i}`);

function visibleCapacity(metrics: IconMetrics, area: DesktopArea): number {
  return autoSlots(10_000, metrics, area).filter((slot) => {
    const maxX = Math.max(4, area.width - metrics.cellW);
    const maxY = Math.max(4, area.height - metrics.cellH);
    return slot.x <= maxX && slot.y <= maxY;
  }).length;
}

/** Non-overlap is unconditional; staying inside the work area is guaranteed
 *  while the visible grid has capacity (like the real desktop, extra icons
 *  continue into off-screen columns instead of stacking on top of each other). */
function expectClean(placed: { id: string; x: number; y: number }[], metrics: IconMetrics, area: DesktopArea) {
  const maxX = Math.max(4, area.width - metrics.cellW);
  const maxY = Math.max(4, area.height - metrics.cellH);
  const capacity = visibleCapacity(metrics, area);
  placed.forEach((icon, index) => {
    expect(Number.isFinite(icon.x)).toBe(true);
    expect(Number.isFinite(icon.y)).toBe(true);
    expect(icon.x).toBeGreaterThanOrEqual(4);
    expect(icon.y).toBeGreaterThanOrEqual(4);
    if (index < capacity) {
      expect(icon.x, `${icon.id} off-screen at ${area.width}x${area.height}`).toBeLessThanOrEqual(maxX);
      expect(icon.y, `${icon.id} off-screen at ${area.width}x${area.height}`).toBeLessThanOrEqual(maxY);
    }
  });
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      const overlaps = Math.abs(a.x - b.x) < metrics.cellW - 6 && Math.abs(a.y - b.y) < metrics.cellH - 6;
      expect(overlaps, `${a.id} overlaps ${b.id} at ${area.width}x${area.height}`).toBe(false);
    }
  }
}

describe('desktop icon layout', () => {
  it('reflows the whole arrangement when one saved position is stale', () => {
    const placed = layoutDesktopIcons(
      [
        { id: 'a', free: { x: 16, y: 16 } },
        { id: 'b', free: { x: 16, y: 16 } },
        { id: 'c', free: { x: 2000, y: 900 } },
      ],
      MEDIUM,
      { width: 800, height: 600 },
    );
    expectClean(placed, MEDIUM, { width: 800, height: 600 });
    expect(placed[0]).toEqual({ id: 'a', x: 12, y: 12 });
  });

  it('keeps seeded free positions when they fit and do not collide', () => {
    const placed = layoutDesktopIcons(
      [
        { id: 'a', free: { x: 16, y: 16 } },
        { id: 'b', free: { x: 128, y: 16 } },
        { id: 'c', free: { x: 16, y: 128 } },
      ],
      MEDIUM,
      { width: 1280, height: 668 },
    );
    expect(placed).toEqual([
      { id: 'a', x: 16, y: 16 },
      { id: 'b', x: 128, y: 16 },
      { id: 'c', x: 16, y: 128 },
    ]);
  });

  it('resolves duplicate saved positions (persisted from another session)', () => {
    const placed = layoutDesktopIcons(
      [
        { id: 'a', free: { x: 128, y: 576 } },
        { id: 'b', free: { x: 128, y: 576 } },
        { id: 'c', free: { x: 130, y: 580 } },
      ],
      MEDIUM,
      { width: 1280, height: 668 },
    );
    expectClean(placed, MEDIUM, { width: 1280, height: 668 });
    expect(new Set(placed.map((icon) => `${icon.x},${icon.y}`)).size).toBe(3);
  });

  it('pulls icons saved on a wide screen back inside a narrow viewport', () => {
    const wide = ids(14).map((id, index) => ({
      id,
      free: { x: 16 + (index % 7) * 112, y: 16 + Math.floor(index / 7) * 112 },
    }));
    for (const area of areas) {
      const placed = layoutDesktopIcons(wide, MEDIUM, area);
      expectClean(placed, MEDIUM, area);
    }
  });

  it('lays out auto mode (no saved positions) cleanly at every size', () => {
    for (const area of areas) {
      for (const count of [1, 8, 14, 40]) {
        const placed = layoutDesktopIcons(ids(count).map((id) => ({ id })), MEDIUM, area);
        expect(placed.length).toBe(count);
        expectClean(placed, MEDIUM, area);
      }
    }
  });

  it('never produces NaN for a not-yet-measured (zero) area', () => {
    const placed = layoutDesktopIcons(ids(6).map((id) => ({ id, free: { x: 900, y: 900 } })), MEDIUM, { width: 0, height: 0 });
    expectClean(placed, MEDIUM, { width: 0, height: 0 });
  });

  it('auto slots stay column-major and deterministic', () => {
    const slots = autoSlots(5, MEDIUM, { width: 1280, height: 668 });
    expect(slots[0]).toEqual({ x: 12, y: 12 });
    expect(slots[1].x).toBe(12);
    expect(slots[1].y).toBe(12 + MEDIUM.cellH);
  });
});
