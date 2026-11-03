import { RANKS, SUITS, type Card } from './cards';
import { deriveSeed, mulberry32 } from './rng';
import { CARDS_PER_DECK } from './count';

export interface Shoe {
  readonly cards: readonly Card[];
  /** Index of the next card to deal. Everything before it has been dealt (and is in the discard tray). */
  readonly next: number;
  /** The cut card: once `next` reaches it, the shoe is reshuffled before the next round. */
  readonly cutIndex: number;
  readonly decks: number;
  readonly seed: number;
  readonly shuffles: number;
}

export function createShoe(decks: number, penetration: number, seed: number, shuffles = 0): Shoe {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) cards.push({ rank, suit });
  const rng = mulberry32(deriveSeed(seed, shuffles));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  markGolden(cards, decks, seed, shuffles);
  return { cards, next: 0, cutIndex: Math.floor(decks * CARDS_PER_DECK * penetration), decks, seed, shuffles };
}

/** How many golden cards a shoe gets: 25-50 for six decks, scaled by deck count. */
export function goldenRange(decks: number): [number, number] {
  return [Math.round((25 * decks) / 6), Math.round((50 * decks) / 6)];
}

/**
 * Chooses the golden cards once per shuffle, from a separate seeded stream so the shuffle
 * (and every outcome) is identical with or without them. Marks them in place with a stable id.
 */
function markGolden(cards: Card[], decks: number, seed: number, shuffles: number): void {
  const rng = mulberry32(deriveSeed(seed ^ 0x601d, shuffles + 7919));
  const [lo, hi] = goldenRange(decks);
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  const idx = cards.map((_, i) => i);
  for (let k = 0; k < count; k++) {
    const j = k + Math.floor(rng() * (idx.length - k));
    [idx[k], idx[j]] = [idx[j], idx[k]];
    cards[idx[k]] = { ...cards[idx[k]], gold: idx[k] };
  }
}

export const cardsRemaining = (s: Shoe): number => s.cards.length - s.next;

export function draw(s: Shoe): [Card, Shoe] {
  if (s.next >= s.cards.length) throw new Error('shoe-exhausted');
  return [s.cards[s.next], { ...s, next: s.next + 1 }];
}

export const cutCardReached = (s: Shoe): boolean => s.next >= s.cutIndex;

/** A fresh, fully shuffled shoe: all discards are collected back in. */
export function reshuffle(s: Shoe, penetration: number): Shoe {
  return createShoe(s.decks, penetration, s.seed, s.shuffles + 1);
}
