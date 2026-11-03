export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface Card {
  rank: Rank;
  suit: Suit;
  /**
   * Golden cards only: a stable id (the card's position in its shoe). Cosmetic: it never changes
   * values, counts or the deal. Hidden with the card while it is face down.
   */
  gold?: number;
}

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

const RANK_NAMES: Record<Rank, string> = { A: 'Ace', '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten', J: 'Jack', Q: 'Queen', K: 'King' };
const SUIT_NAMES: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export const cardName = (c: Card) => `${RANK_NAMES[c.rank]} of ${SUIT_NAMES[c.suit]}`;

/** Hard value: ace counts 1. Evaluation of aces as 11 happens in hand.ts. */
export function rankPoints(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/** Dealer upcard value on the strategy charts: 2..10, with ace as 11. */
export const upcardValue = (c: Card): number => (c.rank === 'A' ? 11 : rankPoints(c.rank));

export type HiLoCategory = 'low' | 'neutral' | 'high';

/** Hi-Lo: 2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1. */
export function hiLoValue(rank: Rank): -1 | 0 | 1 {
  if (rank === 'A' || rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return -1;
  const n = Number(rank);
  return n <= 6 ? 1 : 0;
}

export function hiLoCategory(rank: Rank): HiLoCategory {
  const v = hiLoValue(rank);
  return v === 1 ? 'low' : v === 0 ? 'neutral' : 'high';
}

export const sameCard = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;
