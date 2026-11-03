/**
 * Campaign rules that sit on top of the engine: difficulties, the assistance-removal schedule,
 * grading, the flow meter, and the end-of-shoe report. Pure functions, no React.
 */
import { scheduledBet, estimateDecks, trueCountScored, DEFAULT_SCHEDULE } from '../engine/count';
import type { Category } from '../engine/strategy';
import type { Tally } from '../engine/stats';
import { SYSTEMS, type CountingSystem, type SystemId } from '../engine/systems';

export type Difficulty = 'recruit' | 'operator' | 'grandmaster';

export interface DifficultyConfig {
  id: Difficulty;
  name: string;
  focus: string;
  /** Counting system, or null for strategy-only play. */
  system: SystemId | null;
  blurb: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  recruit: { id: 'recruit', name: 'Recruit', focus: 'Basic strategy', system: null, blurb: 'Every decision is graded against basic strategy for the table rules. No count, no wagers. Reference chart always available.' },
  operator: { id: 'operator', name: 'Operator', focus: 'Hi-Lo', system: 'hilo', blurb: 'Basic strategy plus the Hi-Lo count: count checkpoints, true-count conversion and practice wagers. Help is removed as the shoe goes on.' },
  grandmaster: { id: 'grandmaster', name: 'Grandmaster', focus: 'Wong Halves', system: 'wong', blurb: 'Wong Halves, a fractional count with six tag values. Same checkpoints and wagers, much more to track.' },
};

export const systemFor = (d: Difficulty): CountingSystem | null => {
  const id = DIFFICULTIES[d].system;
  return id ? SYSTEMS[id] : null;
};
export const isCounting = (d: Difficulty): boolean => DIFFICULTIES[d].system !== null;

// ---------- Assistance removal ----------

export type AssistTool = 'counter' | 'calculator' | 'aces';
/**
 * Cards exposed to the player at which each tool goes offline (Operator and Grandmaster).
 * The counter and the true-count calculator go together at 100; ace tracking at 150.
 */
export const ASSIST_THRESHOLDS: Record<AssistTool, number> = { counter: 100, calculator: 100, aces: 150 };
export const ASSIST_NAMES: Record<AssistTool, string> = { counter: 'manual counter', calculator: 'true-count calculator', aces: 'ace tracker' };
const TOOLS: AssistTool[] = ['counter', 'calculator', 'aces'];
/** Warn this many exposed cards before tools go offline. */
export const WARN_WITHIN = 20;

export function assistAvailable(d: Difficulty, exposed: number): Record<AssistTool, boolean> {
  const on = isCounting(d);
  return {
    counter: on && exposed < ASSIST_THRESHOLDS.counter,
    calculator: on && exposed < ASSIST_THRESHOLDS.calculator,
    aces: on && exposed < ASSIST_THRESHOLDS.aces,
  };
}

/** The next group of tools to go offline, if it is within the warning window. */
export function upcomingRemoval(d: Difficulty, exposed: number, within = WARN_WITHIN): { tools: AssistTool[]; at: number; inCards: number } | null {
  if (!isCounting(d)) return null;
  const at = Math.min(...TOOLS.map((t) => ASSIST_THRESHOLDS[t]).filter((n) => n > exposed));
  if (!Number.isFinite(at) || at - exposed > within) return null;
  return { tools: TOOLS.filter((t) => ASSIST_THRESHOLDS[t] === at), at, inCards: at - exposed };
}

/** Tools that were available before and are gone after this many cards were exposed. */
export function removedBetween(d: Difficulty, before: number, after: number): AssistTool[] {
  const a = assistAvailable(d, before), b = assistAvailable(d, after);
  return TOOLS.filter((t) => a[t] && !b[t]);
}

export const toolList = (tools: AssistTool[]): string => tools.map((t) => ASSIST_NAMES[t]).join(' and ');

// ---------- Ask the Dealer ----------

/** From this many exposed cards, dealer advice costs coins (Operator and Grandmaster). */
export const DEALER_PAID_FROM = 150;
/** Recruit is the basic-strategy school: its dealer stays free for the whole shoe. */
export const dealerIsPaid = (d: Difficulty, exposed: number): boolean => isCounting(d) && exposed >= DEALER_PAID_FROM;
/** The nth paid hint of a run costs n coins. */
export const hintPrice = (paidSoFar: number): number => paidSoFar + 1;

export interface HintLedger { bank: number; paid: number; revealed: ReadonlySet<string> }
export type HintResult = 'free' | 'bought' | 'already' | 'insufficient';

/**
 * Reveals advice for one decision. Free before the threshold; afterwards it costs `paid + 1` coins.
 * Charges only when new advice is revealed, never twice for the same decision, never below zero.
 */
export function revealHint(l: HintLedger, key: string, paidMode: boolean): { ledger: HintLedger; result: HintResult; cost: number } {
  if (l.revealed.has(key)) return { ledger: l, result: 'already', cost: 0 };
  const revealed = new Set(l.revealed).add(key);
  if (!paidMode) return { ledger: { ...l, revealed }, result: 'free', cost: 0 };
  const cost = hintPrice(l.paid);
  if (l.bank < cost) return { ledger: l, result: 'insufficient', cost: 0 };
  return { ledger: { bank: l.bank - cost, paid: l.paid + 1, revealed }, result: 'bought', cost };
}

// ---------- Golden cards ----------

/**
 * Golden-card rule: each golden card is settled once, at the first strategy decision it takes part in
 * (the active hand's cards and the dealer's upcard; the insurance decision counts). A correct,
 * unassisted decision pays one coin per newly settled golden card; a wrong or advised decision settles
 * it with no coin. A settled card never pays again.
 */
export function settleGolden(participants: readonly { gold?: number }[], settled: ReadonlySet<number>, ok: boolean, assisted: boolean): { settle: number[]; pay: number[] } {
  const fresh = [...new Set(participants.map((c) => c.gold).filter((g): g is number => g !== undefined && !settled.has(g)))];
  return { settle: fresh, pay: ok && !assisted ? fresh : [] };
}

// ---------- Checkpoints and grading ----------

/** A count checkpoint comes due every half deck of exposed cards (between rounds). */
export const CHECKPOINT_EVERY = 26;
export const checkpointDue = (d: Difficulty, exposed: number, lastCheckpoint: number): boolean =>
  isCounting(d) && exposed - lastCheckpoint >= CHECKPOINT_EVERY;

/**
 * True count used for scoring: running count ÷ decks remaining estimated to the nearest half deck,
 * truncated toward zero (the same convention as the drills).
 */
export const trueCountFor = (running2: number, cardsRemaining: number): number =>
  trueCountScored(running2 / 2, estimateDecks(cardsRemaining));

/**
 * Conversion is graded from the player's own running count, so one counting slip is not
 * scored twice. Counting accuracy is graded separately.
 */
export const expectedConversion = (playerRunning2: number, cardsRemaining: number): number => trueCountFor(playerRunning2, cardsRemaining);

/** The illustrative practice schedule, applied to the objective true count before the deal. */
export const expectedWager = (objectiveRunning2: number, cardsRemaining: number): number =>
  scheduledBet(trueCountFor(objectiveRunning2, cardsRemaining), DEFAULT_SCHEDULE);

export const WAGER_CHIPS = [1, 2, 4, 6, 8];

// ---------- Flow ----------

export type FlowKind = 'decision' | 'count' | 'trueCount' | 'wager' | 'insurance' | 'aces';
/** [gain when right, loss when wrong]. Outcomes of hands never move the meter. */
export const FLOW_DELTA: Record<FlowKind, [number, number]> = {
  decision: [6, 14],
  count: [10, 16],
  trueCount: [6, 10],
  wager: [4, 8],
  insurance: [4, 10],
  aces: [4, 6],
};
export const FLOW_TIERS = [25, 50, 75] as const;
export type FlowTier = 0 | 1 | 2 | 3;

export const tierOf = (v: number): FlowTier => (v >= 75 ? 3 : v >= 50 ? 2 : v >= 25 ? 1 : 0);

export function applyFlow(value: number, kind: FlowKind, ok: boolean): { value: number; from: FlowTier; to: FlowTier } {
  const [gain, loss] = FLOW_DELTA[kind];
  const next = Math.max(0, Math.min(100, value + (ok ? gain : -loss)));
  return { value: next, from: tierOf(value), to: tierOf(next) };
}

/** Coins drop on correct decisions while the meter is at the top tier. Cosmetic only. */
export const dropsCoin = (flowAfter: number, ok: boolean): boolean => ok && tierOf(flowAfter) === 3;

// ---------- Run stats and report ----------

export type MistakeKind = 'decision' | 'count' | 'trueCount' | 'wager' | 'insurance' | 'aces';
export interface Mistake { kind: MistakeKind; round: number; title: string; detail: string }

export interface RunStats {
  rounds: number;
  decisions: Record<Category, Tally>;
  counts: Tally;
  trueCounts: Tally;
  wagers: Tally;
  insurance: Tally;
  aces: Tally;
  mistakes: Mistake[];
  flowPeak: number;
  /** Coins collected this run (flow drops and golden cards). */
  coins: number;
  goldCoins: number;
  coinsSpent: number;
  hintsFree: number;
  hintsPaid: number;
  /** Decisions made after seeing the dealer's advice for that exact decision. */
  assisted: number;
  /** Longest combo this run. */
  comboBest: number;
  net: number;
}

const z = (): Tally => ({ right: 0, total: 0 });
export const emptyStats = (): RunStats => ({
  rounds: 0, decisions: { hard: z(), soft: z(), pair: z() }, counts: z(), trueCounts: z(), wagers: z(), insurance: z(), aces: z(),
  mistakes: [], flowPeak: 0, coins: 0, goldCoins: 0, coinsSpent: 0, hintsFree: 0, hintsPaid: 0, assisted: 0, comboBest: 0, net: 0,
});
export const bump = (t: Tally, ok: boolean): Tally => ({ right: t.right + (ok ? 1 : 0), total: t.total + 1 });

export const decisionsTally = (s: RunStats): Tally => {
  const all = [s.decisions.hard, s.decisions.soft, s.decisions.pair, s.insurance];
  return { right: all.reduce((n, t) => n + t.right, 0), total: all.reduce((n, t) => n + t.total, 0) };
};

/** Score weights; categories with no attempts are dropped and the rest renormalised. */
export const SCORE_WEIGHTS = { decisions: 0.5, counts: 0.25, trueCounts: 0.1, wagers: 0.1, aces: 0.05 };

export function runScore(s: RunStats): number {
  const parts: [Tally, number][] = [
    [decisionsTally(s), SCORE_WEIGHTS.decisions], [s.counts, SCORE_WEIGHTS.counts], [s.trueCounts, SCORE_WEIGHTS.trueCounts],
    [s.wagers, SCORE_WEIGHTS.wagers], [s.aces, SCORE_WEIGHTS.aces],
  ];
  const used = parts.filter(([t]) => t.total > 0);
  const w = used.reduce((n, [, x]) => n + x, 0);
  if (w === 0) return 0;
  return Math.round((used.reduce((n, [t, x]) => n + (t.right / t.total) * x, 0) / w) * 1000) / 10;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export const gradeOf = (score: number): Grade => (score >= 97 ? 'S' : score >= 92 ? 'A' : score >= 85 ? 'B' : score >= 75 ? 'C' : 'D');

export function drillsFor(s: RunStats): string[] {
  const out: string[] = [];
  const weak = (t: Tally, min = 3) => t.total >= min && t.right / t.total < 0.85;
  (['hard', 'soft', 'pair'] as const).forEach((c) => { if (weak(s.decisions[c], 5)) out.push(`Training → Strategy quiz: ${c} hands`); });
  if (weak(s.insurance, 2)) out.push('Manual → insurance: basic strategy declines it');
  if (weak(s.counts, 2)) out.push('Training → Counting drills: build speed before the counter disappears');
  if (weak(s.trueCounts, 2)) out.push('Training → True count drill: divide by decks remaining');
  if (weak(s.wagers, 3)) out.push('Manual → practice wager schedule');
  return out;
}

// ---------- Combo multiplier ----------

/** Flow at which the combo meter unlocks; below it the combo is off and empty. */
export const COMBO_UNLOCK = 50;
/** From this multiplier the combo is in OVERDRIVE. */
export const COMBO_OVERDRIVE = 10;

export interface Combo { active: boolean; count: number; best: number }
export const emptyCombo = (): Combo => ({ active: false, count: 0, best: 0 });

/** Graded events that are play decisions (and so build or break the combo). Counts and wagers only move flow. */
export const isPlayDecision = (kind: FlowKind): boolean => kind === 'decision' || kind === 'insurance';

/**
 * Advances the combo after one graded event, using the flow value after that event.
 * - Below 50% flow the combo is inactive and 0.
 * - Reaching 50% unlocks it. If a correct play decision got there, that decision is 1×;
 *   decisions before the unlock never count.
 * - While unlocked, each correct play decision adds 1 (no maximum); a wrong one resets it to 0.
 * - Count checks and wagers (`play: false`) and advised plays (`counted: false`) leave the streak alone.
 */
export function stepCombo(c: Combo, ok: boolean, flowAfter: number, play = true, counted = true): Combo {
  if (flowAfter < COMBO_UNLOCK) return { ...c, active: false, count: 0 };
  if (!play || !counted) return c.active ? c : { ...c, active: true, count: 0 };
  if (!ok) return { ...c, active: true, count: 0 };
  const count = c.count + 1;
  return { active: true, count, best: Math.max(c.best, count) };
}

/** Fire size for a multiplier: 0 none, 1 small … 5 full (5–9), 6 overdrive (10+). */
export type FireStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const fireStage = (count: number): FireStage =>
  (count <= 0 ? 0 : count >= COMBO_OVERDRIVE ? 6 : (Math.min(count, 5) as FireStage));

/** Flow milestones that play a border animation: crossing 50% upward, and the first 100% of a run. */
export type Milestone = 'power' | 'rainbow';
export function milestoneFor(before: number, after: number, reached100Before: boolean): Milestone | null {
  if (after >= 100 && before < 100 && !reached100Before) return 'rainbow';
  if (after >= COMBO_UNLOCK && before < COMBO_UNLOCK) return 'power';
  return null;
}
