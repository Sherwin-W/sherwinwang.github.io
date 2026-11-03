import { useCallback, useEffect, useRef, useState } from 'react';
import { FetchError, fetchLastPlayed, readCached, writeCached } from './api';
import type { LastPlayedData } from './types';

export type LoadState = 'loading' | 'ready' | 'error';

const REFRESH_MS = 45_000;

export function useLastPlayed(baseUrl: string) {
  const [data, setData] = useState<LastPlayedData | null>(() => readCached());
  const [state, setState] = useState<LoadState>(data ? 'ready' : 'loading');
  const [error, setError] = useState<number | null>(null);
  const [fromBrowserCache, setFromBrowserCache] = useState(data !== null);
  const inflight = useRef<AbortController | null>(null);
  const visible = useRef(true);

  const load = useCallback(async () => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      const next = await fetchLastPlayed(baseUrl, ctrl.signal);
      setData(next);
      setFromBrowserCache(false);
      setError(null);
      setState('ready');
      writeCached(next);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof FetchError ? err.status : null);
      // Keep showing whatever we last had; only show the error state when we have nothing.
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

  return { data, state, error, fromBrowserCache, retry: load };
}
