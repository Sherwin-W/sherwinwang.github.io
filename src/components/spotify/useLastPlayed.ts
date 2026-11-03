import { useCallback, useEffect, useRef, useState } from 'react';
import { FetchError, fetchLastPlayed, readCached, unverified, writeCached } from './api';
import type { LastPlayedData } from './types';

export type LoadState = 'loading' | 'ready' | 'error';

const REFRESH_MS = 45_000;

export function useLastPlayed(baseUrl: string) {
  // A track restored from this browser is shown as saved (never as "now listening") until the API confirms it.
  const [data, setData] = useState<LastPlayedData | null>(() => { const c = readCached(); return c ? unverified(c) : null; });
  const [state, setState] = useState<LoadState>(data ? 'ready' : 'loading');
  const [error, setError] = useState<number | null>(null);
  const [waitUntil, setWaitUntil] = useState(0);
  const inflight = useRef<AbortController | null>(null);
  const visible = useRef(true);
  /** No requests before this time: the server relayed a rate-limit wait. */
  const pausedUntil = useRef(0);

  const pause = (seconds: number | null | undefined) => {
    if (!seconds) return;
    pausedUntil.current = Date.now() + seconds * 1000;
    setWaitUntil(pausedUntil.current);
  };

  const load = useCallback(async () => {
    if (Date.now() < pausedUntil.current) return;
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      const next = await fetchLastPlayed(baseUrl, ctrl.signal);
      pause(next.retryAfter);
      setData(next);
      setError(null);
      setState('ready');
      writeCached(next);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof FetchError ? err.status : null);
      if (err instanceof FetchError) pause(err.retryAfter);
      // Keep the track, but a failed refresh means "now listening" can no longer be claimed.
      setData((prev) => (prev ? unverified(prev) : prev));
      setState((prev) => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, [baseUrl]);

  useEffect(() => {
    const tick = () => { if (visible.current && document.visibilityState === 'visible') void load(); };
    void load();
    const timer = window.setInterval(tick, REFRESH_MS);
    const onVisibility = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisibility);
    // Pause polling while the tile is scrolled off-screen.
    const el = document.querySelector('[data-spotify-tile]');
    const io = el && 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; if (entry.isIntersecting) void load(); })
      : null;
    if (el && io) io.observe(el);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      io?.disconnect();
      inflight.current?.abort();
    };
  }, [load]);

  return { data, state, error, waitUntil, retry: load };
}
