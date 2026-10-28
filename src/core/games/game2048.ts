/** 2048 — pure board transformations on a flat 16-cell row-major array. */

export type Board2048 = number[]; // 16 cells, 0 = empty
export type Move2048 = 'left' | 'right' | 'up' | 'down';

export function emptyBoard(): Board2048 {
  return Array.from({ length: 16 }, () => 0);
}

export function addRandom(board: Board2048, rng: () => number): Board2048 {
  const free = board.map((value, index) => (value === 0 ? index : -1)).filter((index) => index >= 0);
  if (free.length === 0) return board;
  const index = free[Math.floor(rng() * free.length)];
  const next = [...board];
  next[index] = rng() < 0.9 ? 2 : 4;
  return next;
}

export function create2048(rng: () => number = Math.random): Board2048 {
  return addRandom(addRandom(emptyBoard(), rng), rng);
}

function slideLine(line: number[]): { line: number[]; score: number } {
  const values = line.filter((value) => value !== 0);
  const out: number[] = [];
  let score = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i + 1] === values[i]) {
      const merged = values[i] * 2;
      out.push(merged);
      score += merged;
      i += 1;
    } else {
      out.push(values[i]);
    }
  }
  while (out.length < 4) out.push(0);
  return { line: out, score };
}

function linesFor(board: Board2048, dir: Move2048): number[][] {
  const lines: number[][] = [];
  for (let i = 0; i < 4; i += 1) {
    if (dir === 'left' || dir === 'right') {
      lines.push([0, 1, 2, 3].map((c) => board[i * 4 + c]));
    } else {
      lines.push([0, 1, 2, 3].map((r) => board[r * 4 + i]));
    }
  }
  if (dir === 'right' || dir === 'down') return lines.map((line) => [...line].reverse());
  return lines;
}

function fromLines(lines: number[][], dir: Move2048): Board2048 {
  const prepared = dir === 'right' || dir === 'down' ? lines.map((line) => [...line].reverse()) : lines;
  const board = emptyBoard();
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      if (dir === 'left' || dir === 'right') board[i * 4 + j] = prepared[i][j];
      else board[j * 4 + i] = prepared[i][j];
    }
  }
  return board;
}

export function move(board: Board2048, dir: Move2048, rng: () => number = Math.random): { board: Board2048; score: number; moved: boolean } {
  const lines = linesFor(board, dir);
  let score = 0;
  const slid = lines.map((line) => {
    const result = slideLine(line);
    score += result.score;
    return result.line;
  });
  const movedBoard = fromLines(slid, dir);
  const moved = movedBoard.some((value, index) => value !== board[index]);
  if (!moved) return { board, score: 0, moved: false };
  return { board: addRandom(movedBoard, rng), score, moved: true };
}

export function canMove(board: Board2048): boolean {
  if (board.some((value) => value === 0)) return true;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const value = board[r * 4 + c];
      if (c < 3 && board[r * 4 + c + 1] === value) return true;
      if (r < 3 && board[(r + 1) * 4 + c] === value) return true;
    }
  }
  return false;
}

export function highestTile(board: Board2048): number {
  return board.reduce((max, value) => Math.max(max, value), 0);
}
