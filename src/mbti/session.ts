/**
 * The whole session as one pure reducer: intro → Stage 1 questions → transition → Stage 2 scenes →
 * results. Everything lives in memory only; reset clears it. Pure so every transition is testable.
 */
import { isFinished, needsFollowUp, nextScenario, MIN_QUESTIONS } from './engine';
import { needsClarification, type Response } from './analysis';
import { SCENARIOS } from './scenarios';
import { MIN_SCENES, SCENES, sceneById } from './stage2/scenes';
import type { Answer } from './types';

export type Phase = 'intro' | 'stage1' | 'transition' | 'scenes' | 'scene' | 'results';
export type InputMode = 'voice' | 'text';

export interface SceneState { text: string; followedUp: boolean; done: boolean; skipped: boolean }

export interface State {
  phase: Phase;
  input: InputMode;
  answers: Answer[];
  /** Current Stage 1 question id. */
  question: string | null;
  followedUp: boolean;
  /** First answer kept while a clarifying question is asked. */
  carried: string;
  scenes: Record<string, SceneState>;
  /** Scene being played. */
  active: string | null;
}

export const initialState: State = { phase: 'intro', input: 'text', answers: [], question: null, followedUp: false, carried: '', scenes: {}, active: null };

export type Action =
  | { type: 'start'; input: InputMode }
  | { type: 'answer'; text: string }
  | { type: 'skip' }
  | { type: 'finishStage1' }
  | { type: 'toScenes' }
  | { type: 'openScene'; id: string }
  | { type: 'sceneAnswer'; text: string }
  | { type: 'skipScene' }
  | { type: 'closeScene' }
  | { type: 'results' }
  | { type: 'setInput'; input: InputMode }
  | { type: 'reset' };

const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ');

function afterStage1Answer(s: State, answers: Answer[]): State {
  const next = isFinished(answers) ? null : nextScenario(answers);
  return next
    ? { ...s, answers, question: next.id, followedUp: false, carried: '' }
    : { ...s, answers, question: null, followedUp: false, carried: '', phase: 'transition' };
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'start':
      return { ...initialState, phase: 'stage1', input: a.input, question: nextScenario([])?.id ?? null };
    case 'setInput':
      return { ...s, input: a.input };
    case 'answer': {
      if (s.phase !== 'stage1' || !s.question) return s;
      const q = SCENARIOS.find((x) => x.id === s.question)!;
      const text = join(s.carried, a.text);
      if (!text) return s;
      if (!s.followedUp && needsFollowUp(q, text)) return { ...s, followedUp: true, carried: text };
      return afterStage1Answer(s, [...s.answers, { scenarioId: q.id, text, skipped: false }]);
    }
    case 'skip':
      if (s.phase !== 'stage1' || !s.question) return s;
      return afterStage1Answer(s, [...s.answers, { scenarioId: s.question, text: s.carried, skipped: !s.carried }]);
    case 'finishStage1': {
      // Ends Stage 1 explicitly (kept: an unfinished draft the caller passes in via 'answer' first).
      if (s.phase !== 'stage1') return s;
      const answers = s.carried && s.question ? [...s.answers, { scenarioId: s.question, text: s.carried, skipped: false }] : s.answers;
      return { ...s, answers, question: null, followedUp: false, carried: '', phase: 'transition' };
    }
    case 'toScenes':
      return s.phase === 'transition' ? { ...s, phase: 'scenes' } : s;
    case 'openScene':
      return (s.phase === 'scenes' && sceneById(a.id)) ? { ...s, phase: 'scene', active: a.id, scenes: { ...s.scenes, [a.id]: s.scenes[a.id] ?? { text: '', followedUp: false, done: false, skipped: false } } } : s;
    case 'sceneAnswer': {
      if (s.phase !== 'scene' || !s.active) return s;
      const scene = sceneById(s.active)!;
      const cur = s.scenes[s.active];
      if (cur.done) return s;
      const text = join(cur.text, a.text);
      if (!text) return s;
      const probe: Response = { id: scene.id, stage: 2, prompt: scene.line, text, skipped: false, rubric: scene.rubric };
      if (!cur.followedUp && needsClarification(probe, scene.dimensions)) return { ...s, scenes: { ...s.scenes, [s.active]: { ...cur, text, followedUp: true } } };
      return { ...s, scenes: { ...s.scenes, [s.active]: { ...cur, text, done: true } } };
    }
    case 'skipScene': {
      if (s.phase !== 'scene' || !s.active) return s;
      const cur = s.scenes[s.active];
      return { ...s, scenes: { ...s.scenes, [s.active]: { ...cur, done: true, skipped: !cur.text } } };
    }
    case 'closeScene':
      return s.phase === 'scene' ? { ...s, phase: 'scenes', active: null } : s;
    case 'results':
      return s.phase === 'scenes' || s.phase === 'transition' ? { ...s, phase: 'results', active: null } : s;
    case 'reset':
      return initialState;
  }
}

export const stage1Count = (s: State) => s.answers.filter((x) => !x.skipped).length;
export const scenesDone = (s: State) => SCENES.filter((x) => s.scenes[x.id]?.done && !s.scenes[x.id].skipped).length;
export const canFinishStage1 = (s: State) => s.answers.length >= MIN_QUESTIONS || stage1Count(s) >= 3;
export const canSeeResults = (s: State) => scenesDone(s) >= MIN_SCENES || SCENES.every((x) => s.scenes[x.id]?.done);

/** Everything the person said, in the shape the analysis reads. */
export function responses(s: State): Response[] {
  const one: Response[] = s.answers.map((a) => ({ id: a.scenarioId, stage: 1, prompt: SCENARIOS.find((q) => q.id === a.scenarioId)?.prompt ?? '', text: a.text, skipped: a.skipped }));
  const two: Response[] = SCENES.filter((x) => s.scenes[x.id]?.done).map((x) => ({ id: x.id, stage: 2, prompt: x.line, text: s.scenes[x.id].text, skipped: s.scenes[x.id].skipped, rubric: x.rubric }));
  return [...one, ...two];
}
