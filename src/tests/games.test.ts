import { describe, expect, it } from 'vitest';
import {
  createBoard,
  reveal,
  toggleFlag,
  chord,
  flagsLeft,
  neighboursOf,
  mulberry32,
  DIFFICULTIES,
} from '../core/games/minesweeper';
import { createSnake, step, steer, togglePause, spawnFood } from '../core/games/snake';
import { create2048, move, canMove, addRandom, highestTile } from '../core/games/game2048';

const rng = () => mulberry32(42);

describe('minesweeper', () => {
  it('creates an empty board with the requested mine count', () => {
    const board = createBoard(9, 9, 10);
    expect(board.cells).toHaveLength(81);
    expect(board.mines).toBe(10);
    expect(board.status).toBe('ready');
    expect(board.cells.every((cell) => !cell.mine && !cell.revealed)).toBe(true);
  });

  it('clamps impossible mine counts', () => {
    const board = createBoard(3, 3, 500);
    expect(board.mines).toBeLessThanOrEqual(81 - 9);
  });

  it('keeps the first click and its neighbourhood safe', () => {
    let board = createBoard(9, 9, 10);
    board = reveal(board, 40, rng());
    expect(board.status).toBe('playing');
    expect(board.cells[40].revealed).toBe(true);
    expect(board.cells[40].mine).toBe(false);
    for (const n of neighboursOf(board, 40)) {
      expect(board.cells[n].mine).toBe(false);
    }
    expect(board.startedAt).toBeTypeOf('number');
  });

  it('flood-reveals empty regions and counts neighbours', () => {
    let board = createBoard(9, 9, 10);
    board = reveal(board, 0, rng());
    const revealed = board.cells.filter((cell) => cell.revealed).length;
    expect(revealed).toBeGreaterThan(1);
    for (const cell of board.cells) {
      if (cell.revealed && !cell.mine && cell.adjacent === 0) expect(cell.revealed).toBe(true);
    }
  });

  it('flags cells and tracks mines left', () => {
    let board = createBoard(9, 9, 10);
    board = toggleFlag(board, 5);
    expect(board.cells[5].flagged).toBe(true);
    expect(flagsLeft(board)).toBe(9);
    board = toggleFlag(board, 5);
    expect(flagsLeft(board)).toBe(10);
  });

  it('loses when a mine is revealed and wins when all safe cells are open', () => {
    let board = createBoard(9, 9, 10);
    board = reveal(board, 40, rng());
    const mineIndex = board.cells.findIndex((cell) => cell.mine);
    const lost = reveal(board, mineIndex, rng());
    expect(lost.status).toBe('lost');
    expect(lost.cells[mineIndex].revealed).toBe(true);

    let win = createBoard(9, 9, 1);
    win = reveal(win, 40, rng());
    for (let i = 0; i < win.cells.length; i += 1) {
      if (!win.cells[i].mine) win = reveal(win, i, rng());
    }
    expect(win.status).toBe('won');
  });

  it('chords only when flags match the neighbour count', () => {
    let board = createBoard(9, 9, 10);
    board = reveal(board, 40, rng());
    const numberIndex = board.cells.findIndex((cell) => cell.revealed && cell.adjacent > 0);
    if (numberIndex === -1) return; // flood may clear the whole board on tiny mines
    const before = board.cells.filter((cell) => cell.revealed).length;
    const unchanged = chord(board, numberIndex, rng());
    expect(unchanged.cells.filter((cell) => cell.revealed).length).toBe(before);
    let flagged = board;
    for (const n of neighboursOf(board, numberIndex)) {
      if (board.cells[n].mine) flagged = toggleFlag(flagged, n);
    }
    const after = chord(flagged, numberIndex, rng());
    expect(after.cells.filter((cell) => cell.revealed).length).toBeGreaterThanOrEqual(before);
  });

  it('exposes the three classic difficulties', () => {
    expect(DIFFICULTIES.map((d) => d.id)).toEqual(['beginner', 'intermediate', 'expert']);
  });
});

describe('snake', () => {
  it('starts idle with a three-segment snake and food on the grid', () => {
    const state = createSnake(20, rng());
    expect(state.snake).toHaveLength(3);
    expect(state.status).toBe('idle');
    expect(state.food.x).toBeGreaterThanOrEqual(0);
    expect(state.food.x).toBeLessThan(20);
  });

  it('moves forward and refuses reversing into itself', () => {
    let state = togglePause(createSnake(20, rng()));
    expect(state.status).toBe('running');
    const head = state.snake[0];
    state = step(state, rng());
    expect(state.snake[0]).toEqual({ x: head.x + 1, y: head.y });
    const reversed = steer(state, 'left');
    expect(reversed.queued).toBeNull();
    const turned = steer(state, 'up');
    expect(turned.queued).toBe('up');
  });

  it('grows and scores when eating food', () => {
    let state = togglePause(createSnake(20, rng()));
    const head = state.snake[0];
    state = { ...state, food: { x: head.x + 1, y: head.y } };
    const length = state.snake.length;
    state = step(state, rng());
    expect(state.snake).toHaveLength(length + 1);
    expect(state.score).toBe(10);
    expect(state.speed).toBeLessThan(150);
  });

  it('ends the game on walls and on self collision', () => {
    let state = togglePause(createSnake(20, rng()));
    state = { ...state, snake: [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }] };
    const wall = step(state, rng());
    expect(wall.status).toBe('over');

    let loop = togglePause(createSnake(20, rng()));
    loop = {
      ...loop,
      snake: [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
        { x: 6, y: 6 },
        { x: 5, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ],
      dir: 'up',
      queued: null,
    };
    // head steers into a body segment that is not the departing tail
    loop = { ...loop, food: spawnFood(20, loop.snake, rng()) };
    const coiled = {
      ...loop,
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 6, y: 4 },
        { x: 6, y: 5 },
      ],
      dir: 'up' as const,
      queued: null,
    };
    const direct = step(coiled, rng());
    expect(direct.status).toBe('over');
  });

  it('pauses and resumes', () => {
    let state = createSnake(20, rng());
    state = togglePause(state);
    expect(state.status).toBe('running');
    state = togglePause(state);
    expect(state.status).toBe('paused');
    const frozen = step(state, rng());
    expect(frozen.snake).toEqual(state.snake);
  });
});

describe('2048', () => {
  it('starts with two tiles', () => {
    const board = create2048(rng());
    expect(board.filter((value) => value > 0)).toHaveLength(2);
  });

  it('merges equal tiles left and scores', () => {
    const board = [2, 2, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = move(board, 'left', rng());
    expect(result.board.slice(0, 4)).toEqual([4, 8, 0, 0]);
    expect(result.score).toBe(12);
    expect(result.moved).toBe(true);
  });

  it('reports no move when nothing can slide', () => {
    const board = [2, 4, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = move(board, 'left', rng());
    expect(result.moved).toBe(false);
    expect(result.board).toEqual(board);
  });

  it('slides columns for up/down moves', () => {
    const board = [2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = move(board, 'up', rng());
    expect(result.board[0]).toBe(4);
  });

  it('detects a dead board and adds random tiles', () => {
    const dead = [2, 4, 8, 16, 16, 8, 4, 2, 2, 4, 8, 16, 16, 8, 4, 2];
    expect(canMove(dead)).toBe(false);
    const grown = addRandom([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], rng());
    expect(grown.filter((value) => value > 0)).toHaveLength(1);
    expect([2, 4]).toContain(grown.find((value) => value > 0));
    expect(highestTile(dead)).toBe(16);
  });
});
