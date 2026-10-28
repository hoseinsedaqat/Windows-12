/** A1-style cell reference helpers shared by the grid UI and the formula engine. */

/** Sheet limits shared by the grid, the engine and the fill/shift helpers. */
export const MAX_ROWS = 1000;
export const MAX_COLS = 100;

export interface CellRef {
  col: number; // 1-based
  row: number; // 1-based
}

export function colToLetter(col: number): string {
  let value = col;
  let result = '';
  while (value > 0) {
    const rem = (value - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    value = Math.floor((value - rem) / 26);
  }
  return result;
}

export function letterToCol(letters: string): number {
  let value = 0;
  for (const char of letters.toUpperCase()) {
    if (char < 'A' || char > 'Z') return 0;
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value;
}

export function refToKey(ref: CellRef): string {
  return `${colToLetter(ref.col)}${ref.row}`;
}

export function keyToRef(key: string): CellRef | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(key.trim());
  if (!match) return null;
  return { col: letterToCol(match[1]), row: Number(match[2]) };
}

export function isValidKey(key: string): boolean {
  return keyToRef(key) !== null;
}

export function compareRefs(a: CellRef, b: CellRef): number {
  if (a.col !== b.col) return a.col - b.col;
  return a.row - b.row;
}

export function expandRange(start: CellRef, end: CellRef): CellRef[] {
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const cells: CellRef[] = [];
  for (let col = minCol; col <= maxCol; col += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      cells.push({ col, row });
    }
  }
  return cells;
}

export function rangeKey(start: CellRef, end: CellRef): string {
  const a = refToKey(start);
  const b = refToKey(end);
  return a === b ? a : `${a}:${b}`;
}

export function shiftKey(key: string, rowDelta: number, colDelta: number): string | null {
  const ref = keyToRef(key);
  if (!ref) return null;
  const row = ref.row + rowDelta;
  const col = ref.col + colDelta;
  if (row < 1 || col < 1 || row > MAX_ROWS || col > MAX_COLS) return null;
  return refToKey({ row, col });
}

