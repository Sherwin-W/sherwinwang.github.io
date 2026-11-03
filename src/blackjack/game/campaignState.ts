/**
 * The campaign's single source of truth for the selected difficulty and the active run.
 * A run snapshots its difficulty when it starts; the HUD reads only that snapshot, so a run can
 * never mix one mode's rules with another mode's panels. Every start gets a new id, and the run
 * screen is keyed by it, so all run state (coins, flow, hints, golden cards, shoe) starts fresh.
 */
import type { Difficulty, Grade } from './run';

export interface RunRecord { id: number; seed: number; difficulty: Difficulty; best: Grade | null }
export interface CampaignState { selected: Difficulty; run: RunRecord | null; nextId: number }

export type CampaignAction =
  | { type: 'select'; difficulty: Difficulty }
  | { type: 'start'; seed: number; best: Grade | null }
  /** Change mode during (or outside) a run: always a fresh run in the new mode. */
  | { type: 'switch'; difficulty: Difficulty; seed: number; best: Grade | null }
  | { type: 'abandon' };

export const DIFFICULTY_KEY = 'blackjack-difficulty-v1';

export function campaignReducer(s: CampaignState, a: CampaignAction): CampaignState {
  switch (a.type) {
    case 'select':
      return s.run ? s : { ...s, selected: a.difficulty };
    case 'start':
      return { ...s, run: { id: s.nextId, seed: a.seed, difficulty: s.selected, best: a.best }, nextId: s.nextId + 1 };
    case 'switch':
      return { selected: a.difficulty, run: { id: s.nextId, seed: a.seed, difficulty: a.difficulty, best: a.best }, nextId: s.nextId + 1 };
    case 'abandon':
      return { ...s, run: null };
  }
}

export function initialCampaign(): CampaignState {
  let selected: Difficulty = 'recruit';
  try {
    const saved = localStorage.getItem(DIFFICULTY_KEY);
    if (saved === 'recruit' || saved === 'operator' || saved === 'grandmaster') selected = saved;
  } catch { /* storage unavailable */ }
  return { selected, run: null, nextId: 1 };
}
