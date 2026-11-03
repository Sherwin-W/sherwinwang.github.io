import { describe, expect, it } from 'vitest';
import {
  applyFlow, ASSIST_THRESHOLDS, assistAvailable, checkpointDue, DIFFICULTIES, dropsCoin, drillsFor, emptyStats, expectedConversion,
  expectedWager, gradeOf, isCounting, removedBetween, runScore, systemFor, tierOf, trueCountFor, upcomingRemoval, type RunStats,
  dealerIsPaid, hintPrice, revealHint, settleGolden, DEALER_PAID_FROM, type HintLedger,
} from './run';

describe('difficulties', () => {
  it('Recruit is strategy only, Operator uses Hi-Lo, Grandmaster uses Wong Halves', () => {
    expect(systemFor('recruit')).toBeNull();
    expect(systemFor('operator')?.id).toBe('hilo');
    expect(systemFor('grandmaster')?.id).toBe('wong');
    expect(isCounting('recruit')).toBe(false);
    expect(Object.keys(DIFFICULTIES)).toEqual(['recruit', 'operator', 'grandmaster']);
  });
});

describe('assistance removal', () => {
  it('takes the counter and the calculator offline together at 100, ace tracking at 150', () => {
    expect(ASSIST_THRESHOLDS).toEqual({ counter: 100, calculator: 100, aces: 150 });
    expect(assistAvailable('operator', 99)).toEqual({ counter: true, calculator: true, aces: true });
    expect(assistAvailable('operator', 100)).toEqual({ counter: false, calculator: false, aces: true });
    expect(assistAvailable('grandmaster', 149)).toEqual({ counter: false, calculator: false, aces: true });
    expect(assistAvailable('grandmaster', 150)).toEqual({ counter: false, calculator: false, aces: false });
  });
  it('Recruit never has counting tools', () => {
    expect(assistAvailable('recruit', 0)).toEqual({ counter: false, calculator: false, aces: false });
    expect(upcomingRemoval('recruit', 90)).toBeNull();
  });
  it('warns within 20 cards of the next removal, naming every tool that goes', () => {
    expect(upcomingRemoval('operator', 79)).toBeNull();
    expect(upcomingRemoval('operator', 80)).toEqual({ tools: ['counter', 'calculator'], at: 100, inCards: 20 });
    expect(upcomingRemoval('operator', 135)).toEqual({ tools: ['aces'], at: 150, inCards: 15 });
    expect(upcomingRemoval('operator', 120)).toBeNull();
    expect(upcomingRemoval('operator', 260)).toBeNull();
  });
  it('reports every tool crossed by one batch of cards', () => {
    expect(removedBetween('operator', 96, 103)).toEqual(['counter', 'calculator']);
    expect(removedBetween('operator', 97, 152)).toEqual(['counter', 'calculator', 'aces']);
    expect(removedBetween('operator', 101, 120)).toEqual([]);
  });
});

describe('Ask the Dealer economy', () => {
  const ledger = (bank: number, paid = 0, revealed: string[] = []): HintLedger => ({ bank, paid, revealed: new Set(revealed) });
  it('is free before 150 exposed cards in counting modes, and always free in Recruit', () => {
    expect(DEALER_PAID_FROM).toBe(150);
    expect(dealerIsPaid('operator', 149)).toBe(false);
    expect(dealerIsPaid('operator', 150)).toBe(true);
    expect(dealerIsPaid('grandmaster', 200)).toBe(true);
    expect(dealerIsPaid('recruit', 300)).toBe(false);
    const r = revealHint(ledger(0), 'a', false);
    expect(r).toMatchObject({ result: 'free', cost: 0 });
    expect(r.ledger.bank).toBe(0);
  });
  it('then costs 1, 2, 3, 4 coins for successive new hints', () => {
    expect([0, 1, 2, 3].map(hintPrice)).toEqual([1, 2, 3, 4]);
    let l = ledger(20);
    const costs: number[] = [];
    for (const key of ['a', 'b', 'c', 'd']) { const r = revealHint(l, key, true); costs.push(r.cost); l = r.ledger; }
    expect(costs).toEqual([1, 2, 3, 4]);
    expect(l.bank).toBe(10);
    expect(l.paid).toBe(4);
  });
  it('refuses a purchase without enough coins and changes nothing', () => {
    const l = ledger(2, 2);
    const r = revealHint(l, 'x', true);
    expect(r.result).toBe('insufficient');
    expect(r.ledger).toBe(l);
  });
  it('never charges twice for the same decision', () => {
    const first = revealHint(ledger(5), 'k', true);
    const again = revealHint(first.ledger, 'k', true);
    expect(again).toMatchObject({ result: 'already', cost: 0 });
    expect(again.ledger.bank).toBe(4);
  });
});

describe('golden cards', () => {
  it('pays once per golden card on a correct, unassisted decision', () => {
    const settled = new Set<number>();
    const r = settleGolden([{ gold: 7 }, {}, { gold: 9 }], settled, true, false);
    expect(r).toEqual({ settle: [7, 9], pay: [7, 9] });
  });
  it('a wrong or advised decision settles the card without paying', () => {
    expect(settleGolden([{ gold: 3 }], new Set(), false, false)).toEqual({ settle: [3], pay: [] });
    expect(settleGolden([{ gold: 3 }], new Set(), true, true)).toEqual({ settle: [3], pay: [] });
  });
  it('a settled card never pays again (the same card in later decisions)', () => {
    expect(settleGolden([{ gold: 3 }, { gold: 3 }], new Set([3]), true, false)).toEqual({ settle: [], pay: [] });
    expect(settleGolden([{ gold: 4 }, { gold: 4 }], new Set(), true, false).pay).toEqual([4]);
  });
});

describe('checkpoints and grading', () => {
  it('a checkpoint comes due every half deck of exposed cards in counting modes', () => {
    expect(checkpointDue('operator', 25, 0)).toBe(false);
    expect(checkpointDue('operator', 26, 0)).toBe(true);
    expect(checkpointDue('operator', 60, 40)).toBe(false);
    expect(checkpointDue('recruit', 300, 0)).toBe(false);
  });
  it('true count: running ÷ decks (half-deck estimate), truncated toward zero, with halves kept exact', () => {
    expect(trueCountFor(16, 208)).toBe(2); // +8 over 4 decks
    expect(trueCountFor(14, 208)).toBe(1); // +7 / 4 = 1.75
    expect(trueCountFor(-14, 208)).toBe(-1);
    expect(trueCountFor(9, 78)).toBe(3); // Wong +4.5 over 1.5 decks
    expect(trueCountFor(5, 26)).toBe(5); // +2.5 over half a deck
  });
  it('conversion is graded from the player’s own running count', () => {
    expect(expectedConversion(12, 104)).toBe(3); // the player said +6 with 2 decks left
  });
  it('wagers follow the illustrative schedule at the objective true count', () => {
    expect(expectedWager(0, 312)).toBe(1);
    expect(expectedWager(2 * 2 * 4, 208)).toBe(2); // +8 / 4 = +2
    expect(expectedWager(2 * 9, 156)).toBe(4); // +9 / 3 = +3
    expect(expectedWager(2 * 10, 104)).toBe(6); // +10 / 2 = +5
    expect(expectedWager(-40, 104)).toBe(1);
  });
});

describe('flow meter', () => {
  it('rises on correct execution, falls on mistakes and stays within 0-100', () => {
    expect(applyFlow(0, 'decision', true).value).toBe(6);
    expect(applyFlow(10, 'decision', false).value).toBe(0);
    expect(applyFlow(98, 'count', true).value).toBe(100);
    expect(applyFlow(50, 'wager', false).value).toBe(42);
  });
  it('reports tier crossings at 25, 50 and 75', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(tierOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(applyFlow(20, 'decision', true)).toEqual({ value: 26, from: 0, to: 1 });
    expect(applyFlow(46, 'count', true)).toMatchObject({ from: 1, to: 2 });
    expect(applyFlow(70, 'decision', true)).toMatchObject({ from: 2, to: 3 });
    expect(applyFlow(76, 'decision', false)).toMatchObject({ from: 3, to: 2 });
  });
  it('coins drop only on correct decisions at 75 or more', () => {
    expect(dropsCoin(75, true)).toBe(true);
    expect(dropsCoin(74, true)).toBe(false);
    expect(dropsCoin(90, false)).toBe(false);
  });
});

describe('report', () => {
  const stats = (o: Partial<RunStats>): RunStats => ({ ...emptyStats(), ...o });
  it('scores only the skills that were attempted', () => {
    expect(runScore(stats({ decisions: { hard: { right: 9, total: 10 }, soft: { right: 0, total: 0 }, pair: { right: 0, total: 0 } } }))).toBe(90);
    const s = stats({ decisions: { hard: { right: 10, total: 10 }, soft: { right: 0, total: 0 }, pair: { right: 0, total: 0 } }, counts: { right: 0, total: 4 } });
    expect(runScore(s)).toBeCloseTo((1 * 0.5) / 0.75 * 100, 0);
  });
  it('never counts virtual units', () => {
    const a = stats({ decisions: { hard: { right: 5, total: 5 }, soft: { right: 0, total: 0 }, pair: { right: 0, total: 0 } }, net: -40 });
    expect(runScore(a)).toBe(100);
  });
  it('grades S ≥ 97, A ≥ 92, B ≥ 85, C ≥ 75, else D', () => {
    expect([100, 97, 96.9, 92, 85, 75, 74.9].map(gradeOf)).toEqual(['S', 'S', 'A', 'A', 'B', 'C', 'D']);
  });
  it('suggests drills for weak areas', () => {
    const s = stats({ decisions: { hard: { right: 1, total: 6 }, soft: { right: 0, total: 0 }, pair: { right: 0, total: 0 } }, counts: { right: 0, total: 3 } });
    expect(drillsFor(s).join(' ')).toMatch(/hard hands.*Counting drills/);
  });
});
