import { describe, expect, it, vi } from 'vitest';
import { fetchLastPlayed, normalizeTrack, resolveLastPlayed, SpotifyError, supabaseCache, type Cache, type Deps, type LastPlayed } from './spotify';
import { corsHeaders } from './cors';

const ID = '3AJwUDP919kvQ9QcozQPxg';
const rawTrack = {
  id: ID, name: 'Yellow', type: 'track', is_local: false, duration_ms: 266773,
  artists: [{ name: 'Coldplay' }],
  album: { name: 'Parachutes', images: [
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
      id: ID, title: 'Yellow', artists: ['Coldplay'], album: 'Parachutes',
      albumArt: 'https://i.scdn.co/image/medium',
      spotifyUrl: `https://open.spotify.com/track/${ID}`,
      embedUrl: `https://open.spotify.com/embed/track/${ID}`,
      durationMs: 266773,
    });
  });
  it('drops a missing or nonsensical duration', () => {
    expect(normalizeTrack({ ...rawTrack, duration_ms: undefined })?.durationMs).toBeNull();
    expect(normalizeTrack({ ...rawTrack, duration_ms: -5 })?.durationMs).toBeNull();
    expect(normalizeTrack({ ...rawTrack, duration_ms: '300' })?.durationMs).toBeNull();
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

/** In-memory store with the private state rows, like the Supabase table. */
function store(initial: LastPlayed | null = null) {
  const state = new Map<string, unknown>();
  return {
    value: initial,
    state,
    async read() { return this.value; },
    async write(v: LastPlayed) { this.value = v; },
    async readState(k: string) { return state.get(k) ?? null; },
    async writeState(k: string, v: unknown) { state.set(k, v); },
  } as Cache & { value: LastPlayed | null; state: Map<string, unknown> };
}
const playing = () => json({ is_playing: true, currently_playing_type: 'track', item: rawTrack });
const at = (iso: string) => () => new Date(iso);

describe('rate-limit cooldown (Codex finding 2)', () => {
  const cachedTrack: LastPlayed = { track: normalizeTrack(rawTrack)!, isCurrentlyPlaying: true, playedAt: null, updatedAt: '2026-11-01T10:00:00.000Z' };

  it('a 429 with Retry-After starts a cooldown, serves the cached track with the wait, and does not call Spotify until it ends', async () => {
    const cache = store(cachedTrack);
    const memo = { cooldownUntil: 0 };
    const limited = fakeFetch({ 'api/token': token, 'currently-playing': () => new Response(null, { status: 429, headers: { 'retry-after': '120' } }) });
    const first = await resolveLastPlayed({ env, fetch: limited, cache, now: at('2026-11-01T20:00:00Z'), memo });
    expect(first).toMatchObject({ error: 'rate-limited', retryAfter: 120, stale: true });
    expect(first.data?.isCurrentlyPlaying).toBe(false);
    expect(cache.state.get('cooldown')).toEqual({ until: '2026-11-01T20:02:00.000Z' });

    // A minute later (even on a cold instance with an empty memo): no Spotify call, 60 s left.
    const quiet = fakeFetch({});
    const during = await resolveLastPlayed({ env, fetch: quiet, cache, now: at('2026-11-01T20:01:00Z'), memo: { cooldownUntil: 0 } });
    expect(quiet).not.toHaveBeenCalled();
    expect(during).toMatchObject({ error: 'rate-limited', retryAfter: 60, stale: true });

    // After the cooldown, Spotify is asked again and recovery is normal.
    const ok = fakeFetch({ 'api/token': token, 'currently-playing': playing });
    const after = await resolveLastPlayed({ env, fetch: ok, cache, now: at('2026-11-01T20:02:01Z'), memo });
    expect(ok).toHaveBeenCalled();
    expect(after).toMatchObject({ error: null, stale: false });
    expect(after.data?.isCurrentlyPlaying).toBe(true);
  });

  it('works from memory alone when there is no shared store', async () => {
    const memo = { cooldownUntil: 0 };
    const limited = fakeFetch({ 'api/token': () => new Response(null, { status: 429, headers: { 'retry-after': '5' } }) });
    expect(await resolveLastPlayed({ env, fetch: limited, cache: null, now: at('2026-11-01T20:00:00Z'), memo })).toMatchObject({ data: null, retryAfter: 5 });
    const quiet = fakeFetch({});
    await resolveLastPlayed({ env, fetch: quiet, cache: null, now: at('2026-11-01T20:00:04Z'), memo });
    expect(quiet).not.toHaveBeenCalled();
  });

  it('uses a default wait when Spotify sends no usable Retry-After', async () => {
    const cache = store();
    const limited = fakeFetch({ 'api/token': token, 'currently-playing': () => new Response(null, { status: 429 }) });
    expect((await resolveLastPlayed({ env, fetch: limited, cache, now: at('2026-11-01T20:00:00Z') })).retryAfter).toBe(30);
  });
});

describe('refresh token rotation (Codex finding 3)', () => {
  const rotating = (issued: string) => fakeFetch({ 'api/token': () => json({ access_token: 'access', refresh_token: issued }), 'currently-playing': playing });
  const sentRefresh = (f: ReturnType<typeof fakeFetch>) => f.mock.calls.filter(([u]) => String(u).includes('api/token')).map(([, init]) => new URLSearchParams(String((init as RequestInit).body)).get('refresh_token'));

  it('keeps a replacement refresh token, encrypted, and uses it next time', async () => {
    const cache = store();
    await resolveLastPlayed({ env, fetch: rotating('rotated-1'), cache, now });
    const saved = cache.state.get('auth');
    expect(saved).toBeTruthy();
    expect(JSON.stringify(saved)).not.toContain('rotated-1');
    expect(JSON.stringify(saved)).not.toContain('refresh');
    const next = fakeFetch({ 'api/token': token, 'currently-playing': playing });
    await resolveLastPlayed({ env, fetch: next, cache, now });
    expect(sentRefresh(next)).toEqual(['rotated-1']);
  });

  it('never puts any token in the public track row', async () => {
    const cache = store();
    await resolveLastPlayed({ env, fetch: rotating('rotated-1'), cache, now });
    expect(JSON.stringify(cache.value)).not.toMatch(/rotated-1|refresh|access/);
  });

  it('falls back to the env token when the stored one is rejected', async () => {
    const cache = store();
    await resolveLastPlayed({ env, fetch: rotating('rotated-1'), cache, now });
    let calls = 0;
    const f = fakeFetch({
      'api/token': () => (calls++ === 0 ? json({ error: 'invalid_grant' }, { status: 400 }) : json({ access_token: 'access' })),
      'currently-playing': playing,
    });
    const r = await resolveLastPlayed({ env, fetch: f, cache, now });
    expect(r.error).toBeNull();
    expect(sentRefresh(f)).toEqual(['rotated-1', 'refresh']);
  });

  it('a new env token (re-authorization) wins over a token stored for the old one', async () => {
    const cache = store();
    await resolveLastPlayed({ env, fetch: rotating('rotated-1'), cache, now });
    const f = fakeFetch({ 'api/token': token, 'currently-playing': playing });
    await resolveLastPlayed({ env: { ...env, SPOTIFY_REFRESH_TOKEN: 'reauthorized' }, fetch: f, cache, now });
    expect(sentRefresh(f)).toEqual(['reauthorized']);
  });

  it('a stored token cannot be read with a different client secret', async () => {
    const cache = store();
    await resolveLastPlayed({ env, fetch: rotating('rotated-1'), cache, now });
    const f = fakeFetch({ 'api/token': token, 'currently-playing': playing });
    await resolveLastPlayed({ env: { ...env, SPOTIFY_CLIENT_SECRET: 'other' }, fetch: f, cache, now });
    expect(sentRefresh(f)).toEqual(['refresh']);
  });
});

describe('supabaseCache', () => {
  const capture = () => vi.fn(async () => json([])) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  it('sends a new secret key only as apikey, and accepts the full REST URL', async () => {
    const f = capture();
    await supabaseCache({ SUPABASE_URL: 'https://x.supabase.co/rest/v1/', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' }, f)!.read();
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe('https://x.supabase.co/rest/v1/spotify_cache?id=eq.last-played&select=payload');
    expect((init as RequestInit).headers).toMatchObject({ apikey: 'sb_secret_abc' });
    expect((init as RequestInit).headers).not.toHaveProperty('authorization');
  });
  it('keeps the bearer header for legacy JWT service_role keys', async () => {
    const f = capture();
    await supabaseCache({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOi.legacy' }, f)!.read();
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ authorization: 'Bearer eyJhbGciOi.legacy' });
  });
});
