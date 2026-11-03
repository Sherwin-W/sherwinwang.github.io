// Server-side Spotify service. Everything here runs on the server only: the refresh
// token and client credentials come from environment variables and never reach a visitor.

export interface PublicTrack {
  id: string;
  title: string;
  artists: string[];
  album: string;
  albumArt: string | null;
  spotifyUrl: string;
  embedUrl: string;
}

export interface LastPlayed {
  track: PublicTrack;
  isCurrentlyPlaying: boolean;
  playedAt: string | null;
  updatedAt: string;
}

export interface SpotifyEnv {
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  SPOTIFY_REFRESH_TOKEN?: string;
}

export interface Cache {
  read(): Promise<LastPlayed | null>;
  write(value: LastPlayed): Promise<void>;
}

export type SpotifyFailure = 'not-configured' | 'unauthorized' | 'rate-limited' | 'unavailable' | 'empty';

export class SpotifyError extends Error {
  constructor(public readonly kind: SpotifyFailure, public readonly retryAfter?: number) {
    super(kind);
  }
}

export interface Deps {
  env: SpotifyEnv;
  fetch: typeof fetch;
  cache: Cache | null;
  now: () => Date;
  timeoutMs?: number;
}

const TRACK_ID = /^[A-Za-z0-9]{22}$/;
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';

interface RawTrack {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  is_local?: unknown;
  artists?: unknown;
  album?: { name?: unknown; images?: unknown };
}

export function normalizeTrack(raw: unknown): PublicTrack | null {
  const t = raw as RawTrack | null;
  if (!t || typeof t !== 'object') return null;
  if (t.type !== 'track' || t.is_local === true) return null;
  if (typeof t.id !== 'string' || !TRACK_ID.test(t.id) || typeof t.name !== 'string') return null;
  const artists = Array.isArray(t.artists)
    ? t.artists.map((a) => (a as { name?: unknown })?.name).filter((n): n is string => typeof n === 'string')
    : [];
  const images = Array.isArray(t.album?.images) ? (t.album!.images as { url?: unknown; width?: unknown }[]) : [];
  const art = images
    .filter((i) => typeof i.url === 'string' && /^https:\/\/i\.scdn\.co\//.test(i.url as string))
    .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))
    .map((i) => i.url as string);
  return {
    id: t.id,
    title: t.name,
    artists,
    album: typeof t.album?.name === 'string' ? t.album.name : '',
    // The middle size (~300px) is plenty for a compact tile.
    albumArt: art[Math.min(1, art.length - 1)] ?? null,
    spotifyUrl: `https://open.spotify.com/track/${t.id}`,
    embedUrl: `https://open.spotify.com/embed/track/${t.id}`,
  };
}

export async function fetchAccessToken(deps: Deps): Promise<string> {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = deps.env;
  if (!id || !secret || !refresh) throw new SpotifyError('not-configured');
  const res = await timedFetch(deps, TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${id}:${secret}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  });
  if (res.status === 400 || res.status === 401) throw new SpotifyError('unauthorized');
  if (res.status === 429) throw rateLimited(res);
  if (!res.ok) throw new SpotifyError('unavailable');
  const body = (await res.json()) as { access_token?: unknown };
  if (typeof body.access_token !== 'string') throw new SpotifyError('unavailable');
  return body.access_token;
}

async function timedFetch(deps: Deps, url: string, init: RequestInit): Promise<Response> {
  try {
    return await deps.fetch(url, { ...init, signal: AbortSignal.timeout(deps.timeoutMs ?? 5000) });
  } catch {
    throw new SpotifyError('unavailable');
  }
}

function rateLimited(res: Response): SpotifyError {
  const seconds = Number(res.headers.get('retry-after'));
  return new SpotifyError('rate-limited', Number.isFinite(seconds) && seconds > 0 ? seconds : undefined);
}

async function spotifyGet(deps: Deps, token: string, path: string): Promise<Response> {
  const res = await timedFetch(deps, `${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new SpotifyError('unauthorized');
  if (res.status === 429) throw rateLimited(res);
  if (res.status >= 500) throw new SpotifyError('unavailable');
  return res;
}

export async function getCurrentlyPlaying(deps: Deps, token: string): Promise<PublicTrack | null> {
  const res = await spotifyGet(deps, token, '/me/player/currently-playing');
  // 204 means nothing is playing; any other non-OK answer is treated as "nothing usable".
  if (res.status !== 200) return null;
  const body = (await res.json()) as { is_playing?: unknown; item?: unknown; currently_playing_type?: unknown };
  if (body.is_playing !== true || body.currently_playing_type !== 'track') return null;
  return normalizeTrack(body.item);
}

export async function getRecentlyPlayed(deps: Deps, token: string): Promise<{ track: PublicTrack; playedAt: string } | null> {
  const res = await spotifyGet(deps, token, '/me/player/recently-played?limit=10');
  if (!res.ok) throw new SpotifyError('unavailable');
  const body = (await res.json()) as { items?: { track?: unknown; played_at?: unknown }[] };
  for (const item of body.items ?? []) {
    const track = normalizeTrack(item.track);
    if (track && typeof item.played_at === 'string' && !Number.isNaN(Date.parse(item.played_at))) {
      return { track, playedAt: item.played_at };
    }
  }
  return null;
}

/** Live lookup: currently playing first, then the most recent play. Throws SpotifyError. */
export async function fetchLastPlayed(deps: Deps): Promise<LastPlayed> {
  const token = await fetchAccessToken(deps);
  const updatedAt = deps.now().toISOString();
  const current = await getCurrentlyPlaying(deps, token);
  if (current) return { track: current, isCurrentlyPlaying: true, playedAt: null, updatedAt };
  const recent = await getRecentlyPlayed(deps, token);
  if (!recent) throw new SpotifyError('empty');
  return { track: recent.track, isCurrentlyPlaying: false, playedAt: recent.playedAt, updatedAt };
}

export interface Resolved {
  data: LastPlayed | null;
  /** True when `data` came from the cache because the live lookup failed. */
  stale: boolean;
  error: SpotifyFailure | null;
  retryAfter?: number;
}

/** Live lookup with cache write-through and cache fallback on any failure. */
export async function resolveLastPlayed(deps: Deps): Promise<Resolved> {
  try {
    const data = await fetchLastPlayed(deps);
    // A failed cache write must never break a good live answer.
    await deps.cache?.write(data).catch(() => undefined);
    return { data, stale: false, error: null };
  } catch (err) {
    const kind = err instanceof SpotifyError ? err.kind : 'unavailable';
    const cached = kind === 'not-configured' ? null : await deps.cache?.read().catch(() => null) ?? null;
    return {
      data: cached ? { ...cached, isCurrentlyPlaying: false } : null,
      stale: Boolean(cached),
      error: kind,
      retryAfter: err instanceof SpotifyError ? err.retryAfter : undefined,
    };
  }
}

/** Supabase (PostgREST) backed cache; one row, public track data only. */
export function supabaseCache(env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }, fetchImpl: typeof fetch): Cache | null {
  const base = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const url = `${base}/rest/v1/spotify_cache`;
  return {
    async read() {
      const res = await fetchImpl(`${url}?id=eq.last-played&select=payload`, { headers, signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      const rows = (await res.json()) as { payload?: unknown }[];
      const payload = rows[0]?.payload as LastPlayed | undefined;
      return payload ? normalizeCached(payload) : null;
    },
    async write(value) {
      await fetchImpl(url, {
        method: 'POST',
        headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: 'last-played', payload: value, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(3000),
      });
    },
  };
}

function normalizeCached(p: LastPlayed): LastPlayed | null {
  if (!p?.track || typeof p.track.id !== 'string' || !TRACK_ID.test(p.track.id)) return null;
  return p;
}
