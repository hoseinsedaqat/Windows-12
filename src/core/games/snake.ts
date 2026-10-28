/** Snake — pure step function; the UI only renders state and feeds input. */

export interface Point {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface SnakeState {
  grid: number;
  snake: Point[];
  dir: Direction;
  queued: Direction | null;
  food: Point;
  score: number;
  status: 'idle' | 'running' | 'paused' | 'over';
  /** ms per tick; shrinks as the snake grows. */
  speed: number;
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function spawnFood(grid: number, snake: Point[], rng: () => number): Point {
  const taken = new Set(snake.map((p) => `${p.x}:${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      if (!taken.has(`${x}:${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: -1, y: -1 };
  return free[Math.floor(rng() * free.length)];
}

export function createSnake(grid = 20, rng: () => number = Math.random): SnakeState {
  const mid = Math.floor(grid / 2);
  const snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return { grid, snake, dir: 'right', queued: null, food: spawnFood(grid, snake, rng), score: 0, status: 'idle', speed: 150 };
}

export function steer(state: SnakeState, dir: Direction): SnakeState {
  if (state.status === 'over') return state;
  if (OPPOSITE[dir] === state.dir || dir === state.dir) return state;
  return { ...state, queued: dir };
}

export function step(state: SnakeState, rng: () => number = Math.random): SnakeState {
  if (state.status !== 'running') return state;
  const dir = state.queued ?? state.dir;
  const head = state.snake[0];
  const delta = DELTA[dir];
  const next: Point = { x: head.x + delta.x, y: head.y + delta.y };

  if (next.x < 0 || next.y < 0 || next.x >= state.grid || next.y >= state.grid) {
    return { ...state, dir, queued: null, status: 'over' };
  }
  const ate = next.x === state.food.x && next.y === state.food.y;
  const body = ate ? state.snake : state.snake.slice(0, -1);
  if (body.some((p) => p.x === next.x && p.y === next.y)) {
    return { ...state, dir, queued: null, status: 'over' };
  }
  const snake = [next, ...body];
  if (!ate) return { ...state, snake, dir, queued: null };
  const score = state.score + 10;
  return {
    ...state,
    snake,
    dir,
    queued: null,
    score,
    food: spawnFood(state.grid, snake, rng),
    speed: Math.max(70, state.speed - 3),
  };
}

export function togglePause(state: SnakeState): SnakeState {
  if (state.status === 'running') return { ...state, status: 'paused' };
  if (state.status === 'paused' || state.status === 'idle') return { ...state, status: 'running' };
  return state;
}
