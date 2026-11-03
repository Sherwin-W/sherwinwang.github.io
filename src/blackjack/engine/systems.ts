import type { Card, Rank } from './cards';

export type SystemId = 'hilo' | 'wong';

/**
 * A balanced counting system. Tags are stored doubled ("halves") so Wong Halves stays in
 * integers: +0.5 is 1, +1.5 is 3. Hi-Lo tags are simply doubled.
 */
export interface CountingSystem {
  id: SystemId;
  name: string;
  /** Tag × 2 for a rank. */
  tag2: (rank: Rank) => number;
  /** Counter buttons, × 2, positive steps only (each gets a matching negative). */
  steps2: number[];
  /** Rank groups for the legend, top to bottom. */
  legend: { ranks: string; tag2: number }[];
}

const TENS: Rank[] = ['10', 'J', 'Q', 'K', 'A'];

export const HI_LO: CountingSystem = {
  id: 'hilo',
  name: 'Hi-Lo',
  tag2: (r) => (TENS.includes(r) ? -2 : Number(r) <= 6 ? 2 : 0),
  steps2: [2],
  legend: [
    { ranks: '2 3 4 5 6', tag2: 2 },
    { ranks: '7 8 9', tag2: 0 },
    { ranks: '10 J Q K A', tag2: -2 },
  ],
};

const WONG2: Record<string, number> = { '2': 1, '3': 2, '4': 2, '5': 3, '6': 2, '7': 1, '8': 0, '9': -1 };

/** Wong Halves: 2 = +0.5; 3, 4, 6 = +1; 5 = +1.5; 7 = +0.5; 8 = 0; 9 = −0.5; 10, J, Q, K, A = −1. */
export const WONG_HALVES: CountingSystem = {
  id: 'wong',
  name: 'Wong Halves',
  tag2: (r) => (TENS.includes(r) ? -2 : WONG2[r]),
  steps2: [1, 2, 3],
  legend: [
    { ranks: '5', tag2: 3 },
    { ranks: '3 4 6', tag2: 2 },
    { ranks: '2 7', tag2: 1 },
    { ranks: '8', tag2: 0 },
    { ranks: '9', tag2: -1 },
    { ranks: '10 J Q K A', tag2: -2 },
  ],
};

export const SYSTEMS: Record<SystemId, CountingSystem> = { hilo: HI_LO, wong: WONG_HALVES };

export const countOf2 = (sys: CountingSystem, cards: readonly Card[]): number => cards.reduce((n, c) => n + sys.tag2(c.rank), 0);

/** "+1.5", "−2", "0". Uses a real minus sign. */
export function formatCount2(v2: number): string {
  if (v2 === 0) return '0';
  const abs = Math.abs(v2);
  const text = abs % 2 === 0 ? String(abs / 2) : `${(abs - 1) / 2}.5`;
  return `${v2 > 0 ? '+' : '−'}${text}`;
}

/** Parses "+1.5", "-2", "−0.5", "3" into a doubled integer; null when it is not a whole or half number. */
export function parseCount2(text: string): number | null {
  const t = text.trim().replace('−', '-').replace(/^\+/, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t) * 2;
  return Number.isInteger(v) ? v : null;
}
