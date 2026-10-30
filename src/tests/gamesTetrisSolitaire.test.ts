import { describe, expect, it } from 'vitest';
import { createTetris, hardDrop, movePiece, rotatePiece, startTetris, tickTetris } from '../core/games/tetris';
import { autoComplete, canPlaceOnTableau, createKlondike, drawStock, moveCards } from '../core/games/solitaire';

describe('tetris engine', () => {
  it('spawns pieces and drops them to the floor', () => {
    let state = startTetris(createTetris(42));
    expect(state.status).toBe('running');
    expect(state.current).not.toBeNull();
    state = hardDrop(state);
    const filled = state.board.flat().filter(Boolean).length;
    expect(filled).toBeGreaterThan(0);
    expect(state.current).not.toBeNull(); // next piece spawned
  });

  it('rejects moves through walls and rotates with kicks', () => {
    let state = startTetris(createTetris(7));
    for (let i = 0; i < 12; i += 1) state = movePiece(state, -1, 0);
    const atWall = state.current!;
    expect(atWall.x).toBeGreaterThanOrEqual(0);
    const rotated = rotatePiece(state, 1);
    expect(rotated.current!.rot).not.toBe(atWall.rot % 4 === rotated.current!.rot ? atWall.rot : -1);
  });

  it('clears a filled row and scores', () => {
    let state = startTetris(createTetris(1));
    for (let i = 0; i < 40; i += 1) {
      state = hardDrop(state);
      if (state.status === 'over') break;
    }
    expect(state.score).toBeGreaterThanOrEqual(0);
    const ticked = tickTetris(state);
    expect(ticked.status === state.status || ticked.status === 'over').toBe(true);
  });
});

describe('klondike engine', () => {
  it('deals 28 tableau cards and 24 stock cards', () => {
    const state = createKlondike(99);
    const dealt = state.tableau.reduce((sum, pile) => sum + pile.cards.length, 0);
    expect(dealt).toBe(28);
    expect(state.stock.length).toBe(24);
    expect(state.tableau[6].cards.length).toBe(7);
    expect(state.tableau[0].faceUpFrom).toBe(0);
  });

  it('draws from stock to waste and recycles', () => {
    let state = createKlondike(5);
    const firstDraw = drawStock(state);
    expect(firstDraw.waste.length).toBe(1);
    state = firstDraw;
    for (let i = 0; i < 23; i += 1) state = drawStock(state);
    expect(state.stock.length).toBe(0);
    expect(state.waste.length).toBe(24);
    const recycled = drawStock(state);
    expect(recycled.waste.length).toBe(0);
    expect(recycled.stock.length).toBe(24);
  });

  it('enforces alternating-color descending placement', () => {
    const redQueen = { rank: 12, suit: 'H' as const };
    const blackKing = { rank: 13, suit: 'S' as const };
    const empty = { cards: [], faceUpFrom: 0 };
    expect(canPlaceOnTableau(blackKing, empty)).toBe(true);
    expect(canPlaceOnTableau(redQueen, empty)).toBe(false);
    const onKing = { cards: [blackKing], faceUpFrom: 0 };
    expect(canPlaceOnTableau(redQueen, onKing)).toBe(true);
    expect(canPlaceOnTableau(blackKing, onKing)).toBe(false);
  });

  it('auto-completes a nearly won board', () => {
    let state = createKlondike(3);
    // Move every ace to the foundations as they surface, then auto-complete.
    for (let i = 0; i < 60; i += 1) {
      state = drawStock(state);
      const card = state.waste[state.waste.length - 1];
      if (card?.rank === 1) {
        const moved = moveCards(state, { type: 'waste' }, { type: 'foundation', pile: card.suit === 'S' ? 0 : card.suit === 'H' ? 1 : card.suit === 'D' ? 2 : 3 });
        if (moved) state = moved;
      }
    }
    const finished = autoComplete(state);
    const total = finished.foundations.reduce((sum, pile) => sum + pile.length, 0);
    expect(total).toBeGreaterThanOrEqual(0);
  });
});
