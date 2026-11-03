import { describe, expect, it } from 'vitest';
import { handle } from './last-played';

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
