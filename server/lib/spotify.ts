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
  /** The public last-played track (the only row ever returned to visitors). */
  read(): Promise<LastPlayed | null>;
  write(value: LastPlayed): Promise<void>;
  /** Private server state rows: the rate-limit cooldown and the (encrypted) rotated refresh token. */
  readState?(key: StateKey): Promise<unknown>;
  writeState?(key: StateKey, value: unknown): Promise<void>;
}

export type StateKey = 'cooldown' | 'auth';

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
  /** In-memory copy of the cooldown for a warm instance (the cache row is the shared copy). */
  memo?: { cooldownUntil: number };
}

/** Used when Spotify answers 429 without a usable Retry-After. */
export const DEFAULT_RETRY_AFTER = 30;

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

/**
 * Exchanges the refresh token for an access token. Spotify may hand back a replacement refresh token;
 * it is kept (encrypted) in the private state row and preferred from then on, as long as it was issued for
 * the refresh token currently in the environment. If the stored token is rejected, the env token is tried.
 */
export async function fetchAccessToken(deps: Deps): Promise<string> {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: envRefresh } = deps.env;
  if (!id || !secret || !envRefresh) throw new SpotifyError('not-configured');
  const rotated = await loadRotatedToken(deps, secret, envRefresh).catch(() => null);
  const candidates = rotated && rotated !== envRefresh ? [rotated, envRefresh] : [envRefresh];
  for (let i = 0; i < candidates.length; i++) {
    const refresh = candidates[i];
    const res = await timedFetch(deps, TOKEN_URL, {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${id}:${secret}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
    });
    if (res.status === 400 || res.status === 401) {
      if (i < candidates.length - 1) continue; // stored token rejected: fall back to the env token
      throw new SpotifyError('unauthorized');
    }
    if (res.status === 429) throw rateLimited(res);
    if (!res.ok) throw new SpotifyError('unavailable');
    const body = (await res.json()) as { access_token?: unknown; refresh_token?: unknown };
    if (typeof body.access_token !== 'string') throw new SpotifyError('unavailable');
    if (typeof body.refresh_token === 'string' && body.refresh_token && body.refresh_token !== refresh) {
      // A failed save must not break this request; the next refresh can still use the old token.
      await saveRotatedToken(deps, secret, envRefresh, body.refresh_token).catch(() => undefined);
    }
    return body.access_token;
  }
  throw new SpotifyError('unauthorized');
}

// ---------- Rotated refresh token store (AES-GCM, key derived from the client secret) ----------

interface StoredAuth { v: 1; iv: string; data: string; envHash: string }

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string): Uint8Array<ArrayBuffer> => new Uint8Array([...atob(text)].map((c) => c.charCodeAt(0)));

async function sha256(text: string): Promise<string> {
  return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))));
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`portfolio-spotify-token-store:${secret}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function saveRotatedToken(deps: Deps, secret: string, envRefresh: string, token: string): Promise<void> {
  if (!deps.cache?.writeState) return;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), new TextEncoder().encode(token)));
  const stored: StoredAuth = { v: 1, iv: b64(iv), data: b64(data), envHash: await sha256(envRefresh) };
  await deps.cache.writeState('auth', stored);
}

/** The rotated token, only if it descends from the env token in use (a fresh re-authorization wins). */
async function loadRotatedToken(deps: Deps, secret: string, envRefresh: string): Promise<string | null> {
  const s = (await deps.cache?.readState?.('auth')) as StoredAuth | null | undefined;
  if (!s || s.v !== 1 || typeof s.iv !== 'string' || typeof s.data !== 'string') return null;
  if (s.envHash !== (await sha256(envRefresh))) return null;
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, await aesKey(secret), unb64(s.data));
  return new TextDecoder().decode(plain);
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
  return new SpotifyError('rate-limited', Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined);
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
  /** True when `data` came from the cache because the live lookup failed or was skipped. */
  stale: boolean;
  error: SpotifyFailure | null;
  /** Seconds until Spotify may be asked again (rate limit cooldown). */
  retryAfter?: number;
}

/** When the current cooldown ends (ms since epoch), from memory or the shared state row. */
async function cooldownUntil(deps: Deps): Promise<number> {
  const memo = deps.memo?.cooldownUntil ?? 0;
  const shared = (await deps.cache?.readState?.('cooldown').catch(() => null)) as { until?: unknown } | null | undefined;
  const stored = typeof shared?.until === 'string' ? Date.parse(shared.until) : 0;
  return Math.max(memo, Number.isFinite(stored) ? stored : 0);
}

async function fallback(deps: Deps, error: SpotifyFailure, retryAfter?: number): Promise<Resolved> {
  const cached = error === 'not-configured' ? null : await deps.cache?.read().catch(() => null) ?? null;
  return {
    // A cached track is never presented as playing right now.
    data: cached ? { ...cached, isCurrentlyPlaying: false } : null,
    stale: Boolean(cached),
    error,
    retryAfter,
  };
}

/**
 * Live lookup with cache write-through and cache fallback on any failure. While a rate-limit cooldown is
 * running, Spotify is not called at all: the cached track is served with the remaining wait.
 */
export async function resolveLastPlayed(deps: Deps): Promise<Resolved> {
  const nowMs = deps.now().getTime();
  const until = await cooldownUntil(deps);
  if (until > nowMs) return fallback(deps, 'rate-limited', Math.max(1, Math.ceil((until - nowMs) / 1000)));
  try {
    const data = await fetchLastPlayed(deps);
    // A failed cache write must never break a good live answer.
    await deps.cache?.write(data).catch(() => undefined);
    return { data, stale: false, error: null };
  } catch (err) {
    const kind = err instanceof SpotifyError ? err.kind : 'unavailable';
    if (kind === 'rate-limited') {
      const wait = (err as SpotifyError).retryAfter ?? DEFAULT_RETRY_AFTER;
      const end = nowMs + wait * 1000;
      if (deps.memo) deps.memo.cooldownUntil = end;
      await deps.cache?.writeState?.('cooldown', { until: new Date(end).toISOString() }).catch(() => undefined);
      return fallback(deps, kind, wait);
    }
    return fallback(deps, kind);
  }
}

/**
 * Supabase (PostgREST) backed store. Row `last-played` holds public track data only; rows `cooldown` and
 * `auth` are private server state (the table has RLS on and no policies, so only this service key reads it,
 * and the endpoint only ever returns the `last-played` row).
 */
export function supabaseCache(env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }, fetchImpl: typeof fetch): Cache | null {
  const base = env.SUPABASE_URL?.replace(/\/$/, '').replace(/\/rest\/v1$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  // New secret keys (sb_secret_…) go in `apikey` only; legacy JWT service_role keys also need the bearer header.
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' };
  if (key.startsWith('eyJ')) headers.authorization = `Bearer ${key}`;
  const url = `${base}/rest/v1/spotify_cache`;
  const readRow = async (id: string): Promise<unknown> => {
    const res = await fetchImpl(`${url}?id=eq.${id}&select=payload`, { headers, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const rows = (await res.json()) as { payload?: unknown }[];
    return rows[0]?.payload ?? null;
  };
  const writeRow = async (id: string, payload: unknown): Promise<void> => {
    await fetchImpl(url, {
      method: 'POST',
      headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(3000),
    });
  };
  return {
    async read() {
      const payload = (await readRow('last-played')) as LastPlayed | null;
      return payload ? normalizeCached(payload) : null;
    },
    write: (value) => writeRow('last-played', value),
    readState: (k) => readRow(k),
    writeState: (k, value) => writeRow(k, value),
  };
}

function normalizeCached(p: LastPlayed): LastPlayed | null {
  if (!p?.track || typeof p.track.id !== 'string' || !TRACK_ID.test(p.track.id)) return null;
  return p;
}
