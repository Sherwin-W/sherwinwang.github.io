import { hiLoValue, type Card } from './cards';

export const CARDS_PER_DECK = 52;

export function runningCountOf(cards: readonly Card[]): number {
  return cards.reduce((n, c) => n + hiLoValue(c.rank), 0);
}

/** Exact decks left in the shoe (a fraction). */
export const decksRemaining = (cardsRemaining: number): number => cardsRemaining / CARDS_PER_DECK;

/**
 * Convention: a person estimates the discard tray in half-deck steps, never below half a deck.
 * This is the "estimated" deck count; `decksRemaining` is the exact internal fraction.
 */
export function estimateDecks(cardsRemaining: number): number {
  return Math.max(0.5, Math.round(decksRemaining(cardsRemaining) * 2) / 2);
}

export const trueCountExact = (running: number, decks: number): number => running / decks;

/**
 * Convention used for all scoring: running count divided by the estimated decks,
 * truncated toward zero. (+8 over 4 decks = +2; +7 over 4 decks = +1; -7 over 4 = -1.)
 */
export function trueCountScored(running: number, estimatedDecks: number): number {
  const t = Math.trunc(running / estimatedDecks);
  return t === 0 ? 0 : t;
}

export interface BetStep { atLeast: number; units: number }
/** Illustrative training schedule from the README; configurable, not betting advice. */
export const DEFAULT_SCHEDULE: BetStep[] = [
  { atLeast: -Infinity, units: 1 },
  { atLeast: 2, units: 2 },
  { atLeast: 3, units: 4 },
  { atLeast: 4, units: 6 },
];

export function scheduledBet(trueCount: number, schedule: readonly BetStep[] = DEFAULT_SCHEDULE): number {
  let units = schedule[0].units;
  for (const step of [...schedule].sort((a, b) => a.atLeast - b.atLeast)) if (trueCount >= step.atLeast) units = step.units;
  return units;
}
