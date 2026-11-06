import type { LeagueConfig } from '../data/league';
import { parseRank, type Rank } from './rank';

/** Where the number on screen came from. Every state is shown to the visitor as such. */
export type RankSource = 'loading' | 'live' | 'cached' | 'manual' | 'unranked' | 'unavailable';

export interface RankView {
  source: RankSource;
  rank: Rank | null;
  /** When Riot was last asked (live/cached/unranked), or the day the rank was checked by hand (manual). */
  asOf: string | null;
}

export const LOADING: RankView = { source: 'loading', rank: null, asOf: null };

/** The rank typed into the config, or "unavailable" when there is none. Never a guess. */
export function manualView(config: Pick<LeagueConfig, 'manual'>): RankView {
  const m = config.manual;
  const rank = m && parseRank(m.tier, m.division, m.lp);
  return rank ? { source: 'manual', rank, asOf: m.checkedOn } : { source: 'unavailable', rank: null, asOf: null };
}

const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Validates the API's JSON. A ranked answer without a valid tier is treated as no answer. */
export function parseRankResponse(raw: unknown): RankView | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object') return null;
  const asOf = isDate(r.fetchedAt) ? r.fetchedAt : null;
  if (r.ranked === false) return { source: 'unranked', rank: null, asOf };
  if (r.ranked !== true) return null;
  const rank = parseRank(r.tier, r.division, r.lp);
  if (!rank) return null;
  return { source: r.stale === true ? 'cached' : 'live', rank, asOf };
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
