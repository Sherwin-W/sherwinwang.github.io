import { describe, expect, it } from 'vitest';
import { MAX_QUESTIONS } from './engine';
import { canFinishStage1, canSeeResults, initialState, reducer, responses, scenesDone, type Action, type State } from './session';
import { MIN_SCENES, SCENES } from './stage2/scenes';

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s);
const RICH = 'I always make a plan and I love big parties and I talk to everyone, I care about how everyone feels and like concrete facts.';

function throughStage1(): State {
  let s = run(initialState, { type: 'start', input: 'text' });
  for (let i = 0; i < 20 && s.phase === 'stage1'; i++) s = reducer(s, { type: 'answer', text: RICH });
  return s;
}

describe('session', () => {
  it('starts Stage 1 on the first question with the chosen input', () => {
    const s = run(initialState, { type: 'start', input: 'voice' });
    expect(s.phase).toBe('stage1');
    expect(s.input).toBe('voice');
    expect(s.question).toBeTruthy();
  });

  it('asks one follow-up for a thin answer, keeping the first answer', () => {
    let s = run(initialState, { type: 'start', input: 'text' });
    const q = s.question;
    s = reducer(s, { type: 'answer', text: 'Hm.' });
    expect(s.followedUp).toBe(true);
    expect(s.question).toBe(q);
    s = reducer(s, { type: 'answer', text: 'Still not sure.' });
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0].text).toBe('Hm. Still not sure.');
    expect(s.question).not.toBe(q);
  });

  it('records skips and moves on', () => {
    const s = run(initialState, { type: 'start', input: 'text' }, { type: 'skip' });
    expect(s.answers[0].skipped).toBe(true);
  });

  it('ends Stage 1 after enough questions and moves to the transition', () => {
    const s = throughStage1();
    expect(s.phase).toBe('transition');
    expect(s.answers.length).toBeLessThanOrEqual(MAX_QUESTIONS);
  });

  it('lets the person finish Stage 1 early only after a few answers', () => {
    let s = run(initialState, { type: 'start', input: 'text' });
    expect(canFinishStage1(s)).toBe(false);
    s = run(s, { type: 'answer', text: RICH }, { type: 'answer', text: RICH }, { type: 'answer', text: RICH });
    expect(canFinishStage1(s)).toBe(true);
    expect(reducer(s, { type: 'finishStage1' }).phase).toBe('transition');
  });

  it('plays scenes: a clarifying line for a thin answer, then done', () => {
    let s = run(throughStage1(), { type: 'toScenes' }, { type: 'openScene', id: 'party' });
    expect(s.phase).toBe('scene');
    s = reducer(s, { type: 'sceneAnswer', text: 'Sure.' });
    expect(s.scenes['party']).toMatchObject({ followedUp: true, done: false });
    s = reducer(s, { type: 'sceneAnswer', text: 'Honestly I would rather stay in tonight.' });
    expect(s.scenes['party']).toMatchObject({ done: true, skipped: false, text: 'Sure. Honestly I would rather stay in tonight.' });
    expect(reducer(s, { type: 'sceneAnswer', text: 'more' })).toBe(s);
    s = reducer(s, { type: 'closeScene' });
    expect(s.phase).toBe('scenes');
    expect(scenesDone(s)).toBe(1);
  });

  it('ignores unknown scenes and actions from the wrong phase', () => {
    const s = run(throughStage1(), { type: 'toScenes' });
    expect(reducer(s, { type: 'openScene', id: 'nope' })).toBe(s);
    expect(reducer(s, { type: 'answer', text: 'x' })).toBe(s);
    expect(reducer(initialState, { type: 'toScenes' })).toBe(initialState);
  });

  it('unlocks results after the minimum number of answered scenes, not skipped ones', () => {
    let s = run(throughStage1(), { type: 'toScenes' });
    for (const sc of SCENES.slice(0, MIN_SCENES - 1)) s = run(s, { type: 'openScene', id: sc.id }, { type: 'sceneAnswer', text: RICH }, { type: 'closeScene' });
    expect(canSeeResults(s)).toBe(false);
    s = run(s, { type: 'openScene', id: SCENES[MIN_SCENES - 1].id }, { type: 'skipScene' }, { type: 'closeScene' });
    expect(canSeeResults(s)).toBe(false);
    s = run(s, { type: 'openScene', id: SCENES[MIN_SCENES].id }, { type: 'sceneAnswer', text: RICH }, { type: 'closeScene' });
    expect(canSeeResults(s)).toBe(true);
    s = reducer(s, { type: 'results' });
    expect(s.phase).toBe('results');
    const rs = responses(s);
    expect(rs.filter((r) => r.stage === 2)).toHaveLength(MIN_SCENES + 1);
    expect(rs.find((r) => r.id === SCENES[MIN_SCENES - 1].id)?.skipped).toBe(true);
  });

  it('reset deletes everything', () => {
    const s = run(throughStage1(), { type: 'toScenes' }, { type: 'reset' });
    expect(s).toEqual(initialState);
  });
});
