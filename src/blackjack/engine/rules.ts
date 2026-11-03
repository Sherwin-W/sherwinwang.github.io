export type DoubleRule = 'any' | '9-11' | '10-11';

export interface Rules {
  decks: 4 | 6 | 8;
  dealerHitsSoft17: boolean;
  /** Blackjack pays 3:2 (1.5) or 6:5 (1.2). */
  blackjackPayout: 1.5 | 1.2;
  doubleOn: DoubleRule;
  doubleAfterSplit: boolean;
  lateSurrender: boolean;
  resplitAces: boolean;
  /** Insurance (and even money) offered on an ace upcard, before the dealer peeks. */
  insurance: boolean;
  /** Fraction of the shoe dealt before the cut card triggers a reshuffle. */
  penetration: number;
}

export const MAX_HANDS = 4;

/** Default: six decks, dealer hits soft 17, 3:2, double any two cards, DAS, late surrender. */
export const DEFAULT_RULES: Rules = {
  decks: 6,
  dealerHitsSoft17: true,
  blackjackPayout: 1.5,
  doubleOn: 'any',
  doubleAfterSplit: true,
  lateSurrender: true,
  resplitAces: false,
  insurance: true,
  penetration: 0.75,
};

export function normalizeRules(r: Partial<Rules>): Rules {
  const base = { ...DEFAULT_RULES, ...r };
  return {
    ...base,
    decks: ([4, 6, 8] as const).includes(base.decks) ? base.decks : 6,
    blackjackPayout: base.blackjackPayout === 1.2 ? 1.2 : 1.5,
    doubleOn: (['any', '9-11', '10-11'] as const).includes(base.doubleOn) ? base.doubleOn : 'any',
    insurance: base.insurance !== false,
    penetration: Math.min(0.85, Math.max(0.5, Number(base.penetration) || 0.75)),
  };
}

export function describeRules(r: Rules): string {
  return [
    `${r.decks} decks`,
    r.dealerHitsSoft17 ? 'H17' : 'S17',
    r.blackjackPayout === 1.5 ? '3:2' : '6:5',
    r.doubleOn === 'any' ? 'double any' : `double ${r.doubleOn}`,
    r.doubleAfterSplit ? 'DAS' : 'no DAS',
    r.lateSurrender ? 'late surrender' : 'no surrender',
    r.insurance ? 'insurance offered' : 'no insurance',
  ].join(' · ');
}

/** Whether the table's doubling restriction allows doubling a two-card hand with this value. */
export function canDoubleTotal(r: Rules, total: number, soft: boolean): boolean {
  if (r.doubleOn === 'any') return true;
  if (soft) return false;
  return r.doubleOn === '9-11' ? total >= 9 && total <= 11 : total >= 10 && total <= 11;
}
