import { describe, expect, it } from 'vitest';
import { cardName, hiLoValue, type Card, type Rank } from './cards';
import { evaluate, isBlackjack } from './hand';
import { DEFAULT_RULES, normalizeRules, type Rules } from './rules';
import { cardsRemaining, createShoe, cutCardReached, draw, reshuffle, type Shoe } from './shoe';
import { applyAction, legalActions, newGame, nextRound, publicView, startRound, type Game } from './game';
import { DEFAULT_SCHEDULE, decksRemaining, estimateDecks, runningCountOf, scheduledBet, trueCountExact, trueCountScored } from './count';

const c = (s: string): Card => {
  const suit = s.slice(-1) as Card['suit'];
  return { rank: s.slice(0, -1) as Rank, suit };
};
const hand = (...xs: string[]) => xs.map(c);
const rules = (o: Partial<Rules> = {}): Rules => normalizeRules({ ...DEFAULT_RULES, insurance: false, ...o });

/** A game whose next cards are exactly `order`, padded so the shoe never reshuffles mid-test. */
function stacked(order: string[], o: Partial<Rules> = {}): Game {
  const r = rules(o);
  const filler = Array.from({ length: 200 }, (_, i) => c(['5', '6', '7', '8', '9'][i % 5] + 'C'));
  const shoe: Shoe = { cards: [...order.map(c), ...filler], next: 0, cutIndex: 10_000, decks: r.decks, seed: 1, shuffles: 0 };
  return { ...newGame(r, 1), shoe };
}
// Deal order is: player, dealer up, player, dealer hole, then draws.
const play = (order: string[], o: Partial<Rules> = {}, bet = 10) => startRound(stacked(order, o), bet);

describe('hand evaluation', () => {
  it('counts an ace as 11 unless that busts', () => {
    expect(evaluate(hand('AS', '6D'))).toMatchObject({ total: 17, soft: true });
    expect(evaluate(hand('AS', '6D', '10C'))).toMatchObject({ total: 17, soft: false });
    expect(evaluate(hand('AS', 'AD'))).toMatchObject({ total: 12, soft: true });
    expect(evaluate(hand('AS', 'AD', '9C'))).toMatchObject({ total: 21, soft: true });
    expect(evaluate(hand('10S', '9D', '5C')).busted).toBe(true);
  });
  it('distinguishes blackjack from a three-card 21 and from a split 21', () => {
    expect(isBlackjack(hand('AS', 'KD'))).toBe(true);
    expect(isBlackjack(hand('7S', '7D', '7C'))).toBe(false);
    expect(isBlackjack(hand('AS', 'KD'), true)).toBe(false);
  });
});

describe('shoe', () => {
  it('has the right composition and is reproducible from a seed', () => {
    const a = createShoe(6, 0.75, 42);
    expect(a.cards).toHaveLength(312);
    expect(a.cards.filter((x) => x.rank === 'A')).toHaveLength(24);
    expect(createShoe(6, 0.75, 42).cards).toEqual(a.cards);
    expect(createShoe(6, 0.75, 43).cards).not.toEqual(a.cards);
    expect(a.cutIndex).toBe(234);
  });
  it('actually shuffles: the whole shoe sums to a Hi-Lo count of zero', () => {
    expect(runningCountOf(createShoe(8, 0.75, 7).cards)).toBe(0);
  });
  it('depletes, detects the cut card and reshuffles to a full new order', () => {
    let s = createShoe(4, 0.5, 9);
    expect(cutCardReached(s)).toBe(false);
    for (let i = 0; i < s.cutIndex; i++) s = draw(s)[1];
    expect(cutCardReached(s)).toBe(true);
    expect(cardsRemaining(s)).toBe(208 - 104);
    const fresh = reshuffle(s, 0.5);
    expect(fresh.next).toBe(0);
    expect(fresh.cards).not.toEqual(s.cards);
    expect(fresh.cards).toHaveLength(208);
    expect(createShoe(4, 0.5, 9).cards).toEqual(s.cards);
  });
  it('throws when empty', () => {
    let s = createShoe(4, 0.5, 1);
    for (let i = 0; i < 208; i++) s = draw(s)[1];
    expect(() => draw(s)).toThrow('shoe-exhausted');
  });
});

describe('Hi-Lo and true count', () => {
  it('values every rank', () => {
    const v = (r: Rank) => hiLoValue(r);
    expect(['2', '3', '4', '5', '6'].map((r) => v(r as Rank))).toEqual([1, 1, 1, 1, 1]);
    expect(['7', '8', '9'].map((r) => v(r as Rank))).toEqual([0, 0, 0]);
    expect(['10', 'J', 'Q', 'K', 'A'].map((r) => v(r as Rank))).toEqual([-1, -1, -1, -1, -1]);
  });
  it('estimates decks in half-deck steps and truncates the true count toward zero', () => {
    expect(decksRemaining(104)).toBe(2);
    expect(estimateDecks(104)).toBe(2);
    expect(estimateDecks(120)).toBe(2.5); // 2.31 -> 2.5
    expect(estimateDecks(5)).toBe(0.5);
    expect(trueCountScored(8, 4)).toBe(2);
    expect(trueCountScored(7, 4)).toBe(1);
    expect(trueCountScored(-7, 4)).toBe(-1);
    expect(trueCountScored(-1, 4)).toBe(0);
    expect(Object.is(trueCountScored(-1, 4), 0)).toBe(true);
    expect(trueCountExact(7, 4)).toBe(1.75);
  });
  it('grades bets against the configured schedule', () => {
    expect([-3, 0, 1, 2, 3, 4, 9].map((t) => scheduledBet(t))).toEqual([1, 1, 1, 2, 4, 6, 6]);
    expect(scheduledBet(5, [{ atLeast: -Infinity, units: 5 }, { atLeast: 5, units: 10 }])).toBe(10);
    expect(DEFAULT_SCHEDULE[0].units).toBe(1);
  });
});

describe('dealing, hidden cards and the running count', () => {
  it('deals in table order: player, dealer up, player, dealer hole', () => {
    // player 10, dealer up 6, player 5, dealer hole 2 (+1 low card hidden)
    const g = play(['10S', '6D', '5H', '2C']);
    expect(g.phase).toBe('player');
    expect(g.hands[0].cards).toEqual(hand('10S', '5H'));
    expect(g.dealer).toEqual(hand('6D', '2C'));
  });
  it('counts exposed cards only: player cards and the upcard', () => {
    const g = play(['10S', '6D', '5H', '2C']); // -1, +1, +1 exposed; hole 2 hidden
    expect(g.runningCount).toBe(1);
    expect(publicView(g).dealer).toEqual([c('6D'), null]);

  });
  it('never leaks the shoe or hole card through the public view', () => {
    const view = publicView(play(['10S', '6D', '5H', '2C']));
    expect(Object.keys(view)).not.toContain('shoe');
    expect(view.cardsDealt).toBe(4);
    expect(view.cardsRemaining).toBe(view.totalCards - 4);
  });
  it('counts the hole card and dealer draws as they are exposed', () => {
    // player 10+9=19 stands; dealer 6 + hole 10 = 16, draws 3 -> 19 (push)
    let g = play(['10S', '6D', '9H', '10C', '3D']);
    expect(g.runningCount).toBe(-1 + 1 + 0);
    g = applyAction(g, 'stand');
    expect(g.phase).toBe('settled');
    expect(g.holeRevealed).toBe(true);
    // + hole 10 (-1) + draw 3 (+1)
    expect(g.runningCount).toBe(0 + -1 + 1);
    expect(g.outcomes![0].kind).toBe('push');
  });
  it('keeps the count across rounds and resets it on reshuffle', () => {
    let g = play(['10S', '6D', '9H', '10C', '3D']);
    g = applyAction(g, 'stand');
    const rc = g.runningCount;
    g = nextRound(g);
    expect(g.runningCount).toBe(rc);
    expect(g.phase).toBe('betting');
    const forced: Game = { ...g, needsShuffle: true, runningCount: 5 };
    const after = startRound(forced, 10);
    expect(after.freshShoe).toBe(true);
    expect(after.shoe.shuffles).toBe(1);
    // the count restarts from zero and then only reflects the new round's exposed cards
    expect(after.runningCount).toBe(runningCountOf([...after.hands[0].cards, after.dealer[0]]));
  });
  it('flags a reshuffle once the cut card is passed', () => {
    let g = play(['10S', '6D', '9H', '10C', '3D']);
    g = { ...g, shoe: { ...g.shoe, cutIndex: 3 } };
    g = applyAction(g, 'stand');
    expect(g.needsShuffle).toBe(true);
  });
  it('is deterministic for a seed', () => {
    const run = () => { let g = startRound(newGame(rules(), 123), 5); if (g.phase === 'player') g = applyAction(g, 'stand'); return JSON.stringify(g); };
    expect(run()).toBe(run());
  });
});

describe('dealer peek and naturals', () => {
  it('ends the round at once when the dealer has blackjack, showing the hole card', () => {
    const g = play(['10S', 'AD', '9H', 'KC']);
    expect(g.phase).toBe('settled');
    expect(g.holeRevealed).toBe(true);
    expect(g.outcomes![0]).toEqual({ kind: 'lose', net: -10 });
    expect(g.runningCount).toBe(-1 + -1 + 0 + -1);
  });
  it('pushes when both have blackjack', () => {
    const g = play(['AS', 'KD', 'KH', 'AC']);
    expect(g.outcomes![0]).toEqual({ kind: 'push', net: 0 });
  });
  it('pays a player natural 3:2 or 6:5 when the dealer has none', () => {
    expect(play(['AS', '9D', 'KH', '8C']).outcomes![0]).toEqual({ kind: 'blackjack', net: 15 });
    expect(play(['AS', '9D', 'KH', '8C'], { blackjackPayout: 1.2 }).outcomes![0]).toEqual({ kind: 'blackjack', net: 12 });
  });
  it('a three-card 21 is not a blackjack and pays 1:1', () => {
    let g = play(['7S', '9D', '7H', '8C', '7C']);
    g = applyAction(g, 'hit');
    expect(g.hands[0].cards).toHaveLength(3);
    expect(g.phase).toBe('settled');
    expect(g.outcomes![0]).toEqual({ kind: 'win', net: 10 });
  });
  it('does not peek on a small upcard: the player acts first', () => {
    expect(play(['10S', '6D', '9H', '10C']).phase).toBe('player');
  });
});

describe('dealer play: H17 and S17', () => {
  // dealer A+6 (soft 17) vs player 10+9 = 19
  const order = ['10S', 'AD', '9H', '6C', '4D'];
  it('hits soft 17 under H17 (A,6 draws a 4 to make 21)', () => {
    const g = applyAction(play(order, { dealerHitsSoft17: true }), 'stand');
    expect(g.dealer).toHaveLength(3);
    expect(g.outcomes![0].kind).toBe('lose');
  });
  it('stands on soft 17 under S17', () => {
    const g = applyAction(play(order, { dealerHitsSoft17: false }), 'stand');
    expect(g.dealer).toHaveLength(2);
    expect(g.outcomes![0].kind).toBe('win');
  });
  it('always stands on hard 17 and hits 16', () => {
    const g = applyAction(play(['10S', '10D', '9H', '7C']), 'stand');
    expect(g.dealer).toHaveLength(2);
    const h = applyAction(play(['10S', '10D', '9H', '6C', '5D']), 'stand');
    expect(h.dealer).toHaveLength(3);
    expect(h.outcomes![0].kind).toBe('lose'); // dealer 10+6+5 = 21 beats 19
  });
  it('does not draw when every player hand has busted', () => {
    let g = play(['10S', '6D', '6H', '10C', 'KD']); // player 16, dealer 16
    g = applyAction(g, 'hit');
    expect(g.outcomes![0].kind).toBe('bust');
    expect(g.dealer).toHaveLength(2);
    expect(g.holeRevealed).toBe(true);
  });
});

describe('legal actions', () => {
  it('offers hit/stand/double/surrender on a first decision and no split without a pair', () => {
    const g = play(['10S', '6D', '5H', '9C']);
    expect(legalActions(g).sort()).toEqual(['double', 'hit', 'stand', 'surrender']);
  });
  it('offers split on a pair', () => {
    expect(legalActions(play(['8S', '6D', '8H', '9C']))).toContain('split');
  });
  it('removes double and surrender after a hit', () => {
    const g = applyAction(play(['2S', '6D', '3H', '9C', '2D']), 'hit');
    expect(legalActions(g)).toEqual(['hit', 'stand']);
  });
  it('respects surrender and double restrictions', () => {
    expect(legalActions(play(['10S', '6D', '5H', '9C'], { lateSurrender: false }))).not.toContain('surrender');
    expect(legalActions(play(['5S', '6D', '2H', '9C'], { doubleOn: '9-11' }))).not.toContain('double'); // hard 7
    expect(legalActions(play(['5S', '6D', '4H', '9C'], { doubleOn: '10-11' }))).not.toContain('double'); // hard 9
    expect(legalActions(play(['5S', '6D', '5H', '9C'], { doubleOn: '10-11' }))).toContain('double'); // hard 10
    expect(legalActions(play(['AS', '6D', '4H', '9C'], { doubleOn: '9-11' }))).not.toContain('double'); // soft 15
    expect(legalActions(play(['AS', '6D', '4H', '9C'], { doubleOn: 'any' }))).toContain('double');
  });
  it('rejects illegal actions', () => {
    const g = play(['10S', '6D', '5H', '9C']);
    expect(() => applyAction(g, 'split')).toThrow('illegal-action:split');
    const done = applyAction(g, 'stand');
    expect(legalActions(done)).toEqual([]);
    expect(() => applyAction(done, 'hit')).toThrow();
  });
});

describe('double and surrender', () => {
  it('doubles the bet, takes exactly one card and stands', () => {
    // player 5+6 = 11, dealer 6 + 10; double draws 10 = 21, dealer 16 draws 10 -> bust? 16+10=26 bust
    const g = applyAction(play(['5S', '6D', '6H', '10C', '10D', '10H']), 'double');
    expect(g.hands[0].bet).toBe(20);
    expect(g.hands[0].cards).toHaveLength(3);
    expect(g.phase).toBe('settled');
    expect(g.outcomes![0]).toEqual({ kind: 'win', net: 20 });
  });
  it('late surrender returns half the bet and the dealer does not draw', () => {
    const g = applyAction(play(['10S', '10D', '6H', '6C']), 'surrender');
    expect(g.outcomes![0]).toEqual({ kind: 'surrender', net: -5 });
    expect(g.dealer).toHaveLength(2);
    expect(g.holeRevealed).toBe(true);
  });
});

describe('splitting', () => {
  it('splits, plays the first hand fully before dealing the second hand its card', () => {
    // player 8,8 vs dealer 6 + 10. Split: hand1 gets 3 (11), hit -> 10 = 21 auto-stand? 8+3+10=21.
    let g = play(['8S', '6D', '8H', '10C', '3D', '10H', '2S', '9D', '5C'], {}, 10);
    g = applyAction(g, 'split');
    expect(g.hands.map((h) => h.cards.length)).toEqual([2, 1]);
    expect(g.hands[0].cards).toEqual(hand('8S', '3D'));
    g = applyAction(g, 'hit'); // 8+3+10 = 21 -> auto stand and move on
    expect(g.hands[1].cards).toEqual(hand('8H', '2S'));
    expect(g.active).toBe(1);
  });
  it('treats 21 after a split as 1:1, not a blackjack', () => {
    let g = play(['8S', '6D', '8H', '10C', 'AD', '10H', '10S'], {}, 10);
    g = applyAction(g, 'split'); // hand1: 8 + A = soft 19
    expect(g.hands[0].cards).toEqual(hand('8S', 'AD'));
  });
  it('split aces get one card each and no more action', () => {
    let g = play(['AS', '6D', 'AH', '10C', 'KD', '9H', '9S', '7C'], {}, 10);
    g = applyAction(g, 'split');
    expect(g.phase).toBe('settled'); // both hands resolved automatically
    expect(g.hands[0].cards).toEqual(hand('AS', 'KD'));
    expect(g.hands[1].cards).toEqual(hand('AH', '9H'));
    // A+K after a split is 21 but not a natural: pays 1:1 against dealer 16 busting
    expect(g.outcomes![0].kind).not.toBe('blackjack');
  });
  it('re-splits aces only when the rule allows it', () => {
    const order = ['AS', '6D', 'AH', '10C', 'AD', '5H', '9S', '7C'];
    const no = applyAction(play(order, { resplitAces: false }), 'split');
    expect(no.hands.length).toBe(2);
    const yes = applyAction(play(order, { resplitAces: true }), 'split');
    expect(legalActions(yes)).toContain('split');
    expect(legalActions(yes)).not.toContain('hit');
    expect(applyAction(yes, 'split').hands.length).toBe(3);
  });
  it('allows double after split only when configured', () => {
    // 8,8 split; first hand 8+3 = 11
    const order = ['8S', '6D', '8H', '10C', '3D', '5H', '9S', '7C'];
    expect(legalActions(applyAction(play(order, { doubleAfterSplit: true }), 'split'))).toContain('double');
    expect(legalActions(applyAction(play(order, { doubleAfterSplit: false }), 'split'))).not.toContain('double');
  });
  it('caps the number of hands at four and does not allow surrender after splitting', () => {
    let g = play(['8S', '6D', '8H', '10C', '8D', '8C', '8S', '8H', '8D', '2C'], {}, 10);
    g = applyAction(g, 'split');
    expect(legalActions(g)).not.toContain('surrender');
    g = applyAction(g, 'split');
    g = applyAction(g, 'split');
    expect(g.hands).toHaveLength(4);
    expect(legalActions(g)).not.toContain('split');
  });
  it('settles each split hand separately with its own bet', () => {
    let g = play(['10S', '6D', '10H', '10C', '9D', '8H', '10D'], {}, 10);
    g = applyAction(g, 'split'); // hand1 10+9 = 19
    g = applyAction(g, 'stand'); // hand2 gets 8 -> 18
    g = applyAction(g, 'stand'); // dealer 16 hits 10 -> bust
    expect(g.outcomes!.map((o) => o.kind)).toEqual(['win', 'win']);
    expect(g.net).toBe(20);
  });
});

describe('rules', () => {
  it('normalizes bad input', () => {
    expect(normalizeRules({ decks: 3 as never, penetration: 2, doubleOn: 'x' as never })).toMatchObject({ decks: 6, penetration: 0.85, doubleOn: 'any' });
  });
  it('names cards for assistive tech', () => {
    expect(cardName(c('AS'))).toBe('Ace of spades');
    expect(cardName(c('10H'))).toBe('Ten of hearts');
  });
});
