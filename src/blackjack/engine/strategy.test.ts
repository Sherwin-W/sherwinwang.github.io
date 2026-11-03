import { describe, expect, it } from 'vitest';
import type { Card, Rank } from './cards';
import { hiLoValue } from './cards';
import { decide, hardMove, pairMove, ruleDependentOn, softMove, type Action, type Context } from './strategy';
import { DEFAULT_RULES, normalizeRules, type Rules } from './rules';
import { applyAction, legalActions, newGame, startRound, publicView, nextRound, type Game } from './game';
import { runningCountOf } from './count';

const c = (s: string): Card => ({ rank: s.slice(0, -1) as Rank, suit: s.slice(-1) as Card['suit'] });
const rules = (o: Partial<Rules> = {}) => normalizeRules({ ...DEFAULT_RULES, insurance: false, ...o });
const all: Context = { canDouble: true, canSplit: true, canSurrender: true };
const act = (hand: string[], up: string, o: Partial<Rules> = {}, ctx: Partial<Context> = {}): Action =>
  decide(hand.map(c), c(up), rules(o), { ...all, ...ctx }).action;

describe('basic strategy: well-known cells (6 decks, H17, DAS, late surrender)', () => {
  it.each([
    [['10H', '6D'], '10D', 'surrender'], // hard 16 vs 10
    [['10H', '6D'], '7D', 'hit'],
    [['10H', '6D'], '6D', 'stand'],
    [['10H', '2D'], '4D', 'stand'], // hard 12 vs 4
    [['10H', '2D'], '3D', 'hit'],
    [['5H', '6D'], '10D', 'double'], // hard 11 vs 10
    [['5H', '6D'], 'AD', 'double'], // H17: 11 vs A doubles
    [['5H', '5D'], '9D', 'double'], // 5,5 plays as hard 10
    [['5H', '5D'], 'AD', 'hit'],
    [['5H', '4D'], '3D', 'double'], // hard 9 vs 3
    [['5H', '4D'], '2D', 'hit'],
    [['AH', '7D'], '2D', 'double'], // soft 18 vs 2 (H17: Ds)
    [['AH', '7D'], '9D', 'hit'],
    [['AH', '7D'], '7D', 'stand'],
    [['AH', '8D'], '6D', 'double'], // H17 soft 19 vs 6
    [['AH', '6D'], '3D', 'double'],
    [['AH', '2D'], '4D', 'hit'],
    [['AH', '2D'], '5D', 'double'],
    [['AH', 'AD'], '10D', 'split'],
    [['8H', '8D'], '10D', 'split'],
    [['8H', '8D'], 'AD', 'surrender'], // H17 + surrender
    [['9H', '9D'], '7D', 'stand'],
    [['9H', '9D'], '8D', 'split'],
    [['10H', '10D'], '6D', 'stand'],
    [['7H', '7D'], '7D', 'split'],
    [['7H', '7D'], '8D', 'hit'],
    [['6H', '6D'], '2D', 'split'], // DAS
    [['4H', '4D'], '5D', 'split'],
    [['2H', '2D'], '8D', 'hit'],
    [['10H', '7D'], 'AD', 'surrender'], // H17 hard 17 vs A
    [['10H', '5D'], '10D', 'surrender'],
    [['10H', '5D'], 'AD', 'surrender'], // H17
  ] as [string[], string, Action][])('%j vs %s -> %s', (hand, up, expected) => {
    expect(act(hand, up)).toBe(expected);
  });
});

describe('basic strategy: rule-dependent cells', () => {
  it('S17 changes the dealer-ace and soft-hand answers', () => {
    expect(act(['5H', '6D'], 'AD', { dealerHitsSoft17: false })).toBe('hit');
    expect(act(['AH', '7D'], '2D', { dealerHitsSoft17: false })).toBe('stand');
    expect(act(['AH', '8D'], '6D', { dealerHitsSoft17: false })).toBe('stand');
    expect(act(['8H', '8D'], 'AD', { dealerHitsSoft17: false })).toBe('split');
    expect(act(['10H', '7D'], 'AD', { dealerHitsSoft17: false })).toBe('stand');
    expect(act(['10H', '5D'], 'AD', { dealerHitsSoft17: false })).toBe('hit');
    expect(act(['10H', '5D'], '10D', { dealerHitsSoft17: false })).toBe('surrender');
  });
  it('without DAS the small pairs are split less often', () => {
    expect(act(['6H', '6D'], '2D', { doubleAfterSplit: false })).toBe('hit');
    expect(act(['6H', '6D'], '3D', { doubleAfterSplit: false })).toBe('split');
    expect(act(['4H', '4D'], '5D', { doubleAfterSplit: false })).toBe('hit');
    expect(act(['2H', '2D'], '3D', { doubleAfterSplit: false })).toBe('hit');
    expect(act(['2H', '2D'], '4D', { doubleAfterSplit: false })).toBe('split');
  });
  it('falls back sensibly when a surrender or double is not available', () => {
    expect(act(['10H', '6D'], '10D', { lateSurrender: false }, { canSurrender: false })).toBe('hit');
    expect(act(['10H', '7D'], 'AD', {}, { canSurrender: false })).toBe('stand');
    expect(act(['8H', '8D'], 'AD', {}, { canSurrender: false })).toBe('split');
    expect(act(['AH', '7D'], '4D', {}, { canDouble: false })).toBe('stand'); // Ds -> stand
    expect(act(['AH', '6D'], '4D', {}, { canDouble: false })).toBe('hit'); // D -> hit
    expect(act(['5H', '6D'], '6D', {}, { canDouble: false })).toBe('hit');
  });
  it('plays a pair as a total when it cannot be split', () => {
    expect(act(['8H', '8D'], '10D', {}, { canSplit: false, canSurrender: false })).toBe('hit'); // hard 16
    expect(act(['AH', 'AD'], '6D', {}, { canSplit: false })).toBe('hit'); // soft 12
  });
  it('lists which rules would change an answer', () => {
    const hand = ['5H', '6D'].map(c);
    expect(ruleDependentOn(hand, c('AD'), rules(), all)).toContain('dealer standing on soft 17');
    expect(ruleDependentOn(['10H', '8D'].map(c), c('5D'), rules(), all)).toEqual([]);
  });
});

describe('chart shape', () => {
  it('never doubles or surrenders a hard 17+ except the H17 ace case', () => {
    for (let up = 2; up <= 11; up++) for (let t = 17; t <= 21; t++) {
      const m = hardMove(t, up, rules());
      expect(['S', 'Rs']).toContain(m);
    }
  });
  it('soft 19+ stands except the H17 double vs 6', () => {
    expect(softMove(19, 6, rules())).toBe('Ds');
    expect(softMove(19, 6, rules({ dealerHitsSoft17: false }))).toBe('S');
    expect(softMove(20, 6, rules())).toBe('S');
  });
  it('never splits tens or fives', () => {
    for (let up = 2; up <= 11; up++) { expect(pairMove(10, up, rules())).toBeNull(); expect(pairMove(5, up, rules())).toBeNull(); }
  });
  it('always returns a legal action for every hand, upcard and context', () => {
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    for (const a of ranks) for (const b of ranks) for (const up of ranks) for (const canDouble of [true, false]) for (const canSurrender of [true, false]) {
      const d = decide([{ rank: a, suit: 'S' }, { rank: b, suit: 'H' }], { rank: up, suit: 'D' }, rules(), { canDouble, canSplit: a === b, canSurrender });
      if (d.action === 'double') expect(canDouble).toBe(true);
      if (d.action === 'surrender') expect(canSurrender).toBe(true);
      if (d.action === 'split') expect(a).toBe(b);
    }
  });
});

/** Plays the engine with basic strategy. Also checks invariants after every action. */
function playMany(o: Partial<Rules>, rounds: number, seed: number) {
  const r = rules(o);
  let g: Game = newGame(r, seed);
  let units = 0, bets = 0;
  for (let i = 0; i < rounds; i++) {
    g = startRound(g, 1);
    let guard = 0;
    while (g.phase === 'player') {
      const legal = legalActions(g);
      const h = g.hands[g.active];
      const d = decide(h.cards, g.dealer[0], r, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
      const action = legal.includes(d.action) ? d.action : 'stand';
      g = applyAction(g, action);
      if (++guard > 40) throw new Error('runaway');
    }
    // Everything dealt is exposed by settlement (the hole card is always revealed), so the
    // shared running count must equal the Hi-Lo count of every card dealt from this shoe.
    expect(g.runningCount).toBe(runningCountOf(g.shoe.cards.slice(0, g.shoe.next)));
    expect(publicView(g).dealer.every((x) => x !== null)).toBe(true);
    const staked = g.hands.reduce((n, x) => n + x.bet, 0);
    expect(g.net).toBeLessThanOrEqual(staked * 1.5);
    expect(g.net).toBeGreaterThanOrEqual(-staked);
    units += g.net; bets += 1;
    g = nextRound(g);
  }
  return { ev: units / bets, rounds: bets };
}

describe('engine + strategy simulation', () => {
  it('keeps the running count equal to the exposed cards across many seeded rounds', () => {
    playMany({}, 3000, 11);
    playMany({ decks: 4, penetration: 0.6, dealerHitsSoft17: false }, 2000, 5);
  });
  it('basic strategy gives a small house edge, as published tables predict (H17, 6 decks)', () => {
    // Expected is roughly -0.4%. With 300k rounds the standard error is about 0.2%.
    const { ev } = playMany({}, 300_000, 2026);
    expect(ev).toBeGreaterThan(-0.012);
    expect(ev).toBeLessThan(0.004);
  });
  it('6:5 blackjack costs the player several points of edge', () => {
    const good = playMany({ blackjackPayout: 1.5 }, 150_000, 77).ev;
    const bad = playMany({ blackjackPayout: 1.2 }, 150_000, 77).ev;
    expect(good - bad).toBeGreaterThan(0.012); // exact difference is ~1.39% with the same cards
  });
});

describe('hi-lo balance', () => {
  it('a full deck counts to zero', () => {
    const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    expect(ranks.reduce((n, r) => n + hiLoValue(r), 0)).toBe(0);
  });
});
