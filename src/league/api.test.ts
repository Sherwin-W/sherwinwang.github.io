import { afterEach, describe, expect, it, vi } from 'vitest';
import league, { type LeagueConfig } from '../data/league';
import { manualView, parseChampion, parseRankResponse, resolveRank } from './api';

const config: LeagueConfig = { ...league, mode: 'live', manual: { tier: 'GOLD', division: 'II', lp: 27, checkedOn: '2026-11-05' } };
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe('rank data', () => {
  it('reads a live answer, and labels a cached one as cached', () => {
    const body = { ranked: true, tier: 'PLATINUM', division: 'III', lp: 41, fetchedAt: '2026-11-05T10:00:00.000Z' };
    expect(parseRankResponse({ ...body, stale: false })).toEqual({ source: 'live', rank: { tier: 'PLATINUM', division: 'III', lp: 41 }, asOf: body.fetchedAt, champion: null });
    expect(parseRankResponse({ ...body, stale: true })?.source).toBe('cached');
  });

  it('treats a missing Solo/Duo entry as unranked (placements or a new season), with no rank shown', () => {
    expect(parseRankResponse({ ranked: false, fetchedAt: '2026-11-05T10:00:00.000Z' })).toEqual({ source: 'unranked', rank: null, asOf: '2026-11-05T10:00:00.000Z', champion: null });
  });

  it('reads the last champion, and accepts a portrait only from Data Dragon', () => {
    const icon = 'https://ddragon.leagueoflegends.com/cdn/16.22.1/img/champion/MonkeyKing.png';
    const body = { ranked: true, tier: 'GOLD', division: 'II', lp: 63, fetchedAt: '2026-11-05T10:00:00.000Z', lastChampion: { name: 'Wukong', icon, playedAt: '2026-11-05T09:30:00.000Z' } };
    expect(parseRankResponse(body)?.champion).toEqual({ name: 'Wukong', icon, playedAt: '2026-11-05T09:30:00.000Z' });
    expect(parseChampion({ name: 'Wukong', icon })).toEqual({ name: 'Wukong', icon, playedAt: null });
    for (const bad of [null, { name: '', icon }, { name: 'Wukong' }, { name: 'Wukong', icon: 'https://evil.example/MonkeyKing.png' }, { name: 'Wukong', icon: 'javascript:alert(1)' }]) {
      expect(parseChampion(bad)).toBeNull();
    }
  });

  it('rejects a malformed answer rather than showing a wrong rank', () => {
    expect(parseRankResponse(null)).toBeNull();
    expect(parseRankResponse({ ranked: true, tier: 'WOOD', division: 'I', lp: 3 })).toBeNull();
    expect(parseRankResponse({ tier: 'GOLD', division: 'I', lp: 3 })).toBeNull();
  });

  it('labels hand-entered data as manual, and shows nothing when there is none', () => {
    expect(manualView(config)).toEqual({ source: 'manual', rank: { tier: 'GOLD', division: 'II', lp: 27 }, asOf: '2026-11-05' });
    expect(manualView({ manual: null })).toEqual({ source: 'unavailable', rank: null, asOf: null });
  });

  it('falls back to the manual rank when the API fails or is not set up', async () => {
    vi.stubGlobal('fetch', reply(503, { error: 'not-configured' }));
    expect((await resolveRank(config, 'https://api.example')).source).toBe('manual');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect((await resolveRank(config, 'https://api.example')).source).toBe('manual');
    vi.stubGlobal('fetch', reply(502, {}));
    expect((await resolveRank({ ...config, manual: null }, 'https://api.example')).source).toBe('unavailable');
  });

  it('uses the API’s cached answer over the manual rank, and never calls it in manual mode', async () => {
    const f = reply(200, { ranked: true, tier: 'GOLD', division: 'I', lp: 12, fetchedAt: '2026-11-05T09:00:00.000Z', stale: true });
    vi.stubGlobal('fetch', f);
    const view = await resolveRank(config, 'https://api.example/');
    expect(view).toMatchObject({ source: 'cached', rank: { tier: 'GOLD', division: 'I', lp: 12 } });
    expect(f).toHaveBeenCalledWith('https://api.example/api/league/rank', expect.anything());
    f.mockClear();
    expect((await resolveRank({ ...config, mode: 'manual' }, 'https://api.example')).source).toBe('manual');
    expect((await resolveRank(config, undefined)).source).toBe('manual');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('league config', () => {
  it('names the account, queue, goal and a 30-60 minute refresh in one place', () => {
    expect(league.riotId).toBe('DippoBippo#cccc');
    expect(league.queue).toBe('RANKED_SOLO_5x5');
    expect(league.goal).toEqual({ tier: 'DIAMOND', division: 'IV' });
    expect(league.refreshMinutes).toBeGreaterThanOrEqual(30);
    expect(league.refreshMinutes).toBeLessThanOrEqual(60);
    expect(league.opggUrl).toBe('https://op.gg/lol/summoners/na/DippoBippo-cccc');
  });
});
