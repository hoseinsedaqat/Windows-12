/** Klondike Solitaire — pure engine with seeded shuffles and legal-move helpers. */

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = number; // 1 = ace … 13 = king

export interface PlayingCard {
  rank: Rank;
  suit: Suit;
}

export interface TableauPile {
  cards: PlayingCard[];
  /** index of the first face-up card (cards before it are face-down) */
  faceUpFrom: number;
}

export interface KlondikeState {
  stock: PlayingCard[];
  waste: PlayingCard[];
  foundations: PlayingCard[][];
  tableau: TableauPile[];
  moves: number;
  won: boolean;
  seed: number;
}

export const SUIT_SYMBOL: Record<Suit, string> = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' };
export const SUIT_RED: Record<Suit, boolean> = { S: false, H: true, D: true, C: false };

function shuffledDeck(seed: number): { deck: PlayingCard[]; seed: number } {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const deck: PlayingCard[] = [];
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  for (const suit of suits) for (let rank = 1; rank <= 13; rank += 1) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { deck, seed: state };
}

export function createKlondike(seed = Date.now()): KlondikeState {
  const { deck, seed: nextSeed } = shuffledDeck(seed);
  const tableau: TableauPile[] = [];
  let cursor = 0;
  for (let pile = 0; pile < 7; pile += 1) {
    const cards = deck.slice(cursor, cursor + pile + 1);
    cursor += pile + 1;
    tableau.push({ cards, faceUpFrom: cards.length - 1 });
  }
  return {
    stock: deck.slice(cursor),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    moves: 0,
    won: false,
    seed: nextSeed,
  };
}

export function drawStock(state: KlondikeState): KlondikeState {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) return state;
    return { ...state, stock: [...state.waste].reverse().map((card) => card), waste: [], moves: state.moves + 1 };
  }
  const card = state.stock[state.stock.length - 1];
  return { ...state, stock: state.stock.slice(0, -1), waste: [...state.waste, card], moves: state.moves + 1 };
}

export function canPlaceOnTableau(card: PlayingCard, pile: TableauPile): boolean {
  const visible = pile.cards.slice(pile.faceUpFrom);
  if (visible.length === 0) return card.rank === 13;
  const top = visible[visible.length - 1];
  return SUIT_RED[card.suit] !== SUIT_RED[top.suit] && card.rank === top.rank - 1;
}

export function canPlaceOnFoundation(card: PlayingCard, pile: PlayingCard[]): boolean {
  if (pile.length === 0) return card.rank === 1;
  const top = pile[pile.length - 1];
  return card.suit === top.suit && card.rank === top.rank + 1;
}

export type CardSource =
  | { type: 'waste' }
  | { type: 'tableau'; pile: number; cardIndex: number }
  | { type: 'foundation'; pile: number };

function takeCards(state: KlondikeState, source: CardSource): { cards: PlayingCard[]; rest: KlondikeState } | null {
  if (source.type === 'waste') {
    if (state.waste.length === 0) return null;
    const card = state.waste[state.waste.length - 1];
    return { cards: [card], rest: { ...state, waste: state.waste.slice(0, -1) } };
  }
  if (source.type === 'foundation') {
    const pile = state.foundations[source.pile];
    if (!pile || pile.length === 0) return null;
    const card = pile[pile.length - 1];
    const foundations = state.foundations.map((item, index) => (index === source.pile ? item.slice(0, -1) : item));
    return { cards: [card], rest: { ...state, foundations } };
  }
  const pile = state.tableau[source.pile];
  if (!pile || source.cardIndex < pile.faceUpFrom || source.cardIndex >= pile.cards.length) return null;
  const cards = pile.cards.slice(source.cardIndex);
  const restTableau = state.tableau.map((item, index) => {
    if (index !== source.pile) return item;
    const kept = item.cards.slice(0, source.cardIndex);
    const faceUpFrom = Math.min(item.faceUpFrom, Math.max(0, kept.length - 1));
    return { cards: kept, faceUpFrom: kept.length === 0 ? 0 : faceUpFrom };
  });
  return { cards, rest: { ...state, tableau: restTableau } };
}

export function moveCards(
  state: KlondikeState,
  source: CardSource,
  target: { type: 'tableau'; pile: number } | { type: 'foundation'; pile: number },
): KlondikeState | null {
  const taken = takeCards(state, source);
  if (!taken) return null;
  const { cards, rest } = taken;
  if (target.type === 'foundation') {
    if (cards.length !== 1) return null;
    const pile = rest.foundations[target.pile];
    if (!canPlaceOnFoundation(cards[0], pile)) return null;
    const foundations = rest.foundations.map((item, index) => (index === target.pile ? [...item, cards[0]] : item));
    const next = { ...rest, foundations, moves: rest.moves + 1 };
    return checkWon(next);
  }
  const pile = rest.tableau[target.pile];
  if (!pile || !canPlaceOnTableau(cards[0], pile)) return null;
  const tableau = rest.tableau.map((item, index) =>
    index === target.pile ? { ...item, cards: [...item.cards, ...cards] } : item,
  );
  return { ...rest, tableau, moves: rest.moves + 1 };
}

/** Best foundation for a card, or -1. */
export function foundationFor(state: KlondikeState, card: PlayingCard): number {
  for (let index = 0; index < 4; index += 1) {
    if (canPlaceOnFoundation(card, state.foundations[index])) return index;
  }
  return -1;
}

/** Greedy auto-finish: repeatedly move any legal card to the foundations. */
export function autoComplete(state: KlondikeState): KlondikeState {
  let current = state;
  for (let guard = 0; guard < 200; guard += 1) {
    let moved = false;
    const wasteCard = current.waste[current.waste.length - 1];
    if (wasteCard) {
      const target = foundationFor(current, wasteCard);
      if (target >= 0) {
        const next = moveCards(current, { type: 'waste' }, { type: 'foundation', pile: target });
        if (next) { current = next; moved = true; }
      }
    }
    if (!moved) {
      for (let pile = 0; pile < 7 && !moved; pile += 1) {
        const column = current.tableau[pile];
        const card = column.cards[column.cards.length - 1];
        if (!card || column.cards.length <= column.faceUpFrom) continue;
        const target = foundationFor(current, card);
        if (target >= 0) {
          const next = moveCards(current, { type: 'tableau', pile, cardIndex: column.cards.length - 1 }, { type: 'foundation', pile: target });
          if (next) { current = next; moved = true; }
        }
      }
    }
    if (!moved) break;
  }
  return current;
}

function checkWon(state: KlondikeState): KlondikeState {
  const total = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
  return total === 52 ? { ...state, won: true } : state;
}
