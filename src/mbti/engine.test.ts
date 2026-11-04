import { describe, expect, it } from 'vitest';
import { enoughEvidence, isFinished, MAX_QUESTIONS, needsFollowUp, nextScenario } from './engine';
import { buildProfile, extractEvidence, scoreDimension } from './scoring';
import { SCENARIOS } from './scenarios';
import type { Answer } from './types';

const ans = (scenarioId: string, text: string, skipped = false): Answer => ({ scenarioId, text, skipped });

describe('extractEvidence', () => {
  it('quotes the persons own sentence and names the cue', () => {
    const [e] = extractEvidence('I need to recharge alone. Then I am fine.', 'ei-saturday');
    expect(e).toMatchObject({ pole: 'I', quote: 'I need to recharge alone.', scenarioId: 'ei-saturday' });
  });
  it('ignores a cue directly after a negation', () => {
    expect(extractEvidence('I do not plan anything ahead.', 'jp-trip').filter((e) => e.pole === 'J')).toEqual([]);
  });
  it('finds nothing in small talk without cues', () => {
    expect(extractEvidence('It was fine, I guess.', 'x')).toEqual([]);
  });
});

describe('scoreDimension', () => {
  it('is unclear with no evidence', () => {
    expect(scoreDimension('EI', [])).toMatchObject({ preference: null, confidence: 'unclear', lean: 0 });
  });
  it('leans toward the pole with more weighted evidence', () => {
    const r = scoreDimension('EI', [ans('ei-saturday', 'I would go and meet new people. I love big parties.')]);
    expect(r.preference).toBe('E');
    expect(r.lean).toBeGreaterThan(0);
  });
  it('stays low-confidence on one weak mention', () => {
    expect(scoreDimension('TF', [ans('tf-friend', 'I would think about the logic of it.')]).confidence).toBe('low');
  });
  it('is not confident when evidence conflicts', () => {
    const r = scoreDimension('JP', [ans('jp-trip', 'I make a detailed plan and schedule. I also like to wing it and stay flexible.')]);
    expect(r.confidence).not.toBe('high');
    expect(Math.abs(r.lean)).toBeLessThan(0.5);
  });
  it('reaches high confidence with strong, repeated evidence across scenarios', () => {
    const r = scoreDimension('JP', [
      ans('jp-trip', 'I make a detailed plan and a schedule well in advance.'),
      ans('jp-deadline', 'I set a deadline checklist and prepare early.'),
    ]);
    expect(r).toMatchObject({ preference: 'J', confidence: 'high' });
  });
  it('ignores skipped answers', () => {
    expect(scoreDimension('EI', [ans('ei-saturday', 'I love parties and meet people', true)]).confidence).toBe('unclear');
  });
  it('does not double count the same sentence for one pole', () => {
    const one = scoreDimension('SN', [ans('sn-idea', 'I imagine the possibilities and the big picture.')]);
    expect(one.evidence.filter((e) => e.pole === 'N')).toHaveLength(1);
  });
});

describe('buildProfile', () => {
  it('marks undetermined dimensions with X instead of guessing', () => {
    const p = buildProfile([ans('ei-saturday', 'I would stay home alone and recharge.')]);
    expect(p.type).toBe('IXXX');
    expect(p.dimensions.EI.evidence[0].quote).toContain('recharge');
    expect(p.limitations).toMatch(/not a validated/);
  });
  it('gives the same result for the same answers', () => {
    const a = [ans('tf-friend', 'I would listen and think about how they feel.')];
    expect(buildProfile(a)).toEqual(buildProfile(a));
  });
});

describe('question flow', () => {
  it('covers every dimension before repeating one', () => {
    const answers: Answer[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const s = nextScenario(answers)!;
      seen.push(s.dimension);
      answers.push(ans(s.id, 'ok'));
    }
    expect(new Set(seen).size).toBe(4);
  });
  it('asks next about the dimension with the least evidence', () => {
    const base = ['ei-saturday', 'sn-recipe', 'tf-friend', 'jp-trip'];
    const answers = [
      ans(base[0], 'I love parties and meet new people.'),
      ans(base[1], 'I follow the facts and the details, step by step.'),
      ans(base[2], 'ok'),
      ans(base[3], 'I plan and schedule ahead of time.'),
    ];
    expect(nextScenario(answers)!.dimension).toBe('TF');
  });
  it('never repeats a scenario and runs out', () => {
    const answers = SCENARIOS.map((s) => ans(s.id, 'ok'));
    expect(nextScenario(answers)).toBeNull();
  });
  it('requests a follow-up for short or signal-free answers only', () => {
    const s = SCENARIOS.find((x) => x.id === 'ei-saturday')!;
    expect(needsFollowUp(s, 'Maybe.')).toBe(true);
    expect(needsFollowUp(s, 'It depends on the day and who is going.')).toBe(true);
    expect(needsFollowUp(s, 'I would probably stay home and recharge alone.')).toBe(false);
  });
  it('stops at the question limit or when all dimensions are fairly clear', () => {
    expect(isFinished(SCENARIOS.slice(0, MAX_QUESTIONS).map((s) => ans(s.id, 'ok')))).toBe(true);
    expect(isFinished([ans('ei-saturday', 'ok')])).toBe(false);
    const clear = [
      ans('ei-saturday', 'I love meeting people and big parties. I think out loud with friends.'),
      ans('sn-idea', 'I imagine the possibilities. I care about the big picture and the future.'),
      ans('tf-friend', 'I focus on logic and analysis. I weigh the pros and cons.'),
      ans('jp-trip', 'I plan and schedule everything. I prepare a checklist well in advance.'),
    ];
    expect(enoughEvidence(clear)).toBe(false); // Stage 1 asks at least five questions
    clear.push(ans('ei-newgroup', 'I mingle and talk to everyone right away.'));
    expect(enoughEvidence(clear)).toBe(true);
    expect(isFinished(clear)).toBe(true);
  });
});

describe('Codex review fixes', () => {
  it('“I love crowded parties” is not read as introversion', () => {
    const poles = extractEvidence('I love crowded parties.', 'x').map((e) => e.pole);
    expect(poles).toContain('E');
    expect(poles).not.toContain('I');
  });
  it('statements about someone else are not evidence about the person', () => {
    expect(extractEvidence('My friend is outgoing.', 'x')).toEqual([]);
    expect(extractEvidence('She loves big parties.', 'x')).toEqual([]);
  });
  it('a negation does not cross “but” or a comma', () => {
    const ev = extractEvidence('I am not spontaneous, but I plan ahead.', 'x');
    expect(ev.map((e) => e.pole)).toEqual(['J']);
  });
  it('an unclear dimension keeps priority after every dimension is covered once', () => {
    const answers = [
      ans('ei-saturday', 'I love meeting people. I talk to everyone.'),
      ans('sn-idea', 'I care about the facts and the details.'),
      ans('tf-friend', 'It depends.'),
      ans('jp-trip', 'I plan everything and prepare a checklist.'),
    ];
    expect(nextScenario(answers)?.dimension).toBe('TF');
  });
});
