import { describe, expect, it } from 'vitest';
import { rankPoints, RANKS, SUITS, type Card, type Rank } from './cards';
import { runningCountOf } from './count';
import { applyAction, burn, legalActions, newGame, nextRound, publicView, resolveInsurance, roundIsSafe, ROUND_POINT_BOUND, shoeFinished, startRound, type Game } from './game';
import { DEFAULT_RULES, normalizeRules, type Rules } from './rules';
import { deriveSeed, mulberry32 } from './rng';
import { decide } from './strategy';
import { createShoe, goldenRange, type Shoe } from './shoe';
import { countOf2, WONG_HALVES } from './systems';

const c = (s: string): Card => ({ rank: s.slice(0, -1) as Rank, suit: s.slice(-1) as Card['suit'] });
const rules = (o: Partial<Rules> = {}) => normalizeRules({ ...DEFAULT_RULES, ...o });

function stacked(order: string[], o: Partial<Rules> = {}, endurance = false, filler = 200): Game {
  const r = rules(o);
  const pad = Array.from({ length: filler }, (_, i) => c(['5', '6', '7', '8', '9'][i % 5] + 'C'));
  const cards = [...order.map(c), ...pad];
  const shoe: Shoe = { cards, next: 0, cutIndex: endurance ? cards.length : 10_000, decks: r.decks, seed: 1, shuffles: 0 };
  return { ...newGame(r, 1, { endurance }), shoe };
}

/** Every card a player could see right now: hands, the dealer's visible cards and the last burn. */
function visible(g: Game): Card[] {
  return [...g.hands.flatMap((h) => h.cards), ...publicView(g).dealer.filter((x): x is Card => x !== null)];
}

/** Plays one round with basic strategy (or random legal actions), declining insurance. */
function playRound(g: Game, rng?: () => number): Game {
  if (g.phase === 'insurance') g = resolveInsurance(g, false);
  let guard = 0;
  while (g.phase === 'player') {
    const legal = legalActions(g);
    let a = legal[0];
    if (rng) a = legal[Math.floor(rng() * legal.length)];
    else {
      const h = g.hands[g.active];
      const d = decide(h.cards, g.dealer[0], g.rules, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
      a = legal.includes(d.action) ? d.action : 'stand';
    }
    g = applyAction(g, a);
    if (++guard > 60) throw new Error('runaway');
  }
  return g;
}

describe('exposure tallies', () => {
  it('counts each exposed card exactly once and the hole card only after it is revealed', () => {
    // player 10, dealer up 6, player 7, hole 5; player stands; dealer draws K.
    let g = startRound(stacked(['10S', '6D', '7H', '5C', 'KD']), 1);
    expect(g.phase).toBe('player');
    expect(g.tally.exposed).toBe(3);
    expect(g.tally.exposed).toBe(visible(g).length);
    expect(g.runningCount).toBe(-1 + 1 + 0);
    g = applyAction(g, 'stand');
    expect(g.tally.exposed).toBe(5);
    expect(g.runningCount).toBe(runningCountOf([c('10S'), c('6D'), c('7H'), c('5C'), c('KD')]));
    expect(g.tally.wong2).toBe(countOf2(WONG_HALVES, [c('10S'), c('6D'), c('7H'), c('5C'), c('KD')]));
  });

  it('keeps the ace side count separate: aces still count −1 in Hi-Lo and are not added twice', () => {
    // player A, dealer up 9, player A, hole 7 -> split aces: each gets one card.
    let g = startRound(stacked(['AS', '9D', 'AH', '7C', '2S', '3S']), 1);
    g = applyAction(g, 'split');
    expect(g.phase).toBe('settled');
    const seen = visible(g); // A,2 and A,3 split hands; dealer 9,7 then draws to 17+
    expect(g.tally.exposed).toBe(seen.length);
    expect(g.tally.aces).toBe(2);
    expect(g.runningCount).toBe(runningCountOf(seen));
    expect(seen.filter((x) => x.rank === 'A')).toHaveLength(2);
    expect(g.tally.wong2).toBe(countOf2(WONG_HALVES, seen));
  });

  it('matches every dealt card after many simulated rounds (Hi-Lo, Wong Halves and aces)', () => {
    let g = newGame(rules(), 77);
    for (let i = 0; i < 400; i++) {
      g = playRound(startRound(g, 1));
      const dealt = g.shoe.cards.slice(0, g.shoe.next);
      expect(g.tally.exposed).toBe(dealt.length);
      expect(g.tally.hiLo).toBe(runningCountOf(dealt));
      expect(g.tally.wong2).toBe(countOf2(WONG_HALVES, dealt));
      expect(g.tally.aces).toBe(dealt.filter((x) => x.rank === 'A').length);
      g = nextRound(g);
    }
  });
});

describe('insurance', () => {
  // player 10, dealer up A, player 9, hole K (dealer blackjack) / hole 6 (no blackjack).
  it('is offered on an ace before the peek, with no actions and the hole card uncounted', () => {
    const g = startRound(stacked(['10S', 'AD', '9H', 'KC']), 2);
    expect(g.phase).toBe('insurance');
    expect(legalActions(g)).toEqual([]);
    expect(publicView(g).dealer[1]).toBeNull();
    expect(g.tally.exposed).toBe(3);
  });
  it('pays 2:1 when the dealer has blackjack, so the round nets zero', () => {
    const g = resolveInsurance(startRound(stacked(['10S', 'AD', '9H', 'KC']), 2), true);
    expect(g.phase).toBe('settled');
    expect(g.insuranceNet).toBe(2);
    expect(g.net).toBe(0);
  });
  it('loses the half-bet stake when the dealer has no blackjack, and play continues', () => {
    let g = resolveInsurance(startRound(stacked(['10S', 'AD', '9H', '6C', '5S']), 2), true);
    expect(g.phase).toBe('player');
    expect(g.insurance).toBe(1);
    g = applyAction(g, 'stand');
    expect(g.insuranceNet).toBe(-1);
  });
  it('declining with a dealer blackjack loses only the main bet', () => {
    const g = resolveInsurance(startRound(stacked(['10S', 'AD', '9H', 'KC']), 2), false);
    expect(g.net).toBe(-2);
    expect(g.insuranceNet).toBe(0);
  });
  it('is not offered when the table rules have no insurance', () => {
    expect(startRound(stacked(['10S', 'AD', '9H', '6C'], { insurance: false }), 2).phase).toBe('player');
  });
  it('can only be resolved during the insurance phase', () => {
    expect(() => resolveInsurance(startRound(stacked(['10S', '6D', '9H', '6C']), 2), true)).toThrow('no-insurance');
  });
});

describe('safe-round bound and finite-shoe exhaustion', () => {
  it('a shoe whose remaining cards hold more than the bound is safe, otherwise not', () => {
    const shoe = (cards: string[]): Shoe => ({ cards: cards.map(c), next: 0, cutIndex: cards.length, decks: 6, seed: 1, shuffles: 0 });
    expect(roundIsSafe(shoe(Array(15).fill('10S')))).toBe(true); // 150 > 146
    expect(roundIsSafe(shoe(Array(14).fill('10S')))).toBe(false); // 140
    expect(roundIsSafe(shoe(Array(146).fill('AS')))).toBe(false); // aces are 1 point each
    expect(ROUND_POINT_BOUND).toBe(146);
  });

  it('casino mode reshuffles instead of exhausting on a low-card tail (Codex finding 12)', () => {
    // 48 low cards before the cut: four split hands could run them dry. The round must not start on them.
    const low = Array.from({ length: 48 }, (_, i) => c(['AS', '2D', '3H', '2C'][i % 4]));
    const r = rules({ resplitAces: true });
    const g0 = newGame(r, 5);
    const shoe: Shoe = { cards: low, next: 0, cutIndex: 10_000, decks: 6, seed: 5, shuffles: 0 };
    const g = startRound({ ...g0, shoe }, 1);
    expect(g.freshShoe).toBe(true);
    expect(g.shoe.cards).toHaveLength(312);
  });

  it('property: when a round starts, random play (splits included) never runs the shoe dry', () => {
    const rng = mulberry32(2024);
    const pool: Rank[] = ['A', '2', '3', '4', '2', '3', 'A', '8', '10', '5'];
    for (let trial = 0; trial < 3000; trial++) {
      const n = 10 + Math.floor(rng() * 60);
      const cards: Card[] = Array.from({ length: n }, () => ({ rank: pool[Math.floor(rng() * pool.length)], suit: 'S' }));
      const shoe: Shoe = { cards, next: 0, cutIndex: cards.length, decks: 6, seed: 1, shuffles: 0 };
      if (!roundIsSafe(shoe)) continue;
      const g = { ...newGame(rules({ resplitAces: rng() < 0.5, dealerHitsSoft17: rng() < 0.5 }), 1, { endurance: true }), shoe };
      expect(() => playRound(startRound(g, 1), rng)).not.toThrow();
    }
  });

  it('endurance: deals every card of the shoe exactly once, then the sprint empties it', () => {
    for (const decks of [4, 6, 8] as const) {
      for (let seed = 1; seed <= 12; seed++) {
        let g = newGame(rules({ decks }), seed, { endurance: true });
        let rounds = 0;
        while (!shoeFinished(g)) { g = nextRound(playRound(startRound(g, 1))); rounds++; }
        const left = g.shoe.cards.slice(g.shoe.next).reduce((n, x) => n + rankPoints(x.rank), 0);
        expect(left).toBeLessThanOrEqual(ROUND_POINT_BOUND);
        expect(() => startRound(g, 1)).toThrow('shoe-finished');
        while (g.phase !== 'complete') g = burn(g, 4);
        expect(rounds).toBeGreaterThan(30);
        expect(g.tally.exposed).toBe(decks * 52);
        expect(g.tally.hiLo).toBe(0);
        expect(g.tally.wong2).toBe(0);
        expect(g.tally.aces).toBe(decks * 4);
        expect(g.shoe.shuffles).toBe(0);
      }
    }
  });

  it('burn is refused while a full round is still possible, and outside endurance', () => {
    const g = newGame(rules(), 3, { endurance: true });
    expect(() => burn(g, 4)).toThrow('round-still-possible');
    expect(() => burn(newGame(rules(), 3), 4)).toThrow('not-endurance');
  });

  it('publicView exposes neither the count nor undealt cards', () => {
    const v = publicView(startRound(newGame(rules(), 9, { endurance: true }), 1)) as unknown as Record<string, unknown>;
    expect(v).not.toHaveProperty('runningCount');
    expect(v).not.toHaveProperty('tally');
    expect(v).not.toHaveProperty('shoe');
    expect(JSON.stringify(v)).not.toContain('wong');
  });
});

describe('golden cards in the shoe', () => {
  const strip = (cs: readonly Card[]) => cs.map((x) => x.rank + x.suit).join(',');
  it('six decks: 25-50 distinct golden cards, chosen once per shoe and reproducible from the seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const shoe = createShoe(6, 1, seed);
      const ids = shoe.cards.filter((x) => x.gold !== undefined).map((x) => x.gold!);
      expect(ids.length).toBeGreaterThanOrEqual(25);
      expect(ids.length).toBeLessThanOrEqual(50);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(shoe.cards[id].gold).toBe(id)); // id = position in the shoe
      expect(createShoe(6, 1, seed).cards).toEqual(shoe.cards);
    }
    expect(goldenRange(6)).toEqual([25, 50]);
  });
  it('does not change the shuffle: same order as a plain Fisher-Yates with the same seed', () => {
    const plain: Card[] = [];
    for (let d = 0; d < 6; d++) for (const suit of SUITS) for (const rank of RANKS) plain.push({ rank, suit });
    const rng = mulberry32(deriveSeed(42, 0));
    for (let i = plain.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [plain[i], plain[j]] = [plain[j], plain[i]]; }
    expect(strip(createShoe(6, 1, 42).cards)).toBe(strip(plain));
  });
  it('a golden hole card stays hidden: publicView shows null until it is revealed', () => {
    for (let seed = 1; seed < 3000; seed++) {
      const g = startRound(newGame(rules({ insurance: false }), seed, { endurance: true }), 1);
      if (g.phase !== 'player' || g.dealer[1].gold === undefined) continue;
      const v = publicView(g);
      expect(v.dealer[1]).toBeNull();
      expect(JSON.stringify(v.dealer)).not.toContain('gold');
      return;
    }
    throw new Error('no seed with a golden hole card');
  });
  it('does not change values or counts', () => {
    const golden = createShoe(6, 1, 3).cards.filter((x) => x.gold !== undefined);
    expect(runningCountOf(golden)).toBe(runningCountOf(golden.map(({ rank, suit }) => ({ rank, suit }))));
    expect(countOf2(WONG_HALVES, golden)).toBe(countOf2(WONG_HALVES, golden.map(({ rank, suit }) => ({ rank, suit }))));
  });
});
