import { resolveLastPlayed, supabaseCache } from '../../lib/spotify.js';
import { corsHeaders } from '../../lib/cors.js';

// Public, read-only endpoint. It returns only normalized track data and has no write path.

/** Cooldown memory for this warm instance; the Supabase state row shares it across instances. */
const memo = { cooldownUntil: 0 };

function respond(request: Request): Promise<Response> {
  return handle(request);
}

export async function handle(request: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  const cors = corsHeaders(request, env.ALLOWED_ORIGINS);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { ...cors, allow: 'GET, OPTIONS' } });

  const result = await resolveLastPlayed({
    env,
    fetch,
    cache: supabaseCache(env, fetch),
    now: () => new Date(),
    memo,
  });
  // Tell the browser how long to wait, and keep the edge from asking again during a rate-limit cooldown.
  const wait = result.retryAfter;
  const retry: Record<string, string> = wait ? { 'retry-after': String(wait) } : {};
  const edge = wait ? Math.min(Math.max(wait, 15), 600) : null;

  if (!result.data) {
    const status = result.error === 'rate-limited' ? 429 : result.error === 'empty' ? 404 : result.error === 'not-configured' ? 503 : 502;
    return Response.json(
      { error: result.error, ...(wait ? { retryAfter: wait } : {}) },
      { status, headers: { ...cors, ...retry, 'cache-control': `public, s-maxage=${edge ?? 15}` } },
    );
  }
  return Response.json(
    { ...result.data, stale: result.stale, ...(wait ? { retryAfter: wait } : {}) },
    {
      headers: {
        ...cors,
        ...retry,
        // Edge-cache so a burst of visitors costs one Spotify lookup per window.
        'cache-control': `public, s-maxage=${edge ?? (result.stale ? 15 : 30)}, stale-while-revalidate=60`,
      },
    },
  );
}

export const GET = respond;
export const OPTIONS = respond;
