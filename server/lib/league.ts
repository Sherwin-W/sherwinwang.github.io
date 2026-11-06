// Server-side League of Legends rank lookup for one configured account. The Riot API key comes from the
// environment and never reaches a visitor; visitors only ever get the small public rank object below.
//
// Riot is asked at most once per refresh window (default 45 minutes): the answer is cached in the same
// Supabase table the Spotify tile uses, and every other request is served from that cache.

export const QUEUE = 'RANKED_SOLO_5x5';

export interface PublicRank {
  riotId: string;
  queue: typeof QUEUE;
  /** False when the account has no Solo/Duo entry: unranked, in placements, or after a season reset. */
  ranked: boolean;
  tier?: string;
  division?: string;
  lp?: number;
  /** Champion from the account's most recent ranked Solo/Duo match. Missing when Riot or Data Dragon could not say. */
  lastChampion?: LastChampion;
  /** When Riot last answered. */
  fetchedAt: string;
}

export interface LastChampion {
  name: string;
  /** Square portrait on Riot's Data Dragon CDN. */
  icon: string;
  /** When that match ended. */
  playedAt?: string;
}

export interface LeagueEnv {
  RIOT_API_KEY?: string;
  /** Riot ID as "gameName#tagLine". */
  LEAGUE_RIOT_ID?: string;
  /** Platform routing value, e.g. na1. */
  LEAGUE_PLATFORM?: string;
  LEAGUE_REFRESH_MINUTES?: string;
}

export const DEFAULTS = { riotId: 'DippoBippo#cccc', platform: 'na1', refreshMinutes: 45 };

/** Private rows: the public rank, the account's PUUID, and a rate-limit cooldown. */
export type RowId = 'league-rank' | 'league-account' | 'league-cooldown';

export interface RowStore {
  read(id: RowId): Promise<unknown>;
  write(id: RowId, value: unknown): Promise<void>;
}

export type LeagueFailure = 'not-configured' | 'unauthorized' | 'not-found' | 'rate-limited' | 'unavailable';

export class LeagueError extends Error {
  constructor(public readonly kind: LeagueFailure, public readonly retryAfter?: number) {
    super(kind);
  }
}

export interface Deps {
  env: LeagueEnv;
  fetch: typeof fetch;
  store: RowStore | null;
  now: () => Date;
  timeoutMs?: number;
  /** Copies kept by a warm instance, so most requests skip the store too. */
  memo?: { rank?: PublicRank; cooldownUntil?: number };
}

export interface Settings { riotId: string; gameName: string; tagLine: string; platform: string; region: string; matchRegion: string; refreshMs: number }

const PLATFORMS: Record<string, string> = {
  na1: 'americas', br1: 'americas', la1: 'americas', la2: 'americas',
  euw1: 'europe', eun1: 'europe', tr1: 'europe', ru: 'europe', me1: 'europe',
  kr: 'asia', jp1: 'asia',
  // Account-V1 has no SEA cluster; any cluster can look up any account, so these use the nearest one.
  oc1: 'asia', ph2: 'asia', sg2: 'asia', th2: 'asia', tw2: 'asia', vn2: 'asia',
};

/** Match-V5 routing differs from Account-V1 only for the SEA platforms. */
const SEA = ['oc1', 'ph2', 'sg2', 'th2', 'tw2', 'vn2'];

export function settings(env: LeagueEnv): Settings | null {
  const riotId = (env.LEAGUE_RIOT_ID || DEFAULTS.riotId).trim();
  const hash = riotId.lastIndexOf('#');
  const gameName = riotId.slice(0, hash).trim();
  const tagLine = riotId.slice(hash + 1).trim();
  const platform = (env.LEAGUE_PLATFORM || DEFAULTS.platform).trim().toLowerCase();
  const region = PLATFORMS[platform];
  if (hash <= 0 || !gameName || !tagLine || !region) return null;
  const minutes = Number(env.LEAGUE_REFRESH_MINUTES);
  // Never more often than every 10 minutes, whatever the setting says.
  const refreshMs = Math.max(10, Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULTS.refreshMinutes) * 60_000;
  return { riotId: `${gameName}#${tagLine}`, gameName, tagLine, platform, region, matchRegion: SEA.includes(platform) ? 'sea' : region, refreshMs };
}

const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
const APEX = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];
const DIVISIONS = ['I', 'II', 'III', 'IV'];

/** Picks the Solo/Duo entry from League-V4's answer. Anything malformed counts as no entry. */
export function normalizeEntries(raw: unknown, riotId: string, fetchedAt: string): PublicRank {
  const unranked: PublicRank = { riotId, queue: QUEUE, ranked: false, fetchedAt };
  if (!Array.isArray(raw)) return unranked;
  const e = raw.find((x) => (x as { queueType?: unknown })?.queueType === QUEUE) as Record<string, unknown> | undefined;
  if (!e || typeof e.tier !== 'string' || !TIERS.includes(e.tier)) return unranked;
  const apex = APEX.includes(e.tier);
  if (!apex && (typeof e.rank !== 'string' || !DIVISIONS.includes(e.rank))) return unranked;
  const lp = typeof e.leaguePoints === 'number' && Number.isFinite(e.leaguePoints) && e.leaguePoints >= 0 ? Math.floor(e.leaguePoints) : undefined;
  return { riotId, queue: QUEUE, ranked: true, tier: e.tier, ...(apex ? {} : { division: e.rank as string }), ...(lp === undefined ? {} : { lp }), fetchedAt };
}

function readRank(value: unknown, riotId: string): PublicRank | null {
  const r = value as PublicRank | null;
  if (!r || typeof r !== 'object' || r.riotId !== riotId || typeof r.fetchedAt !== 'string' || Number.isNaN(Date.parse(r.fetchedAt))) return null;
  return r;
}

async function riotGet(deps: Deps, key: string, url: string): Promise<Response> {
  let res: Response;
  try {
    res = await deps.fetch(url, { headers: { 'X-Riot-Token': key }, signal: AbortSignal.timeout(deps.timeoutMs ?? 5000) });
  } catch {
    throw new LeagueError('unavailable');
  }
  if (res.status === 401 || res.status === 403) throw new LeagueError('unauthorized');
  if (res.status === 404) throw new LeagueError('not-found');
  if (res.status === 429) {
    const s = Number(res.headers.get('retry-after'));
    throw new LeagueError('rate-limited', Number.isFinite(s) && s > 0 ? Math.ceil(s) : 60);
  }
  if (!res.ok) throw new LeagueError('unavailable');
  return res;
}

/** Riot ID → PUUID (Account-V1), cached in its own row since it never changes for an account. */
async function puuidFor(deps: Deps, key: string, s: Settings): Promise<string> {
  const saved = (await deps.store?.read('league-account').catch(() => null)) as { riotId?: unknown; puuid?: unknown } | null;
  if (saved?.riotId === s.riotId && typeof saved.puuid === 'string' && saved.puuid) return saved.puuid;
  const res = await riotGet(deps, key, `https://${s.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(s.gameName)}/${encodeURIComponent(s.tagLine)}`);
  const body = (await res.json()) as { puuid?: unknown };
  if (typeof body.puuid !== 'string' || !body.puuid) throw new LeagueError('unavailable');
  await deps.store?.write('league-account', { riotId: s.riotId, puuid: body.puuid }).catch(() => undefined);
  return body.puuid;
}

export const DDRAGON = 'https://ddragon.leagueoflegends.com';

/** Champion name and portrait from Data Dragon, Riot's public static CDN. No API key is sent there. */
async function championArt(deps: Deps, championId: number): Promise<Omit<LastChampion, 'playedAt'> | null> {
  const get = async (url: string) => {
    const res = await deps.fetch(url, { signal: AbortSignal.timeout(deps.timeoutMs ?? 5000) });
    if (!res.ok) throw new LeagueError('unavailable');
    return res.json() as Promise<unknown>;
  };
  const versions = await get(`${DDRAGON}/api/versions.json`);
  const version = Array.isArray(versions) ? versions[0] : null;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return null;
  const list = (await get(`${DDRAGON}/cdn/${version}/data/en_US/champion.json`)) as { data?: Record<string, { id?: unknown; key?: unknown; name?: unknown }> };
  const champ = Object.values(list?.data ?? {}).find((c) => c?.key === String(championId));
  if (!champ || typeof champ.id !== 'string' || !/^[A-Za-z0-9]+$/.test(champ.id) || typeof champ.name !== 'string') return null;
  return { name: champ.name, icon: `${DDRAGON}/cdn/${version}/img/champion/${champ.id}.png` };
}

/** Match-V5 queue id for ranked Solo/Duo (RANKED_SOLO_5x5). */
const SOLO_QUEUE_ID = 420;

/** The champion played in the account's latest ranked Solo/Duo match (Match-V5), or null when there is none. */
async function lastChampion(deps: Deps, key: string, s: Settings, puuid: string): Promise<LastChampion | null> {
  const base = `https://${s.matchRegion}.api.riotgames.com/lol/match/v5/matches`;
  const ids = await (await riotGet(deps, key, `${base}/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${SOLO_QUEUE_ID}&start=0&count=1`)).json();
  const id = Array.isArray(ids) ? ids[0] : null;
  if (typeof id !== 'string' || !id) return null;
  const match = (await (await riotGet(deps, key, `${base}/${encodeURIComponent(id)}`)).json()) as { info?: { gameEndTimestamp?: unknown; participants?: { puuid?: unknown; championId?: unknown }[] } };
  const me = match?.info?.participants?.find((p) => p?.puuid === puuid);
  if (!me || typeof me.championId !== 'number') return null;
  const art = await championArt(deps, me.championId);
  if (!art) return null;
  const end = match.info?.gameEndTimestamp;
  return { ...art, ...(typeof end === 'number' && end > 0 ? { playedAt: new Date(end).toISOString() } : {}) };
}

/**
 * Live lookup: Account-V1 for the PUUID, then League-V4 entries by PUUID, then the last Solo/Duo match's champion.
 * Throws LeagueError when the rank cannot be read; the champion is optional and never fails the lookup.
 */
export async function fetchRank(deps: Deps, s: Settings): Promise<PublicRank> {
  const key = deps.env.RIOT_API_KEY?.trim();
  if (!key) throw new LeagueError('not-configured');
  const puuid = await puuidFor(deps, key, s);
  const res = await riotGet(deps, key, `https://${s.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`);
  const rank = normalizeEntries(await res.json(), s.riotId, deps.now().toISOString());
  const champ = await lastChampion(deps, key, s, puuid).catch(() => null);
  return champ ? { ...rank, lastChampion: champ } : rank;
}

export interface Resolved {
  data: PublicRank | null;
  /** True when `data` is older than the refresh window because Riot could not be asked or did not answer. */
  stale: boolean;
  error: LeagueFailure | null;
  retryAfter?: number;
}

/**
 * Serves the cached rank while it is fresh; otherwise asks Riot once and caches the answer. Any failure falls
 * back to the last cached rank, marked stale. A rate-limit answer starts a cooldown during which Riot is not called.
 */
export async function resolveRank(deps: Deps): Promise<Resolved> {
  const s = settings(deps.env);
  if (!s) return { data: null, stale: false, error: 'not-configured' };
  const nowMs = deps.now().getTime();
  const fresh = (r: PublicRank | null): r is PublicRank => Boolean(r) && nowMs - Date.parse(r!.fetchedAt) < s.refreshMs;
  const remembered = readRank(deps.memo?.rank, s.riotId);
  if (fresh(remembered)) return { data: remembered, stale: false, error: null };
  // Another instance may have refreshed it since; the store is the shared copy.
  const cached = readRank(await deps.store?.read('league-rank').catch(() => null), s.riotId) ?? remembered;
  if (cached && deps.memo) deps.memo.rank = cached;
  if (fresh(cached)) return { data: cached, stale: false, error: null };

  const stored = (await deps.store?.read('league-cooldown').catch(() => null)) as { until?: unknown } | null;
  const until = Math.max(deps.memo?.cooldownUntil ?? 0, typeof stored?.until === 'string' ? Date.parse(stored.until) || 0 : 0);
  if (until > nowMs) return { data: cached, stale: Boolean(cached), error: 'rate-limited', retryAfter: Math.ceil((until - nowMs) / 1000) };

  try {
    let data = await fetchRank(deps, s);
    // Keep the last known champion when only the match lookup failed this time.
    const prior = (cached as PublicRank | null)?.lastChampion;
    if (!data.lastChampion && prior) data = { ...data, lastChampion: prior };
    if (deps.memo) deps.memo.rank = data;
    await deps.store?.write('league-rank', data).catch(() => undefined);
    return { data, stale: false, error: null };
  } catch (err) {
    const e = err instanceof LeagueError ? err : new LeagueError('unavailable');
    if (e.kind === 'rate-limited') {
      const end = nowMs + (e.retryAfter ?? 60) * 1000;
      if (deps.memo) deps.memo.cooldownUntil = end;
      await deps.store?.write('league-cooldown', { until: new Date(end).toISOString() }).catch(() => undefined);
    }
    return { data: cached, stale: Boolean(cached), error: e.kind, retryAfter: e.retryAfter };
  }
}

/**
 * Supabase (PostgREST) rows in the existing `spotify_cache` table (RLS on, no policies: only this service key
 * can read it). The endpoint only ever returns the public rank row's fields.
 */
export function supabaseRows(env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }, fetchImpl: typeof fetch): RowStore | null {
  const base = env.SUPABASE_URL?.replace(/\/$/, '').replace(/\/rest\/v1$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' };
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
  const url = `${base}/rest/v1/spotify_cache`;
  return {
    async read(id) {
      const res = await fetchImpl(`${url}?id=eq.${id}&select=payload`, { headers, signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      const rows = (await res.json()) as { payload?: unknown }[];
      return rows[0]?.payload ?? null;
    },
    async write(id, payload) {
      await fetchImpl(url, {
        method: 'POST',
        headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(3000),
      });
    },
  };
}
