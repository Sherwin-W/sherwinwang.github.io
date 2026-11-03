import { hiLoValue, rankPoints, upcardValue, type Card } from './cards';
import { cardsRemaining, createShoe, cutCardReached, draw, reshuffle, type Shoe } from './shoe';
import { evaluate, isBlackjack, isPair } from './hand';
import { canDoubleTotal, MAX_HANDS, type Rules } from './rules';
import { HI_LO, WONG_HALVES } from './systems';
import type { Action } from './strategy';

export interface PlayerHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  done: boolean;
  surrendered: boolean;
}

export type OutcomeKind = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | 'surrender';
export interface Outcome { kind: OutcomeKind; net: number }

/**
 * betting → (insurance) → player → settled → betting ...
 * Endurance shoes end with sprint (remaining cards exposed without a round) → complete.
 */
export type Phase = 'betting' | 'insurance' | 'player' | 'settled' | 'sprint' | 'complete';

/** Everything exposed since the last shuffle, tallied once per card as it turns face up. */
export interface ShoeTally {
  exposed: number;
  /** Hi-Lo running count. */
  hiLo: number;
  /** Wong Halves running count × 2. */
  wong2: number;
  /** Ace side count: aces seen. Separate from, and never added to, the primary count. */
  aces: number;
}

const EMPTY_TALLY: ShoeTally = { exposed: 0, hiLo: 0, wong2: 0, aces: 0 };

export interface GameOptions {
  /**
   * Endurance training: one shoe dealt to the last card with no cut card and no reshuffle.
   * When a round can no longer be guaranteed to finish, rounds stop and the rest is exposed by `burn`.
   */
  endurance?: boolean;
}

export interface Game {
  readonly rules: Rules;
  readonly endurance: boolean;
  /** Private: includes undealt cards and the hole card. Never render this directly; use publicView. */
  readonly shoe: Shoe;
  /** Hi-Lo running count of every card exposed since the last shuffle (same as tally.hiLo). */
  readonly runningCount: number;
  /** Private scoring tallies. Not part of publicView. */
  readonly tally: ShoeTally;
  readonly phase: Phase;
  readonly roundNumber: number;
  readonly hands: readonly PlayerHand[];
  readonly active: number;
  /** dealer[0] is the upcard, dealer[1] the hole card until `holeRevealed`. */
  readonly dealer: readonly Card[];
  readonly holeRevealed: boolean;
  /** Insurance stake for this round (0 when declined or not offered). */
  readonly insurance: number;
  readonly insuranceOffered: boolean;
  readonly outcomes: readonly Outcome[] | null;
  /** Round result including insurance. */
  readonly net: number;
  readonly insuranceNet: number;
  readonly needsShuffle: boolean;
  /** True for the round that began right after a reshuffle. */
  readonly freshShoe: boolean;
  /** Cards exposed by the most recent `burn`. */
  readonly burned: readonly Card[];
}

export function newGame(rules: Rules, seed: number, opts: GameOptions = {}): Game {
  const endurance = !!opts.endurance;
  return {
    rules, endurance, shoe: createShoe(rules.decks, endurance ? 1 : rules.penetration, seed), runningCount: 0, tally: EMPTY_TALLY,
    phase: 'betting', roundNumber: 0, hands: [], active: 0, dealer: [], holeRevealed: false, insurance: 0, insuranceOffered: false,
    outcomes: null, net: 0, insuranceNet: 0, needsShuffle: false, freshShoe: true, burned: [],
  };
}

const MIN_CARDS_TO_START = 30;

/**
 * Upper bound on the hard points (ace = 1) one round can consume:
 * a player hand only draws while its total is under 21, so its hard total before the last card is
 * at most 20 and after it at most 30; there are at most MAX_HANDS hands (4 × 30). The dealer draws only
 * below 17 (or on soft 17, hard 7), so the dealer's hard total is at most 16 + 10 = 26.
 */
export const ROUND_POINT_BOUND = MAX_HANDS * 30 + 26;

/**
 * A round can certainly be completed when the cards left hold more hard points than any round can use:
 * every drawn card is a distinct remaining card, so a round that ran the shoe dry would have drawn all of
 * them while still needing more, which needs more than ROUND_POINT_BOUND points. At a bet, every dealt
 * card has been exposed, so this depends only on what a player could know (the shoe minus the discards).
 */
export function roundIsSafe(shoe: Shoe): boolean {
  let points = 0;
  for (let i = shoe.next; i < shoe.cards.length; i++) {
    points += rankPoints(shoe.cards[i].rank);
    if (points > ROUND_POINT_BOUND) return true;
  }
  return false;
}

function expose(g: Game, card: Card): Game {
  const t = g.tally;
  const tally: ShoeTally = {
    exposed: t.exposed + 1,
    hiLo: t.hiLo + hiLoValue(card.rank),
    wong2: t.wong2 + WONG_HALVES.tag2(card.rank),
    aces: t.aces + (card.rank === 'A' ? 1 : 0),
  };
  return { ...g, tally, runningCount: g.runningCount + HI_LO.tag2(card.rank) / 2 };
}

function dealTo(g: Game): [Card, Game] {
  const [card, shoe] = draw(g.shoe);
  return [card, { ...g, shoe }];
}

/** Deals a card face up to a player hand. */
function dealToHand(g: Game, index: number): Game {
  const [card, d] = dealTo(g);
  const hands = d.hands.map((h, i) => (i === index ? { ...h, cards: [...h.cards, card] } : h));
  return expose({ ...d, hands }, card);
}

/** Endurance shoe with no safe round left: stop dealing hands and expose the rest with `burn`. */
export const shoeFinished = (g: Game): boolean => g.endurance && g.phase === 'betting' && !roundIsSafe(g.shoe);

export function startRound(game: Game, bet: number): Game {
  if (game.phase !== 'betting') throw new Error('not-betting');
  if (!(bet > 0)) throw new Error('bad-bet');
  let g = game;
  let fresh = false;
  if (g.endurance) {
    if (!roundIsSafe(g.shoe)) throw new Error('shoe-finished');
  } else if (g.needsShuffle || cardsRemaining(g.shoe) < MIN_CARDS_TO_START || !roundIsSafe(g.shoe)) {
    g = { ...g, shoe: reshuffle(g.shoe, g.rules.penetration), runningCount: 0, tally: EMPTY_TALLY };
    fresh = true;
  }
  const base: PlayerHand = { cards: [], bet, doubled: false, fromSplit: false, splitAces: false, done: false, surrendered: false };
  g = {
    ...g, phase: 'player', roundNumber: g.roundNumber + 1, hands: [base], active: 0, dealer: [], holeRevealed: false,
    insurance: 0, insuranceOffered: false, outcomes: null, net: 0, insuranceNet: 0, needsShuffle: false, freshShoe: fresh, burned: [],
  };
  // Deal order: player, dealer up, player, dealer hole.
  g = dealToHand(g, 0);
  let c: Card; [c, g] = dealTo(g); g = expose({ ...g, dealer: [c] }, c);
  g = dealToHand(g, 0);
  [c, g] = dealTo(g); g = { ...g, dealer: [...g.dealer, c] }; // hole: not exposed, not counted

  if (g.dealer[0].rank === 'A' && g.rules.insurance) return { ...g, phase: 'insurance', insuranceOffered: true };
  return peek(g);
}

/** Dealer peeks on a 10 or ace; a natural on either side ends the round before any action. */
function peek(g: Game): Game {
  const up = upcardValue(g.dealer[0]);
  const dealerNatural = (up === 10 || up === 11) && isBlackjack(g.dealer);
  const playerNatural = isBlackjack(g.hands[0].cards);
  if (dealerNatural || playerNatural) return settle(revealHole(g));
  return { ...g, phase: 'player' };
}

/** Insurance (offered on an ace upcard): a side bet of half the wager that pays 2:1 if the dealer has blackjack. */
export function resolveInsurance(game: Game, take: boolean): Game {
  if (game.phase !== 'insurance') throw new Error('no-insurance');
  return peek({ ...game, insurance: take ? game.hands[0].bet / 2 : 0 });
}

function revealHole(g: Game): Game {
  if (g.holeRevealed) return g;
  return expose({ ...g, holeRevealed: true }, g.dealer[1]);
}

const currentHand = (g: Game) => g.hands[g.active];

export function legalActions(g: Game): Action[] {
  if (g.phase !== 'player') return [];
  const h = currentHand(g);
  if (!h || h.done || h.cards.length < 2) return [];
  const { rules } = g;
  const v = evaluate(h.cards);
  const acts: Action[] = ['stand'];
  const canResplit = h.splitAces ? rules.resplitAces : true;
  const canSplit = isPair(h.cards) && g.hands.length < MAX_HANDS && canResplit;
  if (!h.splitAces) acts.unshift('hit');
  if (canSplit) acts.push('split');
  const doubleOk = !h.splitAces && h.cards.length === 2 && (!h.fromSplit || rules.doubleAfterSplit) && canDoubleTotal(rules, v.total, v.soft);
  if (doubleOk) acts.push('double');
  if (rules.lateSurrender && g.hands.length === 1 && h.cards.length === 2 && !h.fromSplit) acts.push('surrender');
  return acts;
}

/** Marks the hand done if it has no further choices, then moves on. */
function afterCard(g: Game): Game {
  const h = currentHand(g);
  const total = evaluate(h.cards).total;
  let done = total >= 21 || h.doubled;
  if (h.splitAces && !done) {
    // One card on split aces only. A fresh ace may be resplit when the rules allow it.
    done = !rulesAllowResplit(g);
  }
  return done ? finishHand(g) : g;
}

function rulesAllowResplit(g: Game): boolean {
  const h = currentHand(g);
  return g.rules.resplitAces && isPair(h.cards) && g.hands.length < MAX_HANDS;
}

function finishHand(g: Game): Game {
  let hands = g.hands.map((h, i) => (i === g.active ? { ...h, done: true } : h));
  let next = g.active + 1;
  let out: Game = { ...g, hands };
  while (next < hands.length) {
    // A split-off hand waits with one card until the player reaches it.
    out = dealToHand({ ...out, active: next }, next);
    hands = out.hands as PlayerHand[];
    out = { ...out, active: next };
    const handNow = hands[next];
    const total = evaluate(handNow.cards).total;
    if (total >= 21) { hands = hands.map((h, i) => (i === next ? { ...h, done: true } : h)); out = { ...out, hands }; next++; continue; }
    if (handNow.splitAces && !rulesAllowResplit(out)) { hands = hands.map((h, i) => (i === next ? { ...h, done: true } : h)); out = { ...out, hands }; next++; continue; }
    return out;
  }
  return settle(playDealer(out));
}

export function applyAction(game: Game, action: Action): Game {
  if (!legalActions(game).includes(action)) throw new Error(`illegal-action:${action}`);
  let g = game;
  const i = g.active;
  switch (action) {
    case 'stand': return finishHand(g);
    case 'hit': g = dealToHand(g, i); return afterCard(g);
    case 'double': {
      g = { ...g, hands: g.hands.map((h, k) => (k === i ? { ...h, bet: h.bet * 2, doubled: true } : h)) };
      g = dealToHand(g, i);
      return finishHand(g);
    }
    case 'surrender': {
      g = { ...g, hands: g.hands.map((h, k) => (k === i ? { ...h, surrendered: true } : h)) };
      return finishHand(g);
    }
    case 'split': {
      const h = g.hands[i];
      const aces = h.cards[0].rank === 'A';
      const first: PlayerHand = { ...h, cards: [h.cards[0]], fromSplit: true, splitAces: aces };
      const second: PlayerHand = { ...first, cards: [h.cards[1]] };
      const hands = [...g.hands.slice(0, i), first, second, ...g.hands.slice(i + 1)];
      g = dealToHand({ ...g, hands }, i);
      return afterCard(g);
    }
  }
}

function dealerShouldHit(g: Game): boolean {
  const v = evaluate(g.dealer);
  if (v.total < 17) return true;
  return v.total === 17 && v.soft && g.rules.dealerHitsSoft17;
}

function handIsLive(h: PlayerHand): boolean {
  return !h.surrendered && evaluate(h.cards).total <= 21 && !isBlackjack(h.cards, h.fromSplit);
}

function playDealer(game: Game): Game {
  let g = revealHole(game);
  if (!g.hands.some(handIsLive)) return g;
  while (dealerShouldHit(g)) {
    let c: Card; [c, g] = dealTo(g);
    g = expose({ ...g, dealer: [...g.dealer, c] }, c);
  }
  return g;
}

export function settleHand(h: PlayerHand, dealer: readonly Card[], rules: Rules): Outcome {
  if (h.surrendered) return { kind: 'surrender', net: -h.bet / 2 };
  const pv = evaluate(h.cards);
  if (pv.busted) return { kind: 'bust', net: -h.bet };
  const dv = evaluate(dealer);
  const dealerNatural = isBlackjack(dealer);
  if (isBlackjack(h.cards, h.fromSplit)) {
    return dealerNatural ? { kind: 'push', net: 0 } : { kind: 'blackjack', net: h.bet * rules.blackjackPayout };
  }
  if (dealerNatural) return { kind: 'lose', net: -h.bet };
  if (dv.busted || pv.total > dv.total) return { kind: 'win', net: h.bet };
  if (pv.total === dv.total) return { kind: 'push', net: 0 };
  return { kind: 'lose', net: -h.bet };
}

function settle(g: Game): Game {
  const outcomes = g.hands.map((h) => settleHand(h, g.dealer, g.rules));
  const insuranceNet = g.insurance > 0 ? (isBlackjack(g.dealer) ? g.insurance * 2 : -g.insurance) : 0;
  const net = outcomes.reduce((n, o) => n + o.net, 0) + insuranceNet;
  return {
    ...g, phase: 'settled', outcomes, net, insuranceNet, hands: g.hands.map((h) => ({ ...h, done: true })),
    needsShuffle: !g.endurance && cutCardReached(g.shoe),
  };
}

/** Clears the table for the next bet. The shoe and running count carry over. */
export function nextRound(g: Game): Game {
  if (g.phase !== 'settled') throw new Error('not-settled');
  return { ...g, phase: 'betting', hands: [], dealer: [], holeRevealed: false, insurance: 0, insuranceOffered: false, outcomes: null, net: 0, insuranceNet: 0, active: 0, freshShoe: false };
}

/**
 * Endurance sprint: once no round is safe, expose up to `n` of the remaining cards without dealing a hand.
 * The phase becomes 'complete' when the shoe is empty.
 */
export function burn(game: Game, n: number): Game {
  if (!game.endurance) throw new Error('not-endurance');
  if (game.phase !== 'betting' && game.phase !== 'sprint') throw new Error('not-between-rounds');
  if (game.phase === 'betting' && roundIsSafe(game.shoe)) throw new Error('round-still-possible');
  let g: Game = game;
  const burned: Card[] = [];
  for (let k = 0; k < n && cardsRemaining(g.shoe) > 0; k++) {
    let c: Card; [c, g] = dealTo(g);
    g = expose(g, c);
    burned.push(c);
  }
  return { ...g, burned, phase: cardsRemaining(g.shoe) === 0 ? 'complete' : 'sprint' };
}

/** What a player at the table can see. Contains no undealt cards, no hidden hole card and no count. */
export interface PublicView {
  phase: Phase;
  roundNumber: number;
  rules: Rules;
  endurance: boolean;
  hands: readonly PlayerHand[];
  active: number;
  /** The hole card is null (shown face down) until revealed. */
  dealer: readonly (Card | null)[];
  outcomes: readonly Outcome[] | null;
  net: number;
  insurance: number;
  insuranceOffered: boolean;
  insuranceNet: number;
  cardsRemaining: number;
  cardsDealt: number;
  /** Cards turned face up since the shuffle (dealt minus a still-hidden hole card). */
  cardsExposed: number;
  /** Aces seen so far: visible on the table, so public. */
  acesSeen: number;
  totalCards: number;
  cutIndex: number;
  needsShuffle: boolean;
  freshShoe: boolean;
  burned: readonly Card[];
  shoeFinished: boolean;
  legal: Action[];
}

export function publicView(g: Game): PublicView {
  return {
    phase: g.phase, roundNumber: g.roundNumber, rules: g.rules, endurance: g.endurance, hands: g.hands, active: g.active,
    dealer: g.dealer.map((c, i) => (i === 1 && !g.holeRevealed ? null : c)),
    outcomes: g.outcomes, net: g.net, insurance: g.insurance, insuranceOffered: g.insuranceOffered, insuranceNet: g.insuranceNet,
    cardsRemaining: cardsRemaining(g.shoe), cardsDealt: g.shoe.next, cardsExposed: g.tally.exposed, acesSeen: g.tally.aces,
    totalCards: g.shoe.cards.length, cutIndex: g.shoe.cutIndex,
    needsShuffle: g.needsShuffle, freshShoe: g.freshShoe, burned: g.burned, shoeFinished: shoeFinished(g), legal: legalActions(g),
  };
}
