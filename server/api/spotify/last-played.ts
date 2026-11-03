import { resolveLastPlayed, supabaseCache } from '../../lib/spotify.js';
import { corsHeaders } from '../../lib/cors.js';

// Public, read-only endpoint. It returns only normalized track data and has no write path.
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
  });

  if (!result.data) {
    const status = result.error === 'rate-limited' ? 429 : result.error === 'empty' ? 404 : result.error === 'not-configured' ? 503 : 502;
    return Response.json({ error: result.error }, { status, headers: { ...cors, 'cache-control': 'public, s-maxage=15' } });
  }
  return Response.json(
    { ...result.data, stale: result.stale },
    {
      headers: {
        ...cors,
        // Edge-cache so a burst of visitors costs one Spotify lookup per window.
        'cache-control': `public, s-maxage=${result.stale ? 15 : 30}, stale-while-revalidate=60`,
      },
    },
  );
}

export const GET = respond;
export const OPTIONS = respond;
