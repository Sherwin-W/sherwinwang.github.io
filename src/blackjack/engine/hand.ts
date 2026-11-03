import { rankPoints, type Card } from './cards';

export interface HandValue {
  total: number;
  /** True when an ace is currently counted as 11. */
  soft: boolean;
  busted: boolean;
}

export function evaluate(cards: readonly Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankPoints(c.rank);
    if (c.rank === 'A') aces++;
  }
  let soft = false;
  if (aces > 0 && total + 10 <= 21) { total += 10; soft = true; }
  return { total, soft, busted: total > 21 };
}

/** A natural is a two-card 21 that did not come from a split. */
export function isBlackjack(cards: readonly Card[], fromSplit = false): boolean {
  return !fromSplit && cards.length === 2 && evaluate(cards).total === 21;
}

export const isPair = (cards: readonly Card[]): boolean => cards.length === 2 && cards[0].rank === cards[1].rank;
