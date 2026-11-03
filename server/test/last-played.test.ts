import { describe, expect, it, vi } from 'vitest';
import { handle } from '../api/spotify/last-played';

describe('GET /api/spotify/last-played', () => {
  it('answers 503 and leaks nothing when credentials are missing', async () => {
    const res = await handle(new Request('https://api.example/api/spotify/last-played'), {});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not-configured' });
  });
  it('rejects non-GET methods', async () => {
    expect((await handle(new Request('https://api.example/', { method: 'POST' }), {})).status).toBe(405);
  });
  it('answers preflight for the allowed origin only', async () => {
    const ok = await handle(new Request('https://api.example/', { method: 'OPTIONS', headers: { origin: 'https://sherwinwang.dev' } }), {});
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://sherwinwang.dev');
    const bad = await handle(new Request('https://api.example/', { method: 'OPTIONS', headers: { origin: 'https://x.example' } }), {});
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('rate limit at the endpoint', () => {
  const env = { SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SPOTIFY_REFRESH_TOKEN: 'refresh' };
  it('relays Retry-After to the browser, caches at the edge for the wait, and skips Spotify during the cooldown', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('api/token')) return new Response(JSON.stringify({ access_token: 'a' }), { status: 200 });
      return new Response(null, { status: 429, headers: { 'retry-after': '120' } });
    }));
    const req = () => new Request('https://api.example/api/spotify/last-played', { headers: { origin: 'https://sherwinwang.dev' } });
    const res = await handle(req(), env);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('120');
    expect(res.headers.get('access-control-expose-headers')).toBe('retry-after');
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=120');
    expect(await res.json()).toEqual({ error: 'rate-limited', retryAfter: 120 });
    const before = calls.length;
    const again = await handle(req(), env);
    expect(calls.length).toBe(before); // no Spotify call while cooling down
    expect(again.status).toBe(429);
    expect(Number(again.headers.get('retry-after'))).toBeLessThanOrEqual(120);
    vi.unstubAllGlobals();
  });
});
