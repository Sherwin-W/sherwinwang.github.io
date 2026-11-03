import { describe, expect, it, vi } from 'vitest';
import { fetchLastPlayed, normalizeTrack, resolveLastPlayed, SpotifyError, type Cache, type Deps, type LastPlayed } from './spotify';
import { corsHeaders } from './cors';

const ID = '3AJwUDP919kvQ9QcozQPxg';
const rawTrack = {
  id: ID, name: 'Gravity', type: 'track', is_local: false,
  artists: [{ name: 'John Mayer' }],
  album: { name: 'Continuum', images: [
    { url: 'https://i.scdn.co/image/small', width: 64 },
    { url: 'https://i.scdn.co/image/large', width: 640 },
    { url: 'https://i.scdn.co/image/medium', width: 300 },
  ] },
};
const env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
const now = () => new Date('2026-11-01T20:16:00Z');
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;
function fakeFetch(routes: Record<string, Route>) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) throw new Error(`unexpected ${u}`);
    return routes[key](u, init);
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}
const token: Route = () => json({ access_token: 'access' });
const deps = (f: typeof fetch, cache: Cache | null = null): Deps => ({ env, fetch: f, cache, now });

describe('normalizeTrack', () => {
  it('maps a track and builds links from the id', () => {
    expect(normalizeTrack(rawTrack)).toEqual({
      id: ID, title: 'Gravity', artists: ['John Mayer'], album: 'Continuum',
      albumArt: 'https://i.scdn.co/image/medium',
      spotifyUrl: `https://open.spotify.com/track/${ID}`,
      embedUrl: `https://open.spotify.com/embed/track/${ID}`,
    });
  });
  it.each([
    ['episode', { ...rawTrack, type: 'episode' }],
    ['local file', { ...rawTrack, is_local: true }],
    ['bad id', { ...rawTrack, id: '../evil' }],
    ['null', null],
  ])('rejects %s', (_n, raw) => expect(normalizeTrack(raw)).toBeNull());
  it('drops album art not served from Spotify', () => {
    const t = normalizeTrack({ ...rawTrack, album: { name: 'x', images: [{ url: 'https://evil.example/a.jpg', width: 300 }] } });
    expect(t?.albumArt).toBeNull();
  });
});

describe('fetchLastPlayed', () => {
  it('prefers the currently playing track', async () => {
    const f = fakeFetch({
      'api/token': token,
      'currently-playing': () => json({ is_playing: true, currently_playing_type: 'track', item: rawTrack }),
    });
    const r = await fetchLastPlayed(deps(f));
    expect(r).toMatchObject({ isCurrentlyPlaying: true, playedAt: null, updatedAt: '2026-11-01T20:16:00.000Z' });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('falls back to recently played on 204, using played_at not request time', async () => {
    const f = fakeFetch({
      'api/token': token,
      'currently-playing': () => new Response(null, { status: 204 }),
      'recently-played': () => json({ items: [{ track: { ...rawTrack, type: 'episode' }, played_at: '2026-11-01T19:00:00Z' }, { track: rawTrack, played_at: '2026-11-01T18:30:00Z' }] }),
    });
    const r = await fetchLastPlayed(deps(f));
    expect(r.isCurrentlyPlaying).toBe(false);
    expect(r.playedAt).toBe('2026-11-01T18:30:00Z');
  });
  it('treats a paused player as not currently playing', async () => {
    const f = fakeFetch({
      'api/token': token,
      'currently-playing': () => json({ is_playing: false, currently_playing_type: 'track', item: rawTrack }),
      'recently-played': () => json({ items: [{ track: rawTrack, played_at: '2026-11-01T18:30:00Z' }] }),
    });
    expect((await fetchLastPlayed(deps(f))).isCurrentlyPlaying).toBe(false);
  });
  it('reports empty history', async () => {
    const f = fakeFetch({ 'api/token': token, 'currently-playing': () => new Response(null, { status: 204 }), 'recently-played': () => json({ items: [] }) });
    await expect(fetchLastPlayed(deps(f))).rejects.toMatchObject({ kind: 'empty' });
  });
  it('reports missing configuration without calling Spotify', async () => {
    const f = fakeFetch({});
    await expect(fetchLastPlayed({ ...deps(f), env: {} })).rejects.toMatchObject({ kind: 'not-configured' });
    expect(f).not.toHaveBeenCalled();
  });
  it('maps a revoked refresh token to unauthorized', async () => {
    const f = fakeFetch({ 'api/token': () => json({ error: 'invalid_grant' }, { status: 400 }) });
    await expect(fetchLastPlayed(deps(f))).rejects.toMatchObject({ kind: 'unauthorized' });
  });
  it('maps 429 with Retry-After', async () => {
    const f = fakeFetch({ 'api/token': token, 'currently-playing': () => new Response(null, { status: 429, headers: { 'retry-after': '12' } }) });
    await expect(fetchLastPlayed(deps(f))).rejects.toMatchObject({ kind: 'rate-limited', retryAfter: 12 });
  });
  it('maps network failures to unavailable', async () => {
    const f = vi.fn(async () => { throw new TypeError('network'); }) as unknown as typeof fetch;
    await expect(fetchLastPlayed(deps(f))).rejects.toBeInstanceOf(SpotifyError);
  });
  it('sends the refresh token only to Spotify, as form data', async () => {
    const f = fakeFetch({ 'api/token': token, 'currently-playing': () => json({ is_playing: true, currently_playing_type: 'track', item: rawTrack }) });
    await fetchLastPlayed(deps(f));
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://accounts.spotify.com/api/token');
    expect(String((init as RequestInit).body)).toContain('refresh_token=refresh');
  });
});

describe('resolveLastPlayed', () => {
  const stored: LastPlayed = { track: normalizeTrack(rawTrack)!, isCurrentlyPlaying: true, playedAt: null, updatedAt: '2026-11-01T10:00:00.000Z' };
  const memory = (initial: LastPlayed | null): Cache & { value: LastPlayed | null } => ({
    value: initial,
    async read() { return this.value; },
    async write(v) { this.value = v; },
  });

  it('writes successful lookups to the cache', async () => {
    const cache = memory(null);
    const f = fakeFetch({ 'api/token': token, 'currently-playing': () => json({ is_playing: true, currently_playing_type: 'track', item: rawTrack }) });
    const r = await resolveLastPlayed(deps(f, cache));
    expect(r.stale).toBe(false);
    expect(cache.value?.track.id).toBe(ID);
  });
  it('serves the cached track, no longer marked as playing, when Spotify fails', async () => {
    const f = fakeFetch({ 'api/token': () => new Response(null, { status: 503 }) });
    const r = await resolveLastPlayed(deps(f, memory(stored)));
    expect(r).toMatchObject({ stale: true, error: 'unavailable' });
    expect(r.data?.isCurrentlyPlaying).toBe(false);
  });
  it('returns no data when Spotify fails and nothing is cached', async () => {
    const f = fakeFetch({ 'api/token': () => new Response(null, { status: 503 }) });
    expect(await resolveLastPlayed(deps(f, memory(null)))).toMatchObject({ data: null, error: 'unavailable' });
  });
  it('survives a broken cache', async () => {
    const broken: Cache = { read: async () => { throw new Error('db'); }, write: async () => { throw new Error('db'); } };
    const f = fakeFetch({ 'api/token': token, 'currently-playing': () => json({ is_playing: true, currently_playing_type: 'track', item: rawTrack }) });
    expect((await resolveLastPlayed(deps(f, broken))).data?.track.id).toBe(ID);
  });
});

describe('corsHeaders', () => {
  const req = (origin?: string) => new Request('https://api.example/x', { headers: origin ? { origin } : {} });
  it('allows the production site by default', () => {
    expect(corsHeaders(req('https://sherwinwang.dev'))['access-control-allow-origin']).toBe('https://sherwinwang.dev');
  });
  it('does not allow other origins', () => {
    expect(corsHeaders(req('https://evil.example'))['access-control-allow-origin']).toBeUndefined();
  });
  it('honors ALLOWED_ORIGINS', () => {
    expect(corsHeaders(req('http://localhost:5173'), 'http://localhost:5173')['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
