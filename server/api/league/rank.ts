import { resolveRank, supabaseRows, type PublicRank } from '../../lib/league.js';
import { corsHeaders } from '../../lib/cors.js';

// Public, read-only endpoint for the Road to Diamond widget. It looks up one configured account only
// (visitors cannot choose another), returns the public rank fields, and has no write path.

/** Copies for this warm instance; the Supabase rows are shared across instances. */
const memo: { rank?: PublicRank; cooldownUntil?: number } = {};

function respond(request: Request): Promise<Response> {
  return handle(request);
}

export async function handle(request: Request, env: Record<string, string | undefined> = process.env): Promise<Response> {
  const cors = corsHeaders(request, env.ALLOWED_ORIGINS);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { ...cors, allow: 'GET, OPTIONS' } });

  const result = await resolveRank({ env, fetch, store: supabaseRows(env, fetch), now: () => new Date(), memo });
  const wait = result.retryAfter;
  const retry: Record<string, string> = wait ? { 'retry-after': String(wait) } : {};

  if (!result.data) {
    const status = result.error === 'rate-limited' ? 429 : result.error === 'not-configured' ? 503 : result.error === 'not-found' ? 404 : 502;
    return Response.json({ error: result.error }, { status, headers: { ...cors, ...retry, 'cache-control': `public, s-maxage=${Math.min(Math.max(wait ?? 60, 60), 900)}` } });
  }
  return Response.json(
    { ...result.data, stale: result.stale },
    // The edge answers repeat visitors; the function itself only asks Riot once per refresh window.
    { headers: { ...cors, ...retry, 'cache-control': `public, s-maxage=${result.stale ? 120 : 300}, stale-while-revalidate=600` } },
  );
}

export const GET = respond;
export const OPTIONS = respond;
