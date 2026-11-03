import type { HiLoCategory } from './cards';
import type { Category } from './strategy';

export interface Tally { right: number; total: number }
const zero = (): Tally => ({ right: 0, total: 0 });

export interface Progress {
  version: 1;
  strategy: Record<Category, Tally>;
  /** "hard 16 vs 10" -> misses, to suggest drills. */
  strategyMisses: Record<string, number>;
  classify: Record<HiLoCategory, Tally>;
  runningCount: Tally;
  runningCountMs: number[];
  trueCount: Tally;
  deckEstimate: { count: number; absError: number };
  bets: Tally;
  roundsPlayed: number;
  netUnits: number;
}

export const emptyProgress = (): Progress => ({
  version: 1,
  strategy: { hard: zero(), soft: zero(), pair: zero() },
  strategyMisses: {},
  classify: { low: zero(), neutral: zero(), high: zero() },
  runningCount: zero(), runningCountMs: [],
  trueCount: zero(), deckEstimate: { count: 0, absError: 0 },
  bets: zero(), roundsPlayed: 0, netUnits: 0,
});

const bump = (t: Tally, ok: boolean): Tally => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 });

export const recordStrategy = (p: Progress, category: Category, label: string, ok: boolean): Progress => ({
  ...p,
  strategy: { ...p.strategy, [category]: bump(p.strategy[category], ok) },
  strategyMisses: ok ? p.strategyMisses : { ...p.strategyMisses, [label]: (p.strategyMisses[label] ?? 0) + 1 },
});
export const recordClassify = (p: Progress, cat: HiLoCategory, ok: boolean): Progress => ({ ...p, classify: { ...p.classify, [cat]: bump(p.classify[cat], ok) } });
export const recordRunningCount = (p: Progress, ok: boolean, ms: number | null): Progress => ({
  ...p, runningCount: bump(p.runningCount, ok), runningCountMs: ms === null ? p.runningCountMs : [...p.runningCountMs, Math.round(ms)].slice(-50),
});
export const recordTrueCount = (p: Progress, ok: boolean): Progress => ({ ...p, trueCount: bump(p.trueCount, ok) });
export const recordDeckEstimate = (p: Progress, error: number): Progress => ({ ...p, deckEstimate: { count: p.deckEstimate.count + 1, absError: p.deckEstimate.absError + Math.abs(error) } });
export const recordBet = (p: Progress, ok: boolean): Progress => ({ ...p, bets: bump(p.bets, ok) });
export const recordRound = (p: Progress, net: number): Progress => ({ ...p, roundsPlayed: p.roundsPlayed + 1, netUnits: p.netUnits + net });

export const pct = (t: Tally): string => (t.total === 0 ? 'n/a' : `${Math.round((t.right / t.total) * 100)}%`);

/** Drill suggestions from the weakest recorded areas. */
export function suggestions(p: Progress): string[] {
  const out: string[] = [];
  const weak = (t: Tally, min = 5) => t.total >= min && t.right / t.total < 0.85;
  (['hard', 'soft', 'pair'] as const).forEach((c) => { if (weak(p.strategy[c])) out.push(`Strategy quiz: ${c} hands (${pct(p.strategy[c])} correct)`); });
  (['low', 'neutral', 'high'] as const).forEach((c) => { if (weak(p.classify[c], 8)) out.push(`Counting drill: ${c === 'low' ? '2-6' : c === 'neutral' ? '7-9' : '10-A'} cards (${pct(p.classify[c])} correct)`); });
  if (weak(p.runningCount, 3)) out.push('Speed drill: keep a running count at a slower pace');
  if (weak(p.trueCount, 3)) out.push('True count drill: practice dividing by decks remaining');
  if (weak(p.bets, 3)) out.push('Betting: review the practice schedule in Learn');
  const worst = Object.entries(p.strategyMisses).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2) out.push(`Most missed spot: ${worst[0]} (${worst[1]} misses)`);
  return out;
}

const KEY = 'blackjack-progress-v1';
export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw?.version === 1) return { ...emptyProgress(), ...raw };
  } catch { /* unavailable or corrupt: start fresh */ }
  return emptyProgress();
}
export function saveProgress(p: Progress): void { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } }
export function clearProgress(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
