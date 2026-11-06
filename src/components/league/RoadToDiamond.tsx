import type { CSSProperties } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useTileMotion } from '../bento/useTileMotion';
import defaultConfig, { type LeagueConfig } from '../../data/league';
import { relativeTime } from '../spotify/api';
import type { RankView } from '../../league/api';
import { emblemSrc, lpText, progress, rankName, reached, tierMarks, type Rank } from '../../league/rank';
import { useRank } from '../../league/useRank';
import './league.css';

interface Props {
  apiBaseUrl?: string;
  config?: LeagueConfig;
  /** Shows this instead of loading (tests and previews). */
  view?: RankView;
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** One line saying where the rank came from, so cached or hand-entered data is never passed off as live. */
export function sourceText(view: RankView): string {
  switch (view.source) {
    case 'loading': return 'Checking rank…';
    case 'live': return `Live from Riot · ${relativeTime(view.asOf) || 'just now'}`;
    case 'cached': return `Saved rank · Riot last answered ${relativeTime(view.asOf) || 'earlier'}`;
    case 'manual': return `Updated by hand · ${view.asOf ? day(view.asOf) : 'date unknown'}`;
    case 'unranked': return 'No ranked games this season yet';
    default: return 'Rank unavailable right now';
  }
}

/**
 * Road to Diamond: the current emblem inside a ring that fills from Iron IV (empty) to the goal (full), using the
 * same tested ladder formula as before. Small ticks on the ring mark where each tier begins. The whole card links
 * to the account's OP.GG profile.
 */
export default function RoadToDiamond({ apiBaseUrl, config = defaultConfig, view: fixed }: Props) {
  const tileMotion = useTileMotion();
  const fetched = useRank(config, fixed ? undefined : apiBaseUrl);
  const view = fixed ?? fetched;
  const goal: Rank = { ...config.goal, lp: 0 };
  const rank = view.rank;
  const p = rank ? progress(rank, goal) : 0;
  const done = rank ? reached(rank, goal) : false;
  const goalName = rankName(goal);
  const marks = tierMarks(goal).filter((m) => m.at > 0 && m.at < 1);
  const style = { '--p': p } as CSSProperties;
  const pct = Math.round(p * 100);

  return (
    <motion.article {...tileMotion} className={`bento-tile bento-tile--interactive rank-ring${done ? ' is-done' : ''}`} data-source={view.source} style={style} aria-busy={view.source === 'loading'}>
      <h2 className="rank-ring__title">
        <a className="bento-tile__link" href={config.opggUrl} target="_blank" rel="noopener noreferrer">
          Road to Diamond<ArrowUpRight aria-hidden="true" weight="regular" />
          <span className="visually-hidden"> on OP.GG, {config.riotId} (opens in a new tab)</span>
        </a>
      </h2>

      <div className="rank-ring__main">
        <div
          className="rank-ring__dial"
          {...(rank ? { role: 'progressbar', 'aria-label': `Progress to ${goalName}`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-valuetext': `${rankName(rank)}, ${lpText(rank)}: ${done ? 'goal reached' : `${pct}% of the way from Iron IV`}` } : {})}
        >
          <svg className="rank-ring__svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="rank-ring-fill" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#3a5bd9" />
                <stop offset=".55" stopColor="#6f9bff" />
                <stop offset="1" stopColor="#5ee7ff" />
              </linearGradient>
            </defs>
            <circle className="rank-ring__track" cx="60" cy="60" r="52" />
            <circle className="rank-ring__fill" cx="60" cy="60" r="52" pathLength={100} stroke="url(#rank-ring-fill)" />
            {marks.map((m) => <line key={m.tier} className="rank-ring__tick" x1="60" y1="3" x2="60" y2="11" transform={`rotate(${m.at * 360} 60 60)`} />)}
          </svg>
          {rank && <img className="rank-ring__emblem" src={emblemSrc(rank.tier)} alt="" width="96" height="96" />}
        </div>

        <div className="rank-ring__text">
          {rank ? (
            <p className="rank-ring__rank"><strong>{rankName(rank)}</strong><span>{lpText(rank)}</span></p>
          ) : (
            <p className="rank-ring__rank rank-ring__rank--empty"><strong>{view.source === 'loading' ? 'Loading…' : view.source === 'unranked' ? 'Unranked' : 'No rank to show'}</strong></p>
          )}
          <p className="rank-ring__goal">{done ? `Goal reached · ${goalName}` : rank ? `${pct}% to ${goalName}` : `Goal · ${goalName}`}</p>
          <p className="rank-ring__source" role="status">{sourceText(view)}</p>
        </div>
      </div>
    </motion.article>
  );
}
