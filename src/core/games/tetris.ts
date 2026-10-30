/** Tetris — pure engine. The UI renders the state and feeds moves/ticks. */

export type Tetromino = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export const TETRO_COLORS: Record<Tetromino, string> = {
  I: '#22d3ee',
  O: '#facc15',
  T: '#c084fc',
  S: '#4ade80',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c',
};

const SHAPES: Record<Tetromino, number[][][]> = {
  I: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
  O: [
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
  ],
  T: [
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]],
  ],
  S: [
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
    [[0,0,0],[0,1,1],[1,1,0]],
    [[1,0,0],[1,1,0],[0,1,0]],
  ],
  Z: [
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,0,0]],
  ],
  J: [
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]],
  ],
  L: [
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]],
  ],
};

export interface TetrisPiece {
  type: Tetromino;
  x: number;
  y: number;
  rot: number;
}

export interface TetrisState {
  cols: number;
  rows: number;
  board: (Tetromino | null)[][];
  current: TetrisPiece | null;
  next: Tetromino;
  score: number;
  lines: number;
  level: number;
  status: 'idle' | 'running' | 'paused' | 'over';
  seed: number;
}

export function shapeOf(piece: TetrisPiece): number[][] {
  return SHAPES[piece.type][piece.rot % 4];
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomType(seed: number): { type: Tetromino; seed: number } {
  const random = mulberry32(seed);
  const types: Tetromino[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  return { type: types[Math.floor(random() * types.length)], seed: seed + 1 };
}

export function createTetris(seed = Date.now()): TetrisState {
  const rows = 20;
  const cols = 10;
  const board = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null as Tetromino | null));
  const first = randomType(seed);
  const second = randomType(first.seed * 7919 + 13);
  return {
    cols,
    rows,
    board,
    current: null,
    next: second.type,
    score: 0,
    lines: 0,
    level: 1,
    status: 'idle',
    seed: first.seed,

  };
}

function spawn(state: TetrisState): TetrisState {
  const type = state.next;
  const picked = randomType(state.seed);
  const piece: TetrisPiece = { type, x: Math.floor((state.cols - shapeOf({ type, x: 0, y: 0, rot: 0 }).length) / 2), y: 0, rot: 0 };
  const next = { ...state, current: piece, next: picked.type, seed: picked.seed };
  if (collides(next.board, piece)) return { ...next, status: 'over', current: null };
  return next;
}

export function startTetris(state: TetrisState): TetrisState {
  const fresh: TetrisState = { ...createTetris(state.seed), status: 'running' };
  return spawn(fresh);
}

export function collides(board: (Tetromino | null)[][], piece: TetrisPiece): boolean {
  const shape = shapeOf(piece);
  for (let row = 0; row < shape.length; row += 1) {
    for (let col = 0; col < shape[row].length; col += 1) {
      if (!shape[row][col]) continue;
      const y = piece.y + row;
      const x = piece.x + col;
      if (x < 0 || x >= board[0].length || y >= board.length) return true;
      if (y >= 0 && board[y][x]) return true;
    }
  }
  return false;
}

export function movePiece(state: TetrisState, dx: number, dy: number): TetrisState {
  if (!state.current || state.status !== 'running') return state;
  const moved = { ...state.current, x: state.current.x + dx, y: state.current.y + dy };
  if (collides(state.board, moved)) return state;
  return { ...state, current: moved };
}

export function rotatePiece(state: TetrisState, direction: 1 | -1 = 1): TetrisState {
  if (!state.current || state.status !== 'running') return state;
  const base = state.current;
  for (const kick of [0, -1, 1, -2, 2]) {
    const candidate = { ...base, rot: (base.rot + direction + 4) % 4, x: base.x + kick };
    if (!collides(state.board, candidate)) return { ...state, current: candidate };
  }
  return state;
}

export function hardDrop(state: TetrisState): TetrisState {
  if (!state.current || state.status !== 'running') return state;
  let dropped = state;
  let distance = 0;
  while (true) {
    const next = movePiece(dropped, 0, 1);
    if (next === dropped) break;
    dropped = next;
    distance += 1;
  }
  return lockPiece({ ...dropped, score: dropped.score + distance * 2 });
}

function lockPiece(state: TetrisState): TetrisState {
  if (!state.current) return state;
  const board = state.board.map((row) => [...row]);
  const shape = shapeOf(state.current);
  for (let row = 0; row < shape.length; row += 1) {
    for (let col = 0; col < shape[row].length; col += 1) {
      if (!shape[row][col]) continue;
      const y = state.current.y + row;
      const x = state.current.x + col;
      if (y >= 0 && y < board.length) board[y][x] = state.current.type;
    }
  }
  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const cleared = board.length - remaining.length;
  const filled = Array.from({ length: cleared }, () => Array.from({ length: state.cols }, () => null as Tetromino | null));
  const nextBoard = [...filled, ...remaining];
  const points = [0, 100, 300, 500, 800][cleared] * state.level;
  const lines = state.lines + cleared;
  const level = Math.floor(lines / 10) + 1;
  const after: TetrisState = { ...state, board: nextBoard, current: null, score: state.score + points, lines, level };
  return spawn(after);
}

/** One gravity tick. Returns the updated state. */
export function tickTetris(state: TetrisState): TetrisState {
  if (state.status !== 'running' || !state.current) return state;
  const moved = movePiece(state, 0, 1);
  if (moved !== state) return moved;
  return lockPiece(state);
}

export function tickInterval(level: number): number {
  return Math.max(90, 800 - (level - 1) * 70);
}

/** Cells to render, including the ghost projection of the current piece. */
export function ghostPiece(state: TetrisState): TetrisPiece | null {
  if (!state.current) return null;
  let ghost = state.current;
  while (true) {
    const next = { ...ghost, y: ghost.y + 1 };
    if (collides(state.board, next)) return ghost;
    ghost = next;
  }
}
