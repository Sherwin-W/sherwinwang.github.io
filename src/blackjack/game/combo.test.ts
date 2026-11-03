import { describe, expect, it } from 'vitest';
import { applyFlow, COMBO_OVERDRIVE, COMBO_UNLOCK, emptyCombo, fireStage, isPlayDecision, milestoneFor, stepCombo, type Combo, type FlowKind } from './run';

/** Replays graded events through flow and combo exactly as the run does. */
function play(events: [FlowKind, boolean][], start = 0) {
  let flow = start;
  let combo: Combo = emptyCombo();
  const trace: { flow: number; combo: Combo }[] = [];
  for (const [kind, ok] of events) {
    flow = applyFlow(flow, kind, ok).value;
    combo = stepCombo(combo, ok, flow, isPlayDecision(kind));
    trace.push({ flow, combo });
  }
  return { flow, combo, trace };
}
const rights = (n: number): [FlowKind, boolean][] => Array.from({ length: n }, () => ['decision', true]);

describe('combo multiplier', () => {
  it('is inactive below 50% flow, whatever the streak', () => {
    const { trace } = play(rights(8)); // 6, 12 … 48
    expect(trace.at(-1)!.flow).toBe(48);
    trace.forEach((t) => expect(t.combo).toMatchObject({ active: false, count: 0 }));
  });

  it('unlocks at 50%: the decision that gets there is 1×, earlier ones never count', () => {
    const { combo, flow } = play(rights(9)); // 54
    expect(flow).toBe(54);
    expect(combo).toMatchObject({ active: true, count: 1 });
    expect(COMBO_UNLOCK).toBe(50);
  });

  it('each consecutive correct decision adds 1 with no maximum', () => {
    const { trace } = play(rights(30));
    expect(trace.slice(8).map((t) => t.combo.count)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    expect(trace.at(-1)!.combo.count).toBe(22);
  });

  it('a wrong decision resets it to 0 but keeps it unlocked while flow stays ≥ 50%', () => {
    const { combo, flow } = play([...rights(14), ['decision', false]]); // 84 → 70
    expect(flow).toBe(70);
    expect(combo).toMatchObject({ active: true, count: 0, best: 6 });
    expect(stepCombo(combo, true, 76).count).toBe(1);
  });

  it('falling below 50% resets and deactivates it; climbing back starts a new combo', () => {
    let r = play([...rights(10), ['decision', false]]); // 60 → 46
    expect(r.combo).toMatchObject({ active: false, count: 0 });
    r = play([...rights(10), ['decision', false], ['decision', true]]); // 46 → 52
    expect(r.combo).toMatchObject({ active: true, count: 1 });
  });

  it('count checks and wagers move flow but neither build nor break the streak', () => {
    const base = play(rights(12)).combo; // 72, 4×
    expect(base.count).toBe(4);
    expect(stepCombo(base, false, 56, false)).toEqual(base); // a count miss at 72 → 56
    expect(stepCombo(base, true, 82, false)).toEqual(base);
    expect(stepCombo(base, false, 48, false)).toMatchObject({ active: false, count: 0 }); // …unless it drops flow below 50
    // so 85% flow with a 12× combo is possible
    let c = play(rights(30)).combo;
    c = stepCombo(c, false, 84, false);
    expect(c.count).toBe(22);
  });

  it('an advised play leaves the streak unchanged (no duplicate or free increments)', () => {
    const c = play(rights(12)).combo;
    expect(stepCombo(c, true, 72, true, false)).toEqual(c);
  });

  it('is pure: replaying the same event sequence gives the same combo', () => {
    const seq: [FlowKind, boolean][] = [...rights(11), ['wager', false], ...rights(3), ['decision', false], ...rights(2)];
    expect(play(seq).combo).toEqual(play(seq).combo);
  });

  it('a new run starts from an empty combo', () => {
    expect(emptyCombo()).toEqual({ active: false, count: 0, best: 0 });
  });
});

describe('fire and overdrive', () => {
  it('grows through 1×–5×, stays full to 9×, overdrive from 10×', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9, 10, 25].map(fireStage)).toEqual([0, 1, 2, 3, 4, 5, 5, 5, 6, 6]);
    expect(COMBO_OVERDRIVE).toBe(10);
  });
});

describe('border milestones', () => {
  it('the power-up plays only when crossing 50% upward', () => {
    expect(milestoneFor(48, 54, false)).toBe('power');
    expect(milestoneFor(54, 60, false)).toBeNull();
    expect(milestoneFor(60, 46, false)).toBeNull();
    expect(milestoneFor(46, 52, false)).toBe('power'); // crossing again later replays it
  });
  it('the rainbow sequence plays the first time 100% is reached in a run only', () => {
    expect(milestoneFor(96, 100, false)).toBe('rainbow');
    expect(milestoneFor(100, 100, true)).toBeNull();
    expect(milestoneFor(94, 100, true)).toBeNull();
  });
});

describe('HUD digits', () => {
  it('every digit 0–9 and × is a distinct 5×7 bitmap, so widths never jump', async () => {
    const { DIGITS, digitsPath } = await import('./pixelArt');
    const keys = [...'0123456789×'];
    keys.forEach((k) => { expect(DIGITS[k]).toHaveLength(7); DIGITS[k].forEach((r) => expect(r).toHaveLength(5)); });
    expect(new Set(keys.map((k) => DIGITS[k].join('/'))).size).toBe(keys.length);
    expect(DIGITS['4'].join('/')).toBe('#...#/#...#/#...#/#####/....#/....#/....#'); // the open 4
    expect(digitsPath('4×').w).toBe(11);
    expect(digitsPath('100×').w).toBe(23);
  });
});
