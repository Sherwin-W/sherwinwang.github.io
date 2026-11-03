import { rankPoints, upcardValue, type Card } from './cards';
import { evaluate, isPair } from './hand';
import type { Rules } from './rules';

export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender';
/** Chart cell. D = double else hit, Ds = double else stand, Rh/Rs/Rp = surrender else hit/stand/split. */
export type Move = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'Rh' | 'Rs' | 'Rp';
export type Category = 'hard' | 'soft' | 'pair';

export interface Context { canDouble: boolean; canSplit: boolean; canSurrender: boolean }
export interface Decision { action: Action; move: Move; category: Category; key: number }

const between = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

/**
 * Multi-deck (4-8) basic strategy, dealer peeks for blackjack. Tables follow the widely
 * published multi-deck charts; the cells that depend on the rules are H17/S17, DAS and
 * late surrender. Doubling restrictions are handled by the D/Ds fallbacks.
 */
export function hardMove(total: number, up: number, r: Rules): Move {
  if (total >= 17) return r.dealerHitsSoft17 && total === 17 && up === 11 ? 'Rs' : 'S';
  if (total === 16) return up >= 9 ? 'Rh' : up <= 6 ? 'S' : 'H';
  if (total === 15) {
    if (up === 10) return 'Rh';
    if (up === 11) return r.dealerHitsSoft17 ? 'Rh' : 'H';
    return up <= 6 ? 'S' : 'H';
  }
  if (total === 13 || total === 14) return up <= 6 ? 'S' : 'H';
  if (total === 12) return between(up, 4, 6) ? 'S' : 'H';
  if (total === 11) return up === 11 && !r.dealerHitsSoft17 ? 'H' : 'D';
  if (total === 10) return up <= 9 ? 'D' : 'H';
  if (total === 9) return between(up, 3, 6) ? 'D' : 'H';
  return 'H';
}

export function softMove(total: number, up: number, r: Rules): Move {
  if (total >= 20) return 'S';
  if (total === 19) return r.dealerHitsSoft17 && up === 6 ? 'Ds' : 'S';
  if (total === 18) {
    if (up === 2) return r.dealerHitsSoft17 ? 'Ds' : 'S';
    if (between(up, 3, 6)) return 'Ds';
    return up <= 8 ? 'S' : 'H';
  }
  if (total === 17) return between(up, 3, 6) ? 'D' : 'H';
  if (total === 15 || total === 16) return between(up, 4, 6) ? 'D' : 'H';
  if (total <= 12) return 'H'; // A,A that cannot be split
  return between(up, 5, 6) ? 'D' : 'H'; // soft 13, 14
}

/** Returns 'P' / 'Rp' when the pair should be split; null means play it as a hard/soft total. */
export function pairMove(pairValue: number, up: number, r: Rules): Move | null {
  switch (pairValue) {
    case 11: return 'P';
    case 9: return between(up, 2, 6) || up === 8 || up === 9 ? 'P' : null;
    case 8: return up === 11 && r.dealerHitsSoft17 ? 'Rp' : 'P';
    case 7: return up <= 7 ? 'P' : null;
    case 6: return between(up, r.doubleAfterSplit ? 2 : 3, 6) ? 'P' : null;
    case 4: return r.doubleAfterSplit && between(up, 5, 6) ? 'P' : null;
    case 3:
    case 2: return between(up, r.doubleAfterSplit ? 2 : 4, 7) ? 'P' : null;
    default: return null; // 10s and 5s are never split
  }
}

export function categoryOf(cards: readonly Card[], canSplit: boolean): Category {
  if (canSplit && isPair(cards)) return 'pair';
  return evaluate(cards).soft ? 'soft' : 'hard';
}

/** The chart cell for a hand, before it is checked against what is currently legal. */
export function chartMove(cards: readonly Card[], upcard: Card, rules: Rules, canSplit: boolean): { move: Move; category: Category; key: number } {
  const up = upcardValue(upcard);
  if (canSplit && isPair(cards)) {
    const value = cards[0].rank === 'A' ? 11 : rankPoints(cards[0].rank);
    const m = pairMove(value, up, rules);
    if (m) return { move: m, category: 'pair', key: value };
  }
  const v = evaluate(cards);
  return v.soft
    ? { move: softMove(v.total, up, rules), category: 'soft', key: v.total }
    : { move: hardMove(v.total, up, rules), category: 'hard', key: v.total };
}

/** The basic-strategy action given what is currently legal. */
export function decide(cards: readonly Card[], upcard: Card, rules: Rules, ctx: Context): Decision {
  const { move, category, key } = chartMove(cards, upcard, rules, ctx.canSplit);
  let action: Action;
  switch (move) {
    case 'H': action = 'hit'; break;
    case 'S': action = 'stand'; break;
    case 'D': action = ctx.canDouble ? 'double' : 'hit'; break;
    case 'Ds': action = ctx.canDouble ? 'double' : 'stand'; break;
    case 'P': action = 'split'; break;
    case 'Rh': action = ctx.canSurrender ? 'surrender' : 'hit'; break;
    case 'Rs': action = ctx.canSurrender ? 'surrender' : 'stand'; break;
    case 'Rp': action = ctx.canSurrender ? 'surrender' : 'split'; break;
  }
  return { action, move, category, key };
}

/** True when changing one rule changes the correct action for this exact spot. */
export function ruleDependentOn(cards: readonly Card[], upcard: Card, rules: Rules, ctx: Context): string[] {
  const base = decide(cards, upcard, rules, ctx).action;
  const out: string[] = [];
  const alt = (label: string, r: Rules, c: Context = ctx) => { if (decide(cards, upcard, r, c).action !== base) out.push(label); };
  alt(rules.dealerHitsSoft17 ? 'dealer standing on soft 17' : 'dealer hitting soft 17', { ...rules, dealerHitsSoft17: !rules.dealerHitsSoft17 });
  alt(rules.doubleAfterSplit ? 'no double after split' : 'double after split', { ...rules, doubleAfterSplit: !rules.doubleAfterSplit });
  alt(ctx.canSurrender ? 'surrender not being offered' : 'late surrender', rules, { ...ctx, canSurrender: !ctx.canSurrender });
  return out;
}

export const ACTION_LABEL: Record<Action, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };
