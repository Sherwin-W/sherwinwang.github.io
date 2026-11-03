import { describe, expect, it } from 'vitest';
import { availableActions, countSequence, explain, strategyQuestion, trayQuestion, trueCountQuestion } from './drills';
import { mulberry32 } from './rng';
import { DEFAULT_RULES, normalizeRules } from './rules';
import { evaluate } from './hand';
import { emptyProgress, recordBet, recordStrategy, suggestions, pct } from './stats';
import { hiLoValue } from './cards';

const rules = normalizeRules(DEFAULT_RULES);

describe('strategy questions', () => {
  it('match the requested category and have an available correct answer', () => {
    const rng = mulberry32(3);
    for (const cat of ['hard', 'soft', 'pair'] as const) {
      for (let i = 0; i < 300; i++) {
        const q = strategyQuestion(rng, rules, [cat]);
        expect(q.category).toBe(cat);
        const v = evaluate(q.player);
        if (cat === 'soft') expect(v.soft).toBe(true);
        if (cat === 'hard') expect(v.soft || q.player[0].rank === q.player[1].rank).toBe(false);
        if (cat === 'pair') expect(q.player[0].rank).toBe(q.player[1].rank);
        expect(availableActions(q)).toContain(q.decision.action);
        expect(explain(q).length).toBeGreaterThan(30);
      }
    }
  });
  it('are reproducible from a seed', () => {
    expect(strategyQuestion(mulberry32(9), rules)).toEqual(strategyQuestion(mulberry32(9), rules));
  });
  it('flags rule-dependent spots', () => {
    const rng = mulberry32(5);
    const flagged = Array.from({ length: 400 }, () => strategyQuestion(rng, rules)).filter((q) => q.dependsOn.length > 0);
    expect(flagged.length).toBeGreaterThan(0);
  });
});

describe('count and true count drills', () => {
  it('builds sequences whose categories match Hi-Lo', () => {
    for (const { card, category } of countSequence(mulberry32(1), 100)) {
      expect({ low: 1, neutral: 0, high: -1 }[category]).toBe(hiLoValue(card.rank));
    }
  });
  it('true count answers use the truncation convention', () => {
    const rng = mulberry32(2);
    for (let i = 0; i < 200; i++) {
      const q = trueCountQuestion(rng);
      expect(q.answer).toBe(Math.trunc(q.running / q.decks) || 0);
    }
  });
  it('tray question answers in half-deck steps', () => {
    const q = trayQuestion(mulberry32(4), 6);
    expect((q.answer * 2) % 1).toBe(0);
  });
});

describe('progress', () => {
  it('tracks accuracy and suggests weak areas', () => {
    let p = emptyProgress();
    for (let i = 0; i < 6; i++) p = recordStrategy(p, 'soft', 'soft 18 vs 9', i < 2);
    expect(pct(p.strategy.soft)).toBe('33%');
    expect(pct(p.strategy.hard)).toBe('n/a');
    p = recordBet(p, true);
    expect(suggestions(p).join(' ')).toMatch(/soft hands/);
    expect(suggestions(p).join(' ')).toMatch(/soft 18 vs 9/);
  });
});
