import type { LeagueConfig } from '../data/league';
import { parseRank, type Rank } from './rank';

/** Where the number on screen came from. Every state is shown to the visitor as such. */
export type RankSource = 'loading' | 'live' | 'cached' | 'manual' | 'unranked' | 'unavailable';

/** The champion from the account's latest match, as the API reported it. */
export interface Champion {
  name: string;
  icon: string;
  playedAt: string | null;
}

export interface RankView {
  source: RankSource;
  rank: Rank | null;
  /** When Riot was last asked (live/cached/unranked), or the day the rank was checked by hand (manual). */
  asOf: string | null;
  /** Only ever from the API; never shown for a hand-entered rank. */
  champion?: Champion | null;
}

export const LOADING: RankView = { source: 'loading', rank: null, asOf: null };

/** The rank typed into the config, or "unavailable" when there is none. Never a guess. */
export function manualView(config: Pick<LeagueConfig, 'manual'>): RankView {
  const m = config.manual;
  const rank = m && parseRank(m.tier, m.division, m.lp);
  return rank ? { source: 'manual', rank, asOf: m.checkedOn } : { source: 'unavailable', rank: null, asOf: null };
}

const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Accepts only a named champion whose portrait is on Riot's Data Dragon CDN. */
export function parseChampion(raw: unknown): Champion | null {
  const c = raw as Record<string, unknown> | null;
  if (!c || typeof c !== 'object' || typeof c.name !== 'string' || !c.name.trim() || typeof c.icon !== 'string') return null;
  if (!/^https:\/\/ddragon\.leagueoflegends\.com\/cdn\/[\w.]+\/img\/champion\/\w+\.png$/.test(c.icon)) return null;
  return { name: c.name.trim(), icon: c.icon, playedAt: isDate(c.playedAt) ? c.playedAt : null };
}

/** Validates the API's JSON. A ranked answer without a valid tier is treated as no answer. */
export function parseRankResponse(raw: unknown): RankView | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return null;
  const asOf = isDate(r.fetchedAt) ? r.fetchedAt : null;
  const champion = parseChampion(r.lastChampion);
  if (r.ranked === false) return { source: 'unranked', rank: null, asOf, champion };
  if (r.ranked !== true) return null;
  const rank = parseRank(r.tier, r.division, r.lp);
  if (!rank) return null;
  return { source: r.stale === true ? 'cached' : 'live', rank, asOf, champion };
}

export async function fetchRank(baseUrl: string, signal?: AbortSignal): Promise<RankView | null> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/league/rank`, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return parseRankResponse(await res.json());
  } catch {
    return null;
  }
}

/** The API's answer, or the manual rank when the API has none to give. */
export async function resolveRank(config: LeagueConfig, baseUrl: string | undefined, signal?: AbortSignal): Promise<RankView> {
  if (config.mode === 'manual' || !baseUrl) return manualView(config);
  return (await fetchRank(baseUrl, signal)) ?? manualView(config);
}
