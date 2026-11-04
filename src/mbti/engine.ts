import { SCENARIOS } from './scenarios';
import { buildProfile, confidenceRank, DIMENSIONS, extractEvidence, POLES, scoreDimension } from './scoring';
import type { Answer, Dimension, Scenario } from './types';

export const MAX_QUESTIONS = 7;
export const MIN_QUESTIONS = 5;
const SECONDS_PER_QUESTION = 45;

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** True when an answer says nothing about its own dimension, so one clarifying question is warranted. */
export function needsFollowUp(scenario: Scenario, text: string): boolean {
  if (wordCount(text) < 4) return true;
  const [a, b] = POLES[scenario.dimension];
  return !extractEvidence(text, scenario.id).some((e) => e.pole === a || e.pole === b);
}

export function enoughEvidence(answers: Answer[]): boolean {
  const answered = answers.filter((a) => !a.skipped).length;
  if (answered < MIN_QUESTIONS) return false;
  return DIMENSIONS.every((d) => confidenceRank(scoreDimension(d, answers).confidence) >= 2);
}

export function isFinished(answers: Answer[]): boolean {
  return answers.length >= MAX_QUESTIONS || enoughEvidence(answers);
}

/**
 * Picks the next scenario. First every dimension is covered once (in canonical order); after that the
 * dimension with the least confidence, then the least evidence, is asked about, so an unclear dimension
 * keeps priority until it clears or runs out of questions. Deterministic. Null when none remain.
 */
export function nextScenario(answers: Answer[]): Scenario | null {
  const used = new Set(answers.map((a) => a.scenarioId));
  const asked = (d: Dimension) => SCENARIOS.filter((s) => s.dimension === d && used.has(s.id)).length;
  const open = DIMENSIONS.filter((d) => SCENARIOS.some((s) => s.dimension === d && !used.has(s.id)));
  const uncovered = open.filter((d) => asked(d) === 0);
  const pool = uncovered.length ? uncovered : open;
  const pick = pool
    .map((d) => { const r = scoreDimension(d, answers); return { d, rank: confidenceRank(r.confidence), evidence: r.evidence.length, asked: asked(d) }; })
    .sort((x, y) => x.rank - y.rank || x.evidence - y.evidence || x.asked - y.asked || DIMENSIONS.indexOf(x.d) - DIMENSIONS.indexOf(y.d))[0];
  return pick ? SCENARIOS.find((s) => s.dimension === pick.d && !used.has(s.id)) ?? null : null;
}

export function minutesLeft(answers: Answer[]): number {
  const remaining = Math.max(0, (enoughEvidence(answers) ? 0 : MAX_QUESTIONS - answers.length)) * SECONDS_PER_QUESTION;
  return Math.max(1, Math.ceil(remaining / 60));
}

export { buildProfile };
