import { useEffect, useState } from 'react';
import type { LeagueConfig } from '../data/league';
import { LOADING, manualView, resolveRank, type RankView } from './api';

/** The rank to show. Asks the API once on load, then at most every `refreshMinutes` while the tab is visible. */
export function useRank(config: LeagueConfig, baseUrl: string | undefined): RankView {
  const live = config.mode === 'live' && Boolean(baseUrl);
  const [view, setView] = useState<RankView>(() => (live ? LOADING : manualView(config)));

  useEffect(() => {
    if (!live) return undefined;
    const ctrl = new AbortController();
    const load = () => resolveRank(config, baseUrl, ctrl.signal).then((next) => { if (!ctrl.signal.aborted) setView(next); });
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, Math.max(5, config.refreshMinutes) * 60_000);
    return () => { ctrl.abort(); window.clearInterval(timer); };
  }, [config, baseUrl, live]);

  return view;
}
