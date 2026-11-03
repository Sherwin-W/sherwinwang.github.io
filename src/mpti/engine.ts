import { SCENARIOS } from './scenarios';
import { buildProfile, confidenceRank, DIMENSIONS, extractEvidence, POLES, scoreDimension } from './scoring';
import type { Answer, Dimension, Scenario } from './types';

export const MAX_QUESTIONS = 6;
export const MIN_QUESTIONS = 3;
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
 * Picks the next scenario from the dimension with the least evidence. Ties go to the
 * dimension asked about least, then to the canonical order, so the result is deterministic.
 * Returns null when no unused scenario remains.
 */
export function nextScenario(answers: Answer[]): Scenario | null {
  const used = new Set(answers.map((a) => a.scenarioId));
  const asked = (d: Dimension) => SCENARIOS.filter((s) => s.dimension === d && used.has(s.id)).length;
  const candidates = DIMENSIONS
    .filter((d) => SCENARIOS.some((s) => s.dimension === d && !used.has(s.id)))
    .map((d) => {
      const r = scoreDimension(d, answers);
      return { d, rank: confidenceRank(r.confidence), evidence: r.evidence.length, asked: asked(d) };
    })
    .sort((x, y) => x.asked - y.asked || x.rank - y.rank || x.evidence - y.evidence || DIMENSIONS.indexOf(x.d) - DIMENSIONS.indexOf(y.d));
  const pick = candidates[0];
  return pick ? SCENARIOS.find((s) => s.dimension === pick.d && !used.has(s.id)) ?? null : null;
}

export function minutesLeft(answers: Answer[]): number {
  const remaining = Math.max(0, (enoughEvidence(answers) ? 0 : MAX_QUESTIONS - answers.length)) * SECONDS_PER_QUESTION;
  return Math.max(1, Math.ceil(remaining / 60));
}

export { buildProfile };
