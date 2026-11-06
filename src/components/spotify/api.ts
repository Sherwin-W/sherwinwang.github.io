import type { LastPlayedData } from './types';

const TRACK_ID = /^[A-Za-z0-9]{22}$/;

/** Validates untrusted JSON. Links are rebuilt from the track id, never taken as given. */
export function parseLastPlayed(raw: unknown): LastPlayedData | null {
  const r = raw as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const t = r?.track;
  if (!t || typeof t.id !== 'string' || !TRACK_ID.test(t.id) || typeof t.title !== 'string') return null;
  const art = typeof t.albumArt === 'string' && /^https:\/\/i\.scdn\.co\//.test(t.albumArt) ? t.albumArt : null;
  return {
    track: {
      id: t.id,
      title: t.title,
      artists: Array.isArray(t.artists) ? t.artists.filter((a: unknown): a is string => typeof a === 'string') : [],
      album: typeof t.album === 'string' ? t.album : '',
      albumArt: art,
      spotifyUrl: `https://open.spotify.com/track/${t.id}`,
      embedUrl: `https://open.spotify.com/embed/track/${t.id}`,
      durationMs: typeof t.durationMs === 'number' && Number.isFinite(t.durationMs) && t.durationMs > 0 && t.durationMs < 36_000_000 ? Math.round(t.durationMs) : null,
    },
    isCurrentlyPlaying: r.isCurrentlyPlaying === true,
    playedAt: typeof r.playedAt === 'string' && !Number.isNaN(Date.parse(r.playedAt)) ? r.playedAt : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
    stale: r.stale === true,
    retryAfter: waitSeconds(r.retryAfter),
  };
}

/** A positive whole number of seconds, capped at an hour; anything else means "no instruction". */
export function waitSeconds(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.ceil(n), 3600) : null;
}

export class FetchError extends Error {
  constructor(public readonly status: number | null, public readonly retryAfter: number | null = null) { super(`spotify ${status ?? 'network'}`); }
}

export async function fetchLastPlayed(baseUrl: string, signal?: AbortSignal): Promise<LastPlayedData> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/spotify/last-played`, { signal, headers: { accept: 'application/json' } });
  } catch {
    throw new FetchError(null);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { retryAfter?: unknown } | null;
    throw new FetchError(res.status, waitSeconds(res.headers.get('retry-after')) ?? waitSeconds(body?.retryAfter));
  }
  const data = parseLastPlayed(await res.json().catch(() => null));
  if (!data) throw new FetchError(502);
  return data;
}

const CACHE_KEY = 'spotify-last-played';

export function readCached(): LastPlayedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseLastPlayed(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function writeCached(data: LastPlayedData): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, retryAfter: null })); } catch { /* storage unavailable */ }
}

/**
 * The track is kept, but "now listening" is no longer known to be true: show it as a saved track.
 * When it was playing, the time we last saw it playing stands in for "played at".
 */
export function unverified(d: LastPlayedData): LastPlayedData {
  return { ...d, isCurrentlyPlaying: false, playedAt: d.playedAt ?? (d.isCurrentlyPlaying && d.updatedAt ? d.updatedAt : null), stale: true };
}

export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** 266773 -> "4:27". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
