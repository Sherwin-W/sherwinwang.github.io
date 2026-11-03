// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { campaignReducer, DIFFICULTY_KEY, initialCampaign, type CampaignState } from './campaignState';
import type { Difficulty } from './run';

afterEach(() => { try { localStorage.clear(); } catch { /* node */ } });

const fresh = (): CampaignState => ({ selected: 'recruit', run: null, nextId: 1 });
const MODES: Difficulty[] = ['recruit', 'operator', 'grandmaster'];

describe('campaign state', () => {
  it('the first selection takes effect, and the run snapshots it', () => {
    let s = campaignReducer(fresh(), { type: 'select', difficulty: 'operator' });
    expect(s.selected).toBe('operator');
    s = campaignReducer(s, { type: 'start', seed: 5, best: null });
    expect(s.run).toEqual({ id: 1, seed: 5, difficulty: 'operator', best: null });
  });

  it('every transition between the three modes starts a fresh run in the new mode', () => {
    for (const from of MODES) for (const to of MODES) {
      if (from === to) continue;
      let s = campaignReducer({ ...fresh(), selected: from }, { type: 'start', seed: 1, best: null });
      const before = s.run!.id;
      s = campaignReducer(s, { type: 'switch', difficulty: to, seed: 2, best: null });
      expect(s.run!.difficulty).toBe(to);
      expect(s.selected).toBe(to);
      expect(s.run!.id).toBeGreaterThan(before); // new id → new run screen → all run state reset
    }
  });

  it('selecting on the briefing cannot change an active run', () => {
    const s = campaignReducer({ ...fresh(), selected: 'operator' }, { type: 'start', seed: 1, best: null });
    expect(campaignReducer(s, { type: 'select', difficulty: 'recruit' })).toBe(s);
  });

  it('run ids never repeat, even after abandoning', () => {
    let s = campaignReducer(fresh(), { type: 'start', seed: 1, best: null });
    s = campaignReducer(s, { type: 'abandon' });
    s = campaignReducer(s, { type: 'start', seed: 1, best: null });
    expect(s.run!.id).toBe(2);
  });

  it('the selected mode survives leaving the tab (persisted)', () => {
    localStorage.setItem(DIFFICULTY_KEY, 'grandmaster');
    expect(initialCampaign().selected).toBe('grandmaster');
    localStorage.setItem(DIFFICULTY_KEY, 'nonsense');
    expect(initialCampaign().selected).toBe('recruit');
  });
});
