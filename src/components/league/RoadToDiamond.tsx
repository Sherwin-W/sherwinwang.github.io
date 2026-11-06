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

/** Gauge geometry (SVG user units): a half circle from bottom-left to bottom-right over the centre. */
const ARC = 'M24 100 A76 76 0 0 1 176 100';

type ShownChampion = Champion & { manual: boolean };

/** Riot's answer when it has one; otherwise the hand-entered champion from the config, labelled as such. */
function championFor(view: RankView, config: LeagueConfig): ShownChampion | null {
  if ((view.source === 'live' || view.source === 'cached' || view.source === 'unranked') && view.champion) return { ...view.champion, manual: false };
  if (view.source === 'loading' || !config.manualChampion) return null;
  const m = config.manualChampion;
  return { name: m.name, icon: `https://ddragon.leagueoflegends.com/cdn/${m.version}/img/champion/${m.ddragonId}.png`, playedAt: null, manual: true };
}

/** The last ranked Solo/Duo champion: a small portrait, a label and the name. Hidden if the image fails. */
function LastChampion({ champion }: { champion: ShownChampion }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === champion.icon) return null;
  const when = champion.manual ? '' : relativeTime(champion.playedAt);
  return (
    <div className="rank-champ" title={when ? `Played ${when}` : undefined}>
      <img className="rank-champ__img" src={champion.icon} alt="" width="120" height="120" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(champion.icon)} />
      <p className="rank-champ__text">
        <span className="rank-champ__label">{champion.manual ? 'Last ranked · set by hand' : 'Last ranked champion'}</span>
        <strong className="rank-champ__name">{champion.name}</strong>
      </p>
    </div>
  );
}

/**
 * Road to Diamond: a semicircle gauge that fills left to right from Iron IV to the goal, using the tested ladder
 * formula in league/rank.ts. The current emblem and overall percentage sit inside the arc, with the Iron and goal
 * emblems under its two ends. The whole card links to the account's OP.GG profile.
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
  const champion = championFor(view, config);

  return (
    <motion.article {...tileMotion} className={`bento-tile bento-tile--interactive rank-gauge${done ? ' is-done' : ''}${p > 0 ? '' : ' is-empty'}`} data-source={view.source} style={style} aria-busy={view.source === 'loading'}>
      <h2 className="rank-gauge__title">
        <a className="bento-tile__link" href={config.opggUrl} target="_blank" rel="noopener noreferrer">
          Road to {tierName(goal.tier)}<ArrowUpRight aria-hidden="true" weight="regular" />
          <span className="visually-hidden"> on OP.GG, {config.riotId} (opens in a new tab)</span>
        </a>
      </h2>

      <div className="rank-gauge__main">
        <div className="rank-gauge__meter">
          <div
            className="rank-gauge__dial"
            {...(rank ? { role: 'progressbar', 'aria-label': `Progress to ${goalName}`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-valuetext': `${rankName(rank)}, ${lpText(rank)}: ${done ? 'goal reached' : `${pct}% of the way from Iron IV`}` } : {})}
          >
            <svg className="rank-gauge__svg" viewBox="0 0 200 112" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="rank-gauge-fill" x1="24" y1="0" x2="176" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#3a5bd9" />
                  <stop offset=".55" stopColor="#6f9bff" />
                  <stop offset="1" stopColor="#5ee7ff" />
                </linearGradient>
              </defs>
              <path className="rank-gauge__track" d={ARC} pathLength={100} />
              <path className="rank-gauge__fill" d={ARC} pathLength={100} stroke="url(#rank-gauge-fill)" />
              {marks.map((m) => {
                // Tier boundaries as small notches just outside the arc.
                const a = Math.PI * (1 - m.at);
                const [x1, y1, x2, y2] = [100 + 84 * Math.cos(a), 100 - 84 * Math.sin(a), 100 + 89 * Math.cos(a), 100 - 89 * Math.sin(a)];
                return <line key={m.tier} className="rank-gauge__tick" x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)} />;
              })}
            </svg>
            <div className="rank-gauge__center">
              {rank && <img className="rank-gauge__emblem" src={emblemSrc(rank.tier)} alt="" width="96" height="96" />}
              <span className="rank-gauge__pct" aria-hidden="true">{rank ? `${pct}%` : '–'}</span>
            </div>
          </div>
          <div className="rank-gauge__ends" aria-hidden="true">
            <span className="rank-gauge__end rank-gauge__end--start"><img src={emblemSrc('IRON')} alt="" width="96" height="96" />Iron</span>
            <span className="rank-gauge__end rank-gauge__end--goal"><img src={emblemSrc(goal.tier)} alt="" width="96" height="96" />{tierName(goal.tier)}</span>
          </div>
        </div>

        <div className="rank-gauge__text">
          {rank ? (
            <p className="rank-gauge__rank"><strong>{rankName(rank)}</strong><span>{lpText(rank)}</span></p>
          ) : (
            <p className="rank-gauge__rank"><strong>{view.source === 'loading' ? 'Loading…' : view.source === 'unranked' ? 'Unranked' : 'No rank to show'}</strong></p>
          )}
          {done && <p className="rank-gauge__goal">Goal reached · {goalName}</p>}
          {champion && <LastChampion champion={champion} />}
          <p className="rank-gauge__source" role="status">{sourceText(view)}</p>
        </div>
      </div>
    </motion.article>
  );
}
