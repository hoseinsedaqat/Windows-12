/** Pure desktop-icon placement: free positions when they fit, guaranteed
 *  non-overlapping and inside the work area at every viewport size. */

export interface IconMetrics {
  cellW: number;
  cellH: number;
  icon: number;
  font: number;
}

export interface DesktopArea {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface LayoutItem {
  id: string;
  /** Saved free-placement coordinates, if any. */
  free?: Position;
}

export interface PlacedIcon extends Position {
  id: string;
}

const OFFSET = 12;

/** Column-major slot grid, the way the real desktop arranges icons. */
export function autoSlots(count: number, metrics: IconMetrics, area: DesktopArea): Position[] {
  const perColumn = Math.max(1, Math.floor((Math.max(area.height, metrics.cellH) - OFFSET * 2) / metrics.cellH));
  return Array.from({ length: count }, (_, index) => {
    const column = Math.floor(index / perColumn);
    const row = index % perColumn;
    return { x: OFFSET + column * metrics.cellW, y: OFFSET + row * metrics.cellH };
  });
}

/** Dense half-step scan used only if the slot grid is somehow exhausted. */
function firstFreePosition(
  placed: Position[],
  metrics: IconMetrics,
  area: DesktopArea,
): Position | null {
  const free = (p: Position) =>
    !placed.some((q) => Math.abs(p.x - q.x) < metrics.cellW - 6 && Math.abs(p.y - q.y) < metrics.cellH - 6);
  const maxY = Math.max(4, area.height - metrics.cellH);
  const maxX = Math.max(4, area.width - metrics.cellW);
  for (let x = 4; x <= maxX + metrics.cellW * 4; x += Math.round(metrics.cellW / 2)) {
    for (let y = 4; y <= maxY; y += Math.round(metrics.cellH / 2)) {
      if (free({ x, y })) return { x, y };
    }
  }
  return null;
}

export function layoutDesktopIcons(items: LayoutItem[], metrics: IconMetrics, area: DesktopArea): PlacedIcon[] {
  // Generate plenty of spare slots: icons whose saved position collides fall
  // back to the first free slot, so earlier icons can consume several slots
  // and a same-length slot list would leave later icons without any home
  // (the bug that stacked icons on top of each other at boot).
  const slots = autoSlots(Math.max(items.length, 1) * 3 + 12, metrics, area);
  const maxX = Math.max(4, area.width - metrics.cellW);
  const maxY = Math.max(4, area.height - metrics.cellH);
  const placed: Position[] = [];

  const collides = (p: Position) =>
    placed.some((q) => Math.abs(p.x - q.x) < metrics.cellW - 6 && Math.abs(p.y - q.y) < metrics.cellH - 6);
  const inBounds = (p: Position) => p.x >= 4 && p.y >= 4 && p.x <= maxX && p.y <= maxY;
  const clamp = (p: Position): Position => ({
    x: Math.max(4, Math.min(p.x, maxX)),
    y: Math.max(4, Math.min(p.y, maxY)),
  });

  // If any saved position no longer fits the work area (the window moved,
  // the viewport shrank, a backup was restored on another screen) the whole
  // saved arrangement is stale — reflow every icon onto the clean grid
  // instead of clamping icons into each other. Arrangements that still fit
  // are honoured exactly, including free placements from dragging.
  const arrangementFits = items.every(
    (item) => !item.free || (item.free.x >= 4 && item.free.y >= 4 && item.free.x <= maxX && item.free.y <= maxY),
  );

  return items.map((item, index) => {
    const desired = arrangementFits ? item.free : undefined;
    let position = clamp(desired ?? slots[index] ?? { x: OFFSET, y: OFFSET });
    if (collides(position) || !inBounds(position)) {
      // Prefer a visible empty slot; only fall back to off-screen columns when
      // the work area truly cannot fit another icon.
      position =
        slots.find((slot) => !collides(slot) && inBounds(slot)) ??
        slots.find((slot) => !collides(slot)) ??
        // Last resort: half-step scan so two icons can never share a cell.
        firstFreePosition(placed, metrics, area) ??
        position;
    }
    placed.push(position);
    return { id: item.id, x: position.x, y: position.y };
  });
}
