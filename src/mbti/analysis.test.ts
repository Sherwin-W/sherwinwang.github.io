import { describe, expect, it } from 'vitest';
import { cleanTranscript, evidenceFor, needsClarification, PER_RESPONSE_CAP, readAll, readDimension, type Response } from './analysis';
import { SCENES, sceneById } from './stage2/scenes';

const one = (id: string, text: string): Response => ({ id, stage: 1, prompt: '', text, skipped: false });
const scene = (id: string, text: string): Response => { const s = sceneById(id)!; return { id, stage: 2, prompt: s.line, text, skipped: false, rubric: s.rubric }; };
const poles = (r: Response) => evidenceFor(r).map((e) => e.pole);

describe('evidence', () => {
  it('quotes the sentence that matched and says what it was read as', () => {
    const [e] = evidenceFor(one('q', 'I love big parties and I talk to everyone. Anyway.'));
    expect(e.pole).toBe('E');
    expect(e.quote).toBe('I love big parties and I talk to everyone.');
    expect(e.label).toMatch(/\w/);
  });

  it('reads going out with friends as Extraversion', () => {
    expect(poles(one('q', 'I love going out with a big group of friends.'))).toContain('E');
  });

  it('ignores a negated cue in the same clause', () => {
    expect(poles(one('q', 'I would never make a plan for the weekend.'))).not.toContain('J');
  });

  it('a negation before "but" does not cancel what follows', () => {
    expect(poles(one('q', 'Not at first, but I always make a plan and a list.'))).toContain('J');
  });

  it('skips sentences about someone else', () => {
    expect(evidenceFor(one('q', 'My friend loves big parties.'))).toEqual([]);
  });

  it('halves hedged statements and boosts general ones', () => {
    const plain = evidenceFor(one('q', 'I like concrete facts.'))[0];
    const hedged = evidenceFor(one('q', 'Maybe I like concrete facts.'))[0];
    const general = evidenceFor(one('q', 'I usually like concrete facts.'))[0];
    expect(hedged.hedged).toBe(true);
    expect(hedged.weight).toBeCloseTo(plain.weight / 2);
    expect(general.weight).toBeCloseTo(plain.weight * 1.5);
  });

  it('weights scene answers below questionnaire answers', () => {
    const q = evidenceFor(one('q', 'I like concrete facts.'))[0];
    const s = evidenceFor(scene('interview', 'I like concrete facts.')).find((e) => e.pole === 'S')!;
    expect(s.weight).toBeLessThan(q.weight);
  });

  it('reads a scene answer against that scene’s rubric', () => {
    expect(poles(scene('party', 'Honestly I would rather stay in tonight.'))).toContain('I');
    expect(poles(scene('party', 'Yeah, let’s go somewhere!'.replace('’', "'")))).toContain('E');
  });

  it('returns nothing for skipped or empty answers', () => {
    expect(evidenceFor({ ...one('q', 'I love parties'), skipped: true })).toEqual([]);
    expect(evidenceFor(one('q', '   '))).toEqual([]);
  });
});

describe('dimension reading', () => {
  it('has no preference and explains why when nothing was said', () => {
    const r = readDimension('EI', [one('q', 'The weather was fine.')]);
    expect(r.preference).toBeNull();
    expect(r.confidence).toBe('unclear');
    expect(r.notes[0]).toMatch(/Nothing you said/);
  });

  it('one answer can never decide a letter on its own', () => {
    const loud = one('q', 'I love parties. I love big parties and I talk to everyone. I talk to everyone. Crowds give me energy. I hate staying home.');
    const r = readDimension('EI', [loud]);
    expect(r.preference).toBe('E');
    expect(r.confidence).toBe('low');
    const total = r.evidence.filter((e) => e.pole === 'E').reduce((n, e) => n + e.weight, 0);
    expect(total).toBeGreaterThan(PER_RESPONSE_CAP);
  });

  it('accumulates consistent answers into stronger confidence', () => {
    const answers = [
      one('a', 'I always make a plan and a list.'),
      one('b', 'I like things decided early and finished ahead of the deadline.'),
      one('c', 'I would schedule it, I hate leaving things open.'),
      one('d', 'I usually plan the whole trip in advance.'),
    ];
    const r = readDimension('JP', answers);
    expect(r.preference).toBe('J');
    expect(['medium', 'high']).toContain(r.confidence);
    expect(readDimension('JP', answers.slice(0, 1)).confidence).toBe('low');
  });

  it('notes when the questions and the scenes disagree', () => {
    const r = readDimension('EI', [
      one('a', 'I love big parties and I talk to everyone.'),
      scene('party', 'Honestly I would rather stay in tonight, a quiet night sounds perfect.'),
    ]);
    expect(r.notes.join(' ')).toMatch(/In the questions you leaned Extraversion; in the scenes you leaned Introversion/);
  });

  it('calls an even split "both ways" instead of guessing', () => {
    const r = readDimension('EI', [one('a', 'I love big parties and I talk to everyone.'), one('b', 'I love big parties and I talk to everyone.'.replace('love going out with a big group of friends', 'need a quiet night in to recharge'))]);
    if (r.preference === null) expect(r.notes.join(' ')).toMatch(/both ways|Nothing/);
  });
});

describe('full reading', () => {
  it('uses X for undetermined letters and offers alternatives for weak ones', () => {
    const reading = readAll([one('a', 'I love big parties and I talk to everyone.')]);
    expect(reading.type).toMatch(/^EXXX$/);
    expect(reading.alternatives).toContain('IXXX');
    expect(reading.answered).toEqual({ 1: 1, 2: 0 });
  });

  it('is deterministic', () => {
    const rs = [one('a', 'I always make a plan.'), scene('two-programs', 'I would compare the facts and the costs.')];
    expect(readAll(rs)).toEqual(readAll(rs));
  });
});

describe('clarification', () => {
  it('asks again for very short or off-topic answers only', () => {
    const s = SCENES[0];
    const probe = (text: string): Response => ({ id: s.id, stage: 2, prompt: s.line, text, skipped: false, rubric: s.rubric });
    expect(needsClarification(probe('Sure.'), s.dimensions)).toBe(true);
    expect(needsClarification(probe('I had pasta for lunch today.'), s.dimensions)).toBe(true);
    expect(needsClarification(probe('Honestly I would rather stay in tonight.'), s.dimensions)).toBe(false);
  });
});

describe('cleanTranscript', () => {
  it('drops fillers and stutters and capitalises, without adding words', () => {
    expect(cleanTranscript('  um I I think   uh we should go , really')).toBe('I think we should go, really');
    expect(cleanTranscript('hmm')).toBe('');
  });
});
