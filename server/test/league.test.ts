import { afterEach, describe, expect, it, vi } from 'vitest';
import { handle } from '../api/league/rank';
import { normalizeEntries, resolveRank, settings, type Deps, type RowId } from '../lib/league';

const PUUID = 'p'.repeat(78);
const SOLO = { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 27, wins: 420, losses: 400, puuid: PUUID };
const FLEX = { queueType: 'RANKED_FLEX_SR', tier: 'PLATINUM', rank: 'I', leaguePoints: 90 };

function memoryStore(rows: Partial<Record<RowId, unknown>> = {}) {
  const data = new Map<RowId, unknown>(Object.entries(rows) as [RowId, unknown][]);
  return { data, read: async (id: RowId) => data.get(id) ?? null, write: async (id: RowId, v: unknown) => { data.set(id, v); } };
}

const MATCH = { info: { gameEndTimestamp: Date.parse('2026-11-05T11:30:00Z'), participants: [{ puuid: 'someone', championId: 1 }, { puuid: PUUID, championId: 62 }] } };
const CHAMPIONS = { data: { Annie: { id: 'Annie', key: '1', name: 'Annie' }, MonkeyKing: { id: 'MonkeyKing', key: '62', name: 'Wukong' } } };
const WUKONG = { name: 'Wukong', icon: 'https://ddragon.leagueoflegends.com/cdn/16.22.1/img/champion/MonkeyKing.png', playedAt: '2026-11-05T11:30:00.000Z' };
const RIOT_CALLS = [
  'https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/DippoBippo/cccc',
  `https://na1.api.riotgames.com/lol/league/v4/entries/by-puuid/${PUUID}`,
  `https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${PUUID}/ids?queue=420&start=0&count=1`,
  'https://americas.api.riotgames.com/lol/match/v5/matches/NA1_5000',
];

/** A fake Riot API and Data Dragon that record every call. */
function riot(entries: unknown = [SOLO, FLEX], opts: { account?: number; league?: number; match?: number; retryAfter?: string; ids?: unknown } = {}) {
  const calls: string[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url);
    const token = (init?.headers as Record<string, string> | undefined)?.['X-Riot-Token'];
    if (url.startsWith('https://ddragon.leagueoflegends.com/')) {
      // The key only ever goes to Riot's API hosts.
      expect(token).toBeUndefined();
      return Response.json(url.endsWith('/versions.json') ? ['16.22.1', '16.21.1'] : CHAMPIONS);
    }
    expect(token).toBe('RGAPI-test');
    const status = url.includes('/riot/account/') ? opts.account ?? 200 : url.includes('/match/') ? opts.match ?? 200 : opts.league ?? 200;
    const headers = opts.retryAfter ? { 'retry-after': opts.retryAfter } : undefined;
    if (status !== 200) return new Response('{}', { status, headers });
    if (url.includes('/riot/account/')) return Response.json({ puuid: PUUID, gameName: 'DippoBippo', tagLine: 'cccc' });
    if (url.includes('/ids?')) return Response.json(opts.ids ?? ['NA1_5000']);
    if (url.includes('/match/')) return Response.json(MATCH);
    return Response.json(entries);
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const at = (iso: string) => () => new Date(iso);
const deps = (over: Partial<Deps>): Deps => ({ env: { RIOT_API_KEY: 'RGAPI-test' }, fetch: riot().fetch, store: memoryStore(), now: at('2026-11-05T12:00:00Z'), ...over });

describe('settings', () => {
  it('defaults to DippoBippo#cccc on NA1 and maps the platform to its Account-V1 region', () => {
    expect(settings({})).toMatchObject({ riotId: 'DippoBippo#cccc', gameName: 'DippoBippo', tagLine: 'cccc', platform: 'na1', region: 'americas', refreshMs: 45 * 60_000 });
    expect(settings({ LEAGUE_RIOT_ID: 'Some One#EUW', LEAGUE_PLATFORM: 'EUW1' })).toMatchObject({ gameName: 'Some One', tagLine: 'EUW', platform: 'euw1', region: 'europe' });
    expect(settings({ LEAGUE_PLATFORM: 'OC1' })).toMatchObject({ region: 'asia', matchRegion: 'sea' });
    expect(settings({ LEAGUE_PLATFORM: 'mars1' })).toBeNull();
    expect(settings({ LEAGUE_RIOT_ID: 'no-tag' })).toBeNull();
    // Refresh can be changed, but never below 10 minutes.
    expect(settings({ LEAGUE_REFRESH_MINUTES: '1' })!.refreshMs).toBe(10 * 60_000);
  });
});

describe('Solo/Duo entry', () => {
  it('keeps only the public rank fields of the Solo/Duo queue', () => {
    expect(normalizeEntries([FLEX, SOLO], 'DippoBippo#cccc', 't')).toEqual({ riotId: 'DippoBippo#cccc', queue: 'RANKED_SOLO_5x5', ranked: true, tier: 'GOLD', division: 'II', lp: 27, fetchedAt: 't' });
  });
  it('reports unranked (placements, season reset) when there is no valid Solo/Duo entry', () => {
    for (const raw of [[], [FLEX], null, { status: 'oops' }, [{ ...SOLO, tier: 'WOOD' }], [{ ...SOLO, rank: 'V' }]]) {
      expect(normalizeEntries(raw, 'x#y', 't')).toEqual({ riotId: 'x#y', queue: 'RANKED_SOLO_5x5', ranked: false, fetchedAt: 't' });
    }
  });
  it('drops an invalid LP value rather than inventing one, and has no division above Diamond', () => {
    expect(normalizeEntries([{ ...SOLO, leaguePoints: -3 }], 'x#y', 't')).not.toHaveProperty('lp');
    expect(normalizeEntries([{ ...SOLO, tier: 'MASTER', rank: 'I', leaguePoints: 211 }], 'x#y', 't')).toEqual({ riotId: 'x#y', queue: 'RANKED_SOLO_5x5', ranked: true, tier: 'MASTER', lp: 211, fetchedAt: 't' });
  });
});

describe('rank lookup and cache', () => {
  it('resolves the Riot ID once, reads League-V4 by PUUID, and caches both', async () => {
    const r = riot();
    const store = memoryStore();
    const out = await resolveRank(deps({ fetch: r.fetch, store }));
    expect(out).toEqual({ data: expect.objectContaining({ ranked: true, tier: 'GOLD', division: 'II', lp: 27, lastChampion: WUKONG, fetchedAt: '2026-11-05T12:00:00.000Z' }), stale: false, error: null });
    expect(r.calls.filter((u) => u.includes('api.riotgames.com'))).toEqual(RIOT_CALLS);
    expect(store.data.get('league-account')).toEqual({ riotId: 'DippoBippo#cccc', puuid: PUUID });
    // The public row never holds the PUUID or win/loss record.
    expect(JSON.stringify(store.data.get('league-rank'))).not.toMatch(/puuid|wins|losses/);
  });

  it('does not ask Riot again inside the refresh window, then refreshes with the saved PUUID', async () => {
    const r = riot();
    const store = memoryStore();
    await resolveRank(deps({ fetch: r.fetch, store }));
    r.calls.length = 0;
    for (const t of ['2026-11-05T12:10:00Z', '2026-11-05T12:44:00Z']) expect((await resolveRank(deps({ fetch: r.fetch, store, now: at(t) }))).stale).toBe(false);
    expect(r.calls).toEqual([]);
    await resolveRank(deps({ fetch: r.fetch, store, now: at('2026-11-05T12:46:00Z') }));
    expect(r.calls.filter((u) => u.includes('api.riotgames.com'))).toEqual(RIOT_CALLS.slice(1));
  });

  it('looks up the champion by id in Data Dragon (Wukong is "MonkeyKing" there)', async () => {
    const r = riot();
    await resolveRank(deps({ fetch: r.fetch }));
    expect(r.calls.filter((u) => u.includes('ddragon'))).toEqual([
      'https://ddragon.leagueoflegends.com/api/versions.json',
      'https://ddragon.leagueoflegends.com/cdn/16.22.1/data/en_US/champion.json',
    ]);
  });

  it('still returns the rank when the match lookup fails, keeping the last known champion', async () => {
    const out = await resolveRank(deps({ fetch: riot(undefined, { match: 500 }).fetch }));
    expect(out).toMatchObject({ stale: false, error: null, data: { tier: 'GOLD', lp: 27 } });
    expect(out.data).not.toHaveProperty('lastChampion');
    const saved = { riotId: 'DippoBippo#cccc', queue: 'RANKED_SOLO_5x5', ranked: true, tier: 'GOLD', division: 'II', lp: 10, lastChampion: WUKONG, fetchedAt: '2026-11-05T09:00:00.000Z' };
    const again = await resolveRank(deps({ fetch: riot(undefined, { match: 429 }).fetch, store: memoryStore({ 'league-rank': saved }) }));
    expect(again).toMatchObject({ stale: false, error: null, data: { lp: 27, lastChampion: WUKONG } });
    // No matches at all: nothing is shown rather than a guess.
    const none = await resolveRank(deps({ fetch: riot(undefined, { ids: [] }).fetch }));
    expect(none.data).not.toHaveProperty('lastChampion');
  });

  it('serves the last cached rank, marked stale, when Riot fails or the key has expired', async () => {
    const saved = { riotId: 'DippoBippo#cccc', queue: 'RANKED_SOLO_5x5', ranked: true, tier: 'GOLD', division: 'III', lp: 80, fetchedAt: '2026-11-05T09:00:00.000Z' };
    const store = memoryStore({ 'league-rank': saved });
    for (const [opts, error] of [[{ league: 500 }, 'unavailable'], [{ league: 403 }, 'unauthorized'], [{ account: 401 }, 'unauthorized']] as const) {
      const out = await resolveRank(deps({ fetch: riot(undefined, opts).fetch, store: memoryStore({ 'league-rank': saved }) }));
      expect(out).toMatchObject({ stale: true, error, data: { tier: 'GOLD', division: 'III', lp: 80 } });
    }
    const missingKey = await resolveRank(deps({ env: {}, store }));
    expect(missingKey).toMatchObject({ stale: true, error: 'not-configured', data: { tier: 'GOLD' } });
  });

  it('ignores a cached rank that belongs to a different account', async () => {
    const store = memoryStore({ 'league-rank': { riotId: 'Old#NA1', ranked: true, tier: 'DIAMOND', division: 'I', lp: 1, fetchedAt: '2026-11-05T11:59:00.000Z' } });
    const out = await resolveRank(deps({ env: {}, store }));
    expect(out).toEqual({ data: null, stale: false, error: 'not-configured' });
  });

  it('honours Retry-After: no Riot calls until the cooldown ends', async () => {
    const r = riot(undefined, { league: 429, retryAfter: '90' });
    const store = memoryStore({ 'league-account': { riotId: 'DippoBippo#cccc', puuid: PUUID } });
    const first = await resolveRank(deps({ fetch: r.fetch, store }));
    expect(first).toMatchObject({ error: 'rate-limited', retryAfter: 90, data: null });
    const before = r.calls.length;
    const second = await resolveRank(deps({ fetch: r.fetch, store, now: at('2026-11-05T12:01:00Z') }));
    expect(second).toMatchObject({ error: 'rate-limited', retryAfter: 30 });
    expect(r.calls.length).toBe(before);
  });
});

describe('GET /api/league/rank', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers 503 and leaks nothing when the Riot key is not set', async () => {
    const res = await handle(new Request('https://api.example/api/league/rank'), {});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not-configured' });
  });

  it('returns the public rank with edge caching and CORS for the site only', async () => {
    vi.stubGlobal('fetch', riot().fetch);
    const res = await handle(new Request('https://api.example/api/league/rank', { headers: { origin: 'https://sherwinwang.dev' } }), { RIOT_API_KEY: 'RGAPI-test' });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://sherwinwang.dev');
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=600');
    const body = await res.json();
    expect(body).toMatchObject({ riotId: 'DippoBippo#cccc', ranked: true, tier: 'GOLD', division: 'II', lp: 27, stale: false });
    expect(body.lastChampion).toEqual(WUKONG);
    expect(JSON.stringify(body)).not.toMatch(/RGAPI|puuid|NA1_5000/i);
  });

  it('rejects other methods and lets no one pick another account', async () => {
    expect((await handle(new Request('https://api.example/', { method: 'POST' }), {})).status).toBe(405);
    vi.stubGlobal('fetch', riot().fetch);
    const res = await handle(new Request('https://api.example/api/league/rank?riotId=Someone%23else&platform=kr'), { RIOT_API_KEY: 'RGAPI-test' });
    expect((await res.json()).riotId).toBe('DippoBippo#cccc');
  });
});
