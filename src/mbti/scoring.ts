import { CUES } from './lexicon';
import type { Answer, Confidence, Dimension, DimensionResult, Evidence, Pole, Profile } from './types';

export const DIMENSIONS: Dimension[] = ['EI', 'SN', 'TF', 'JP'];
export const POLES: Record<Dimension, [Pole, Pole]> = { EI: ['E', 'I'], SN: ['S', 'N'], TF: ['T', 'F'], JP: ['J', 'P'] };
export const POLE_NAMES: Record<Pole, string> = {
  E: 'Extraversion', I: 'Introversion', S: 'Sensing', N: 'Intuition', T: 'Thinking', F: 'Feeling', J: 'Judging', P: 'Perceiving',
};

export const LIMITATIONS =
  'This is an exploratory reading of a short conversation, based only on the words you used. It is not a validated psychological test, and should not be used for hiring, diagnosis or any important decision.';

/** Splits text into sentences, keeping the original wording. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

// A negation only reaches forward within its own clause: "not spontaneous, but I plan ahead" keeps "plan".
const NEGATION = /\b(?:not|never|don't|dont|do not|doesn't|didn't|no|hardly|rarely|without)\b(?:(?!\bbut\b)[^.!?,;]){0,20}$/i;
/** Sentences about someone else ("My friend is outgoing") say nothing about the person answering. */
const ABOUT_SOMEONE_ELSE = /^(?:(?:my|his|her|their|our) (?:friend|friends|partner|mom|mum|dad|brother|sister|boss|colleague|coworker|roommate|family|kids?|wife|husband)|(?:he|she|they)) (?:is|was|are|were|loves?|likes?|hates?|always|never|tends?)\b/i;

/** All cue matches in the text. A cue directly after a negation is ignored. */
export function extractEvidence(text: string, scenarioId: string): Evidence[] {
  const found: Evidence[] = [];
  for (const sentence of sentences(text)) {
    if (ABOUT_SOMEONE_ELSE.test(sentence) && !/\b(?:I|me|my own|myself)\b/.test(sentence.replace(/^\w+\s/, ''))) continue;
    for (const cue of CUES) {
      const m = cue.pattern.exec(sentence);
      if (!m) continue;
      if (NEGATION.test(sentence.slice(0, m.index))) continue;
      found.push({ pole: cue.pole, quote: sentence, cue: cue.label, scenarioId });
    }
  }
  return found;
}

const weightOf = (e: Evidence) => CUES.find((c) => c.label === e.cue && c.pole === e.pole)?.weight ?? 1;

export function scoreDimension(dimension: Dimension, answers: Answer[]): DimensionResult {
  const [first, second] = POLES[dimension];
  const evidence = answers.filter((a) => !a.skipped).flatMap((a) => extractEvidence(a.text, a.scenarioId))
    .filter((e) => e.pole === first || e.pole === second);
  // One sentence can match several cues of the same pole; count each (pole, sentence) once.
  const seen = new Set<string>();
  const unique = evidence.filter((e) => { const k = `${e.pole}|${e.quote}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const a = unique.filter((e) => e.pole === first).reduce((n, e) => n + weightOf(e), 0);
  const b = unique.filter((e) => e.pole === second).reduce((n, e) => n + weightOf(e), 0);
  const total = a + b;
  const lean = total === 0 ? 0 : (a - b) / total;
  const preference = total === 0 || a === b ? null : a > b ? first : second;
  const supporting = unique.filter((e) => e.pole === preference).length;
  const scenarios = new Set(unique.filter((e) => e.pole === preference).map((e) => e.scenarioId)).size;
  let confidence: Confidence = 'unclear';
  if (preference) {
    const margin = Math.abs(a - b);
    if (margin >= 4 && scenarios >= 2 && Math.abs(lean) >= 0.5) confidence = 'high';
    else if (margin >= 2 && supporting >= 2 && Math.abs(lean) >= 0.3) confidence = 'medium';
    else confidence = 'low';
  }
  return { dimension, preference, confidence, lean, evidence: unique };
}

export function buildProfile(answers: Answer[]): Profile {
  const dimensions = Object.fromEntries(DIMENSIONS.map((d) => [d, scoreDimension(d, answers)])) as Profile['dimensions'];
  const type = DIMENSIONS.map((d) => dimensions[d].preference ?? 'X').join('');
  return { type, dimensions, answered: answers.filter((a) => !a.skipped).length, limitations: LIMITATIONS };
}

const RANK: Record<Confidence, number> = { unclear: 0, low: 1, medium: 2, high: 3 };

export function confidenceRank(c: Confidence): number { return RANK[c]; }
