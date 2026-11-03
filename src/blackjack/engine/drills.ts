import { RANKS, SUITS, hiLoCategory, rankPoints, upcardValue, type Card, type HiLoCategory, type Rank } from './cards';
import { decide, ruleDependentOn, type Action, type Category, type Decision } from './strategy';
import { evaluate } from './hand';
import { canDoubleTotal, type Rules } from './rules';
import { estimateDecks, trueCountScored } from './count';

export type Rng = () => number;
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
export const randomCard = (rng: Rng, ranks: readonly Rank[] = RANKS): Card => ({ rank: pick(rng, ranks), suit: pick(rng, SUITS) });

export interface StrategyQuestion {
  player: Card[];
  upcard: Card;
  category: Category;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  decision: Decision;
  /** Rules that would change the answer for this exact hand. */
  dependsOn: string[];
}

const TENS: Rank[] = ['10', 'J', 'Q', 'K'];

/** A random first decision of the requested kind, built so it matches the category exactly. */
export function strategyQuestion(rng: Rng, rules: Rules, categories: readonly Category[] = ['hard', 'soft', 'pair']): StrategyQuestion {
  for (;;) {
    const category = pick(rng, categories);
    let player: Card[];
    if (category === 'pair') {
      const r = pick(rng, RANKS);
      player = [{ rank: r, suit: 'S' }, { rank: r, suit: 'H' }];
    } else if (category === 'soft') {
      player = [{ rank: 'A', suit: 'S' }, randomCard(rng, ['2', '3', '4', '5', '6', '7', '8', '9'])];
    } else {
      player = [randomCard(rng), randomCard(rng)];
    }
    const v = evaluate(player);
    const isPairHand = player[0].rank === player[1].rank;
    if (category === 'hard' && (v.soft || isPairHand || v.total === 21)) continue;
    if (category === 'hard' && v.total < 5) continue;
    const upcard = randomCard(rng);
    const canDouble = canDoubleTotal(rules, v.total, v.soft);
    const ctx = { canDouble, canSplit: category === 'pair', canSurrender: rules.lateSurrender };
    const decision = decide(player, upcard, rules, ctx);
    return { player, upcard, category, canDouble, canSplit: ctx.canSplit, canSurrender: ctx.canSurrender, decision, dependsOn: ruleDependentOn(player, upcard, rules, ctx) };
  }
}

export function availableActions(q: Pick<StrategyQuestion, 'canDouble' | 'canSplit' | 'canSurrender'>): Action[] {
  const a: Action[] = ['hit', 'stand'];
  if (q.canDouble) a.push('double');
  if (q.canSplit) a.push('split');
  if (q.canSurrender) a.push('surrender');
  return a;
}

export function describeHand(q: Pick<StrategyQuestion, 'player' | 'category'>): string {
  const v = evaluate(q.player as Card[]);
  if (q.category === 'pair') return `pair of ${q.player[0].rank === 'A' ? 'aces' : `${rankPoints(q.player[0].rank) === 10 ? 'tens' : q.player[0].rank + 's'}`}`;
  return `${q.category} ${v.total}`;
}

/** Plain-language reason for the correct action. */
export function explain(q: StrategyQuestion): string {
  const up = upcardValue(q.upcard);
  const weak = up >= 2 && up <= 6;
  const desc = describeHand(q);
  const vs = `against a dealer ${q.upcard.rank}`;
  let why: string;
  switch (q.decision.action) {
    case 'surrender':
      why = `This is one of the worst spots in the game. Giving up half the bet loses less, on average, than playing it out.`;
      break;
    case 'double':
      why = weak
        ? `The dealer is likely to bust or end low, and your hand is strong enough that putting more money in is worth it.`
        : `Your total is high enough to be favored even against a strong card, so doubling earns more than a plain hit.`;
      break;
    case 'split':
      why = q.player[0].rank === 'A' || q.player[0].rank === '8'
        ? `Two hands starting from this card are much better than one awkward total.`
        : weak ? `The dealer is weak here, so two hands from this pair beat playing it as one total.` : `Splitting gives you two reasonable starts instead of one poor total.`;
      break;
    case 'stand':
      why = weak
        ? `The dealer has a high chance to bust ${vs}, so don't risk busting yourself.`
        : `Your total is good enough that drawing more costs you more than it gains.`;
      break;
    default:
      why = weak
        ? `Your total is too low to stand on, even though the dealer is weak.`
        : `A dealer ${q.upcard.rank} usually makes a hand, so you need to improve your total.`;
  }
  const fallback = q.decision.move === 'D' && !q.canDouble ? ' (Doubling is not allowed here under the table rules, so you hit.)'
    : q.decision.move === 'Ds' && !q.canDouble ? ' (Doubling is not allowed here under the table rules, so you stand.)' : '';
  const ruleNote = q.dependsOn.length > 0 ? ` This answer depends on the table rules: it would change with ${q.dependsOn.join(' or ')}.` : ' This answer is the same under the other common rule variations.';
  return `${why}${fallback}${ruleNote} (${desc} ${vs}.)`;
}

export interface CountItem { card: Card; category: HiLoCategory }

export function countSequence(rng: Rng, n: number): CountItem[] {
  return Array.from({ length: n }, () => { const card = randomCard(rng); return { card, category: hiLoCategory(card.rank) }; });
}

export interface TrueCountQuestion { running: number; decks: number; answer: number }
export function trueCountQuestion(rng: Rng): TrueCountQuestion {
  const decks = pick(rng, [1, 1.5, 2, 2.5, 3, 4, 5]);
  const running = Math.round((rng() * 2 - 0.35) * 12 * Math.max(1, decks / 2));
  return { running, decks, answer: trueCountScored(running, decks) };
}

/** For the tray-estimation drill: a random number of cards left in a shoe of `decks` decks. */
export function trayQuestion(rng: Rng, decks: number): { remaining: number; answer: number } {
  const remaining = Math.floor((0.2 + rng() * 0.8) * decks * 52);
  return { remaining, answer: estimateDecks(remaining) };
}
export { TENS };
