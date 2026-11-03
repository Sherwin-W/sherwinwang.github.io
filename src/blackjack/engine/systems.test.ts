import { describe, expect, it } from 'vitest';
import { RANKS, SUITS, type Card, type Rank } from './cards';
import { countOf2, formatCount2, HI_LO, parseCount2, WONG_HALVES } from './systems';

const deck = (): Card[] => SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
const tags = (sys: typeof HI_LO) => Object.fromEntries(RANKS.map((r) => [r, sys.tag2(r) / 2])) as Record<Rank, number>;

describe('Hi-Lo tags', () => {
  it('2-6 = +1, 7-9 = 0, 10/J/Q/K/A = -1', () => {
    expect(tags(HI_LO)).toEqual({ A: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 0, '8': 0, '9': 0, '10': -1, J: -1, Q: -1, K: -1 });
  });
  it('is balanced: a full deck sums to 0', () => { expect(countOf2(HI_LO, deck())).toBe(0); });
  it('counter steps are whole numbers only', () => { expect(HI_LO.steps2).toEqual([2]); });
});

describe('Wong Halves tags', () => {
  it('uses the exact published values', () => {
    expect(tags(WONG_HALVES)).toEqual({ '2': 0.5, '3': 1, '4': 1, '5': 1.5, '6': 1, '7': 0.5, '8': 0, '9': -0.5, '10': -1, J: -1, Q: -1, K: -1, A: -1 });
  });
  it('stores every tag as an integer (doubled) so counts never drift', () => {
    for (const r of RANKS) expect(Number.isInteger(WONG_HALVES.tag2(r))).toBe(true);
  });
  it('is balanced: one deck and six decks both sum to 0', () => {
    expect(countOf2(WONG_HALVES, deck())).toBe(0);
    expect(countOf2(WONG_HALVES, Array.from({ length: 6 }, deck).flat())).toBe(0);
  });
  it('offers ±0.5, ±1 and ±1.5 counter steps', () => { expect(WONG_HALVES.steps2).toEqual([1, 2, 3]); });
  it('adds fractions exactly: 2, 7, 5 = +2.5', () => {
    expect(formatCount2(countOf2(WONG_HALVES, [{ rank: '2', suit: 'S' }, { rank: '7', suit: 'H' }, { rank: '5', suit: 'D' }]))).toBe('+2.5');
  });
});

describe('count formatting and parsing', () => {
  it('formats doubled values with a sign', () => {
    expect([0, 1, -1, 2, -3, 9].map(formatCount2)).toEqual(['0', '+0.5', '−0.5', '+1', '−1.5', '+4.5']);
  });
  it('parses whole and half numbers, including a typographic minus', () => {
    expect(parseCount2('+3')).toBe(6);
    expect(parseCount2('-1.5')).toBe(-3);
    expect(parseCount2('−0.5')).toBe(-1);
    expect(parseCount2(' 2 ')).toBe(4);
  });
  it('rejects text and quarter values', () => {
    expect(parseCount2('abc')).toBeNull();
    expect(parseCount2('1.25')).toBeNull();
    expect(parseCount2('')).toBeNull();
  });
});
