import { useState, type CSSProperties } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { useTileMotion } from '../bento/useTileMotion';
import defaultConfig, { type LeagueConfig } from '../../data/league';
import { relativeTime } from '../spotify/api';
import type { Champion, RankView } from '../../league/api';
import { emblemSrc, lpText, progress, rankName, reached, tierMarks, tierName, type Rank } from '../../league/rank';
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

/** A small round portrait of the last champion played, beside the LP on the rank label. Hidden if it fails to load. */
function ChampionBubble({ champion }: { champion: Champion }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === champion.icon) return null;
  const when = relativeTime(champion.playedAt);
  return (
    <img
      className="rank-rail__champ"
      src={champion.icon}
      alt={`Last played: ${champion.name}${when ? `, ${when}` : ''}`}
      width="18"
      height="18"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(champion.icon)}
    />
  );
}

/**
 * Road to Diamond: a slim ladder from Iron to the goal tier, filled up to the current rank. The whole card
 * links to the account's OP.GG profile. Narrow screens lay the same ladder out horizontally (CSS only).
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
  // Only Riot's answer carries a champion; a hand-entered rank never shows one.
  const champion = view.source === 'live' || view.source === 'cached' ? view.champion : null;

  return (
    <motion.article {...tileMotion} className={`bento-tile bento-tile--interactive rank-rail${done ? ' is-done' : ''}`} data-source={view.source} style={style} aria-busy={view.source === 'loading'}>
      <div className="rank-rail__top">
        <h2 className="rank-rail__title">
          <a className="bento-tile__link" href={config.opggUrl} target="_blank" rel="noopener noreferrer">
            Road to {tierName(goal.tier)}<ArrowUpRight aria-hidden="true" weight="regular" />
            <span className="visually-hidden"> on OP.GG, {config.riotId} (opens in a new tab)</span>
          </a>
        </h2>
        <img className="rank-rail__emblem rank-rail__emblem--goal" src={emblemSrc(goal.tier)} alt="" width="96" height="96" />
        <span className="rank-rail__cap">{done ? 'Goal reached' : 'Goal'}<span className="rank-rail__cap-tier"> · {goalName}</span></span>
      </div>

      <div className="rank-rail__ladder">
        <ol className="rank-rail__marks" aria-hidden="true">
          {marks.map((m) => <li key={m.tier} style={{ '--at': m.at } as CSSProperties}><span>{tierName(m.tier)}</span></li>)}
        </ol>
        <div
          className="rank-rail__track"
          {...(rank ? { role: 'progressbar', 'aria-label': `Progress to ${goalName}`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-valuetext': `${rankName(rank)}, ${lpText(rank)}: ${done ? 'goal reached' : `${pct}% of the way from Iron IV`}` } : {})}
        >
          <span className="rank-rail__fill" />
        </div>
        {rank ? (
          <div className="rank-rail__marker">
            <img className="rank-rail__emblem rank-rail__emblem--now" src={emblemSrc(rank.tier)} alt="" width="96" height="96" />
            <p className="rank-rail__now"><strong>{rankName(rank)}</strong><span className="rank-rail__sub"><span>{lpText(rank)}</span>{champion && <ChampionBubble champion={champion} />}</span></p>
          </div>
        ) : (
          <p className="rank-rail__empty">{view.source === 'loading' ? 'Loading…' : view.source === 'unranked' ? 'Unranked' : 'No rank to show'}</p>
        )}
      </div>

      <div className="rank-rail__bottom">
        <img className="rank-rail__emblem rank-rail__emblem--start" src={emblemSrc('IRON')} alt="" width="96" height="96" />
        <span className="rank-rail__cap">Start<span className="rank-rail__cap-tier"> · Iron</span></span>
        <span className="rank-rail__id">{config.riotId}</span>
        <p className="rank-rail__source" role="status">{sourceText(view)}</p>
      </div>
    </motion.article>
  );
}
