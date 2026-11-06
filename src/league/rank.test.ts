import { describe, expect, it } from 'vitest';
import { lpText, parseRank, progress, rankName, reached, steps, tierMarks, type Rank } from './rank';

const DIAMOND_IV: Rank = { tier: 'DIAMOND', division: 'IV', lp: 0 };
const r = (tier: Rank['tier'], division: Rank['division'], lp: number | null): Rank => ({ tier, division, lp });

describe('rank ladder', () => {
  it('counts whole divisions from Iron IV, plus LP as a fraction of the next', () => {
    expect(steps(r('IRON', 'IV', 0))).toBe(0);
    expect(steps(r('IRON', 'I', 0))).toBe(3);
    expect(steps(r('BRONZE', 'IV', 0))).toBe(4);
    expect(steps(r('GOLD', 'II', 27))).toBeCloseTo(14.27);
    expect(steps(r('EMERALD', 'I', 99))).toBeCloseTo(23.99);
    expect(steps(DIAMOND_IV)).toBe(24);
  });

  it('maps rank to 0..1 progress toward Diamond IV', () => {
    expect(progress(r('IRON', 'IV', 0), DIAMOND_IV)).toBe(0);
    expect(progress(r('GOLD', 'II', 27), DIAMOND_IV)).toBeCloseTo(14.27 / 24);
    expect(progress(r('EMERALD', 'I', 100), DIAMOND_IV)).toBeLessThan(1); // promotion pending
    expect(progress(DIAMOND_IV, DIAMOND_IV)).toBe(1);
  });

  it('is monotonic: every higher division or LP is further along', () => {
    const ladder: number[] = [];
    for (const tier of ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD'] as const) {
      for (const division of ['IV', 'III', 'II', 'I'] as const) for (const lp of [0, 50, 99]) ladder.push(progress(r(tier, division, lp), DIAMOND_IV));
    }
    expect(ladder.every((v, i) => i === 0 || v > ladder[i - 1])).toBe(true);
    expect(Math.max(...ladder)).toBeLessThan(1);
  });

  it('marks the goal reached at Diamond IV and above, and stays at the top past Diamond', () => {
    expect(reached(r('EMERALD', 'I', 100), DIAMOND_IV)).toBe(false);
    expect(reached(DIAMOND_IV, DIAMOND_IV)).toBe(true);
    expect(reached(r('DIAMOND', 'I', 75), DIAMOND_IV)).toBe(true);
    const master = parseRank('MASTER', undefined, 412)!;
    expect(master).toEqual({ tier: 'MASTER', lp: 412 });
    expect(reached(master, DIAMOND_IV)).toBe(true);
    expect(progress(master, DIAMOND_IV)).toBe(1);
    expect(rankName(master)).toBe('Master');
    expect(lpText(master)).toBe('412 LP');
  });

  it('supports other goals', () => {
    const goldIV: Rank = { tier: 'GOLD', division: 'IV', lp: 0 };
    expect(progress(r('SILVER', 'I', 50), goldIV)).toBeCloseTo(11.5 / 12);
    expect(reached(r('GOLD', 'IV', 0), goldIV)).toBe(true);
    expect(tierMarks(goldIV).map((m) => m.tier)).toEqual(['IRON', 'BRONZE', 'SILVER', 'GOLD']);
  });

  it('places a tick at the start of each tier up to the goal', () => {
    expect(tierMarks(DIAMOND_IV).map((m) => [m.tier, m.at])).toEqual([
      ['IRON', 0], ['BRONZE', 1 / 6], ['SILVER', 2 / 6], ['GOLD', 3 / 6], ['PLATINUM', 4 / 6], ['EMERALD', 5 / 6], ['DIAMOND', 1],
    ]);
  });
});

describe('reading a rank', () => {
  it('accepts Riot’s tier and division names in any case', () => {
    expect(parseRank('GOLD', 'II', 27)).toEqual({ tier: 'GOLD', division: 'II', lp: 27 });
    expect(parseRank('gold', 'ii', 27)).toEqual({ tier: 'GOLD', division: 'II', lp: 27 });
    expect(rankName(parseRank('GOLD', 'II', 27)!)).toBe('Gold II');
  });

  it('rejects anything that is not a real rank instead of guessing', () => {
    expect(parseRank('UNRANKED', 'I', 0)).toBeNull();
    expect(parseRank(undefined, 'I', 0)).toBeNull();
    expect(parseRank('GOLD', 'V', 0)).toBeNull();
    expect(parseRank('GOLD', undefined, 0)).toBeNull();
  });

  it('keeps a valid tier but drops an invalid LP value, and never counts it as progress', () => {
    for (const bad of [-5, Number.NaN, Number.POSITIVE_INFINITY, '27', null, 140]) {
      const rank = parseRank('GOLD', 'II', bad)!;
      expect(rank.lp, String(bad)).toBeNull();
      expect(steps(rank)).toBe(14);
      expect(lpText(rank)).toBe('LP unavailable');
    }
    expect(parseRank('GOLD', 'II', 100)!.lp).toBe(100);
    expect(parseRank('GOLD', 'II', 27.9)!.lp).toBe(27);
  });
});
