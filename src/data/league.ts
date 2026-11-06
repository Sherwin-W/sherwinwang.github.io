// Road to Diamond settings. Change the account, goal or data source here; the widget reads only this file.
// The API project has its own copy of the account (LEAGUE_RIOT_ID / LEAGUE_PLATFORM env vars, see
// docs/mini-apps/LEAGUE.md), because the visitor's browser never chooses which account is looked up.

import type { Division, Tier } from '../league/rank';

export interface LeagueConfig {
  riotId: string;
  /** Riot platform routing value for the account's server (NA1 = North America). */
  platform: string;
  queue: 'RANKED_SOLO_5x5';
  goal: { tier: Tier; division?: Division };
  /** How often the API asks Riot again; the page itself never polls faster than this. */
  refreshMinutes: number;
  opggUrl: string;
  /**
   * 'live': ask the API (which caches Riot's answer), and fall back to `manual` if that fails.
   * 'manual': show `manual` only, labelled as manually updated.
   */
  mode: 'live' | 'manual';
  /** A rank typed in by hand, with the date it was checked. null shows "rank unavailable" instead. */
  manual: { tier: Tier; division?: Division; lp: number; checkedOn: string } | null;
}

const league: LeagueConfig = {
  riotId: 'DippoBippo#cccc',
  platform: 'NA1',
  queue: 'RANKED_SOLO_5x5',
  goal: { tier: 'DIAMOND', division: 'IV' },
  refreshMinutes: 45,
  opggUrl: 'https://op.gg/lol/summoners/na/DippoBippo-cccc',
  mode: 'live',
  // Read from the account's OP.GG profile on 2026-11-05. Update it by hand until the Riot key is set up.
  manual: { tier: 'GOLD', division: 'II', lp: 27, checkedOn: '2026-11-05' },
};

export default league;
