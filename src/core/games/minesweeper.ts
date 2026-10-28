/**
 * Minesweeper — pure, immutable board logic so the UI stays thin and the
 * rules are unit-testable. Mines are placed after the first reveal, which
 * guarantees the opening click (and its neighbourhood) is always safe.
 */

export interface MineCell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
}

export type MineStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface MineBoard {
  rows: number;
  cols: number;
  mines: number;
  cells: MineCell[];
  status: MineStatus;
  /** Epoch ms of the first reveal; null until then. */
  startedAt: number | null;
}

export interface Difficulty {
  id: 'beginner' | 'intermediate' | 'expert';
  rows: number;
  cols: number;
  mines: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'beginner', rows: 9, cols: 9, mines: 10 },
  { id: 'intermediate', rows: 16, cols: 16, mines: 40 },
  { id: 'expert', rows: 16, cols: 30, mines: 99 },
];

/** Deterministic PRNG (mulberry32) so tests can pin the mine layout. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBoard(rows: number, cols: number, mines: number): MineBoard {
  const clamped = Math.max(1, Math.min(mines, rows * cols - 9));
  return {
    rows,
    cols,
    mines: clamped,
    status: 'ready',
    startedAt: null,
    cells: Array.from({ length: rows * cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 })),
  };
}

export function neighboursOf(board: MineBoard, index: number): number[] {
  const row = Math.floor(index / board.cols);
  const col = index % board.cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < board.rows && c >= 0 && c < board.cols) out.push(r * board.cols + c);
    }
  }
  return out;
}

function withMines(board: MineBoard, safeIndex: number, rng: () => number): MineBoard {
  const forbidden = new Set([safeIndex, ...neighboursOf(board, safeIndex)]);
  const candidates: number[] = [];
  for (let i = 0; i < board.cells.length; i += 1) {
    if (!forbidden.has(i)) candidates.push(i);
  }
  // Fisher–Yates partial shuffle, then take the first N candidates.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const mineSet = new Set(candidates.slice(0, board.mines));
  const cells = board.cells.map((cell, i) => ({ ...cell, mine: mineSet.has(i) }));
  const withCounts = cells.map((cell, i) => ({
    ...cell,
    adjacent: mineSet.has(i) ? 0 : neighboursOf(board, i).filter((n) => cells[n].mine).length,
  }));
  return { ...board, cells: withCounts };
}

function revealFlood(board: MineBoard, startIndex: number): MineBoard {
  const cells = board.cells.map((cell) => ({ ...cell }));
  const stack = [startIndex];
  while (stack.length) {
    const index = stack.pop() as number;
    const cell = cells[index];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.adjacent === 0 && !cell.mine) {
      for (const n of neighboursOf(board, index)) {
        if (!cells[n].revealed && !cells[n].mine) stack.push(n);
      }
    }
  }
  return { ...board, cells };
}

export function isWin(board: MineBoard): boolean {
  return board.cells.every((cell) => cell.mine || cell.revealed);
}

export function reveal(board: MineBoard, index: number, rng: () => number = Math.random, now: number = Date.now()): MineBoard {
  if (board.status === 'won' || board.status === 'lost') return board;
  const cell = board.cells[index];
  if (!cell || cell.revealed || cell.flagged) return board;

  let next = board;
  if (next.status === 'ready') {
    next = withMines(next, index, rng);
    next = { ...next, status: 'playing', startedAt: now };
  }
  if (next.cells[index].mine) {
    return {
      ...next,
      status: 'lost',
      cells: next.cells.map((item) => (item.mine ? { ...item, revealed: true } : item)),
    };
  }
  next = revealFlood(next, index);
  if (isWin(next)) return { ...next, status: 'won' };
  return next;
}

export function toggleFlag(board: MineBoard, index: number): MineBoard {
  if (board.status === 'won' || board.status === 'lost') return board;
  const cell = board.cells[index];
  if (!cell || cell.revealed) return board;
  const cells = board.cells.map((item, i) => (i === index ? { ...item, flagged: !item.flagged } : item));
  return { ...board, cells };
}

/** Reveal every unflagged neighbour when the flag count matches the number. */
export function chord(board: MineBoard, index: number, rng: () => number = Math.random): MineBoard {
  if (board.status !== 'playing') return board;
  const cell = board.cells[index];
  if (!cell?.revealed || cell.adjacent === 0) return board;
  const around = neighboursOf(board, index);
  const flags = around.filter((n) => board.cells[n].flagged).length;
  if (flags !== cell.adjacent) return board;
  let next = board;
  for (const n of around) {
    if (!next.cells[n].flagged && !next.cells[n].revealed) next = reveal(next, n, rng);
  }
  return next;
}

export function flagsLeft(board: MineBoard): number {
  return board.mines - board.cells.filter((cell) => cell.flagged).length;
}
