/**
 * Combines evidence from both stages into a reading. Deterministic and transparent: every point of
 * evidence is a quoted sentence the person said, the pattern it matched, and a plain-language reason.
 * There is no hidden model and no claim of deep understanding: this reads stated preferences.
 */
import { CUES, type Cue } from './lexicon';
import { DIMENSIONS, POLES, POLE_NAMES, sentences } from './scoring';
import type { Confidence, Dimension, Pole } from './types';

export interface RubricCue { pole: Pole; label: string; pattern: RegExp; weight: number }

export interface Response {
  /** Question or scene id. */
  id: string;
  stage: 1 | 2;
  prompt: string;
  text: string;
  skipped: boolean;
  /** Scene-specific patterns (Stage 2), read in the context of that scene's prompt. */
  rubric?: RubricCue[];
}

export interface Evidence {
  pole: Pole;
  quote: string;
  /** What the sentence was read as, e.g. "wanting to go out even when plans fall through". */
  label: string;
  responseId: string;
  stage: 1 | 2;
  weight: number;
  hedged: boolean;
  general: boolean;
}

export interface DimensionReading {
  dimension: Dimension;
  preference: Pole | null;
  confidence: Confidence;
  /** -1..1 toward the first pole of the pair (E, S, T, J). */
  lean: number;
  evidence: Evidence[];
  /** Lean per stage, or null when that stage had no evidence for this pair. */
  stageLean: { 1: number | null; 2: number | null };
  /** Plain-language notes: disagreement between stages, thin evidence, close calls. */
  notes: string[];
}

export interface Reading {
  type: string;
  dimensions: Record<Dimension, DimensionReading>;
  answered: { 1: number; 2: number };
  alternatives: string[];
}

const NEGATION = /\b(?:not|never|don't|dont|do not|doesn't|didn't|no|hardly|rarely|without|wouldn't|won't|can't)\b(?:(?!\bbut\b)[^.!?,;]){0,20}$/i;
const ABOUT_SOMEONE_ELSE = /^(?:(?:my|his|her|their|our) (?:friend|friends|partner|mom|mum|dad|brother|sister|boss|colleague|coworker|roommate|family|kids?|wife|husband)|(?:he|she|they)) (?:is|was|are|were|loves?|likes?|hates?|always|never|tends?)\b/i;
const HEDGE = /\b(?:maybe|perhaps|probably|i guess|kind of|sort of|it depends|depends|not sure|i suppose|might)\b/i;
const GENERAL = /\b(?:usually|generally|always|normally|in general|most of the time|tend to|by nature|i'?m (?:a|the) (?:kind|type) of person|that'?s just (?:how|who) i am)\b/i;

/** Answers in a scene are situational; a general statement anywhere counts more. */
export const STAGE_WEIGHT = { 1: 1, 2: 0.8 } as const;
/** No single answer can contribute more than this to one pole: one reply never decides a letter. */
export const PER_RESPONSE_CAP = 3;

function matchCues(sentence: string, cues: readonly (Cue | RubricCue)[]): { cue: Cue | RubricCue; index: number }[] {
  const out: { cue: Cue | RubricCue; index: number }[] = [];
  for (const cue of cues) {
    const m = cue.pattern.exec(sentence);
    if (!m || NEGATION.test(sentence.slice(0, m.index))) continue;
    out.push({ cue, index: m.index });
  }
  return out;
}

/** Evidence from one response: general cues plus the scene's own rubric, with context weights. */
export function evidenceFor(r: Response): Evidence[] {
  if (r.skipped || !r.text.trim()) return [];
  const found: Evidence[] = [];
  for (const sentence of sentences(r.text)) {
    if (ABOUT_SOMEONE_ELSE.test(sentence) && !/\b(?:I|me|my own|myself)\b/.test(sentence.replace(/^\w+\s/, ''))) continue;
    const hedged = HEDGE.test(sentence);
    const general = GENERAL.test(sentence);
    const factor = STAGE_WEIGHT[r.stage] * (hedged ? 0.5 : 1) * (general ? 1.5 : 1);
    // A rubric cue (read in the scene's context) wins over a generic cue for the same pole in a sentence.
    const hits = [...matchCues(sentence, r.rubric ?? []), ...matchCues(sentence, CUES)];
    const seen = new Set<Pole>();
    for (const { cue } of hits) {
      if (seen.has(cue.pole)) continue;
      seen.add(cue.pole);
      found.push({ pole: cue.pole, quote: sentence, label: cue.label, responseId: r.id, stage: r.stage, weight: cue.weight * factor, hedged, general });
    }
  }
  return found;
}

const sumCapped = (ev: Evidence[], pole: Pole): number => {
  const per = new Map<string, number>();
  for (const e of ev) if (e.pole === pole) per.set(e.responseId, (per.get(e.responseId) ?? 0) + e.weight);
  return [...per.values()].reduce((n, w) => n + Math.min(PER_RESPONSE_CAP, w), 0);
};

const leanOf = (ev: Evidence[], a: Pole, b: Pole): number | null => {
  const x = sumCapped(ev, a), y = sumCapped(ev, b);
  return x + y === 0 ? null : (x - y) / (x + y);
};

export function readDimension(d: Dimension, responses: Response[], all = responses.flatMap(evidenceFor)): DimensionReading {
  const [first, second] = POLES[d];
  const evidence = all.filter((e) => e.pole === first || e.pole === second);
  const a = sumCapped(evidence, first), b = sumCapped(evidence, second);
  const total = a + b;
  const lean = total === 0 ? 0 : (a - b) / total;
  const preference: Pole | null = total === 0 || Math.abs(a - b) < 0.25 ? null : a > b ? first : second;
  const supporting = new Set(evidence.filter((e) => e.pole === preference).map((e) => e.responseId)).size;
  const stageLean = { 1: leanOf(evidence.filter((e) => e.stage === 1), first, second), 2: leanOf(evidence.filter((e) => e.stage === 2), first, second) };
  const stagesAgree = stageLean[1] === null || stageLean[2] === null || Math.sign(stageLean[1]) === Math.sign(stageLean[2]);
  let confidence: Confidence = 'unclear';
  if (preference) {
    const margin = Math.abs(a - b);
    if (margin >= 4 && supporting >= 3 && Math.abs(lean) >= 0.5 && stagesAgree) confidence = 'high';
    else if (margin >= 2 && supporting >= 2 && Math.abs(lean) >= 0.3) confidence = 'medium';
    else confidence = 'low';
  }
  const notes: string[] = [];
  if (!preference && total === 0) notes.push(`Nothing you said pointed toward ${POLE_NAMES[first]} or ${POLE_NAMES[second]}.`);
  else if (!preference) notes.push(`Your answers pointed both ways about equally.`);
  if (!stagesAgree) {
    const s1 = stageLean[1]! > 0 ? first : second, s2 = stageLean[2]! > 0 ? first : second;
    notes.push(`In the questions you leaned ${POLE_NAMES[s1]}; in the scenes you leaned ${POLE_NAMES[s2]}. That can be situational: people often act differently with different people.`);
  }
  if (preference && confidence === 'low') notes.push(`Only a little evidence, so ${POLE_NAMES[preference === first ? second : first]} is just as plausible.`);
  return { dimension: d, preference, confidence, lean, evidence, stageLean, notes };
}

export function readAll(responses: Response[]): Reading {
  const all = responses.flatMap(evidenceFor);
  const dimensions = Object.fromEntries(DIMENSIONS.map((d) => [d, readDimension(d, responses, all)])) as Record<Dimension, DimensionReading>;
  const type = DIMENSIONS.map((d) => dimensions[d].preference ?? 'X').join('');
  // Alternatives: flip the least certain dimensions (not already undetermined).
  const rank: Record<Confidence, number> = { unclear: 0, low: 1, medium: 2, high: 3 };
  const weakest = DIMENSIONS.filter((d) => dimensions[d].preference && rank[dimensions[d].confidence] <= 1)
    .sort((x, y) => rank[dimensions[x].confidence] - rank[dimensions[y].confidence] || Math.abs(dimensions[x].lean) - Math.abs(dimensions[y].lean));
  const alternatives = weakest.slice(0, 2).map((d) => {
    const [p, q] = POLES[d];
    return DIMENSIONS.map((x) => (x === d ? (dimensions[d].preference === p ? q : p) : dimensions[x].preference ?? 'X')).join('');
  });
  return {
    type,
    dimensions,
    answered: { 1: responses.filter((r) => r.stage === 1 && !r.skipped && r.text.trim()).length, 2: responses.filter((r) => r.stage === 2 && !r.skipped && r.text.trim()).length },
    alternatives,
  };
}

/** True when an answer gives no evidence for the dimensions it was meant to explore. */
export function needsClarification(r: Response, dims: Dimension[]): boolean {
  if (r.text.trim().split(/\s+/).length < 4) return true;
  const ev = evidenceFor(r);
  return !dims.some((d) => ev.some((e) => POLES[d].includes(e.pole)));
}

/**
 * Tidies a speech transcript for display and scoring: collapses whitespace, drops filler words and
 * stutter repeats ("I I think"), capitalises the first letter. Never adds words.
 */
export function cleanTranscript(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim();
  t = t.replace(/\b(?:um+|uh+|erm+|uhm+|hmm+)\b[,.]?\s*/gi, '');
  t = t.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
  t = t.replace(/\s+([,.!?])/g, '$1').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
