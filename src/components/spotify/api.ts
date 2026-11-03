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
    },
    isCurrentlyPlaying: r.isCurrentlyPlaying === true,
    playedAt: typeof r.playedAt === 'string' && !Number.isNaN(Date.parse(r.playedAt)) ? r.playedAt : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
    stale: r.stale === true,
  };
}

export class FetchError extends Error {
  constructor(public readonly status: number | null) { super(`spotify ${status ?? 'network'}`); }
}

export async function fetchLastPlayed(baseUrl: string, signal?: AbortSignal): Promise<LastPlayedData> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/spotify/last-played`, { signal, headers: { accept: 'application/json' } });
  } catch {
    throw new FetchError(null);
  }
  if (!res.ok) throw new FetchError(res.status);
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
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
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
