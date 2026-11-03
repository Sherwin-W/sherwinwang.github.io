import { useEffect, useRef } from 'react';
import { pct } from '../engine/stats';
import { COIN } from './pixelArt';
import PixelIcon from './PixelIcon';
import { decisionsTally, DIFFICULTIES, drillsFor, gradeOf, runScore, type Difficulty, type RunStats } from './run';

interface Props { difficulty: Difficulty; stats: RunStats; exposed: number; total: number; best: string | null; onAgain: () => void; onBrief: () => void }

const KIND: Record<string, string> = { decision: 'Strategy', insurance: 'Insurance', count: 'Count', trueCount: 'True count', wager: 'Wager', aces: 'Aces' };

export default function RunReport({ difficulty, stats: s, exposed, total, best, onAgain, onBrief }: Props) {
  const score = runScore(s);
  const grade = gradeOf(score);
  const d = DIFFICULTIES[difficulty];
  const counting = d.system !== null;
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h.current?.focus(); }, []);
  const drills = drillsFor(s);
  const row = (label: string, t: { right: number; total: number }) => (
    <tr><th scope="row">{label}</th><td>{t.right}/{t.total}</td><td>{pct(t)}</td></tr>
  );
  return (
    <section className="px-report" aria-labelledby="px-report-h">
      <div className="px-banner" aria-hidden="true">SHOE CLEARED</div>
      <h2 id="px-report-h" className="px-h px-h--lg" tabIndex={-1} ref={h}>After-action report · {d.name}</h2>
      <div className="px-report__top">
        <p className={`px-grade is-${grade}`} aria-label={`Grade ${grade}, score ${score} out of 100`}>{grade}</p>
        <ul className="px-report__facts">
          <li><strong>{score}</strong> / 100 execution score</li>
          <li>{exposed}/{total} cards exposed · {s.rounds} rounds</li>
          <li>Peak flow {s.flowPeak}</li>
          <li><PixelIcon bitmap={COIN} color="var(--px-gold)" scale={2} /> {s.coins} coins collected ({s.goldCoins} golden), {s.coinsSpent} spent (cosmetic)</li>
          <li>Dealer advice: {s.hintsFree} free, {s.hintsPaid} paid · {s.assisted} advised decisions</li>
          {best && <li>Best {d.name} grade before this run: {best}</li>}
        </ul>
      </div>
      <table className="px-table">
        <caption>Accuracy</caption>
        <thead><tr><th scope="col">Skill</th><th scope="col">Right</th><th scope="col">%</th></tr></thead>
        <tbody>
          {row('Strategy decisions', decisionsTally(s))}
          {row('· hard', s.decisions.hard)}
          {row('· soft', s.decisions.soft)}
          {row('· pairs', s.decisions.pair)}
          {s.insurance.total > 0 && row('· insurance', s.insurance)}
          {counting && row('Running count', s.counts)}
          {counting && row('True count', s.trueCounts)}
          {counting && row('Wagers on schedule', s.wagers)}
          {s.aces.total > 0 && row('Ace side count', s.aces)}
        </tbody>
      </table>
      <p className="px-tiny">Score weights: decisions 50%, running count 25%, true count 10%, wagers 10%, aces 5%; skills you did not attempt are left out. Virtual units ({s.net > 0 ? '+' : ''}{s.net}) are luck and do not count.</p>

      {s.mistakes.length > 0 && (
        <>
          <h3 className="px-h">Mistakes ({s.mistakes.length})</h3>
          <ol className="px-mistakes">
            {s.mistakes.slice(0, 15).map((m, i) => (
              <li key={i}><span className="px-tag">{KIND[m.kind]} · R{m.round}</span> <strong>{m.title}</strong> <span className="px-dim">{m.detail}</span></li>
            ))}
          </ol>
          {s.mistakes.length > 15 && <p className="px-tiny">…and {s.mistakes.length - 15} more.</p>}
        </>
      )}
      <h3 className="px-h">Next drills</h3>
      {drills.length ? <ul className="px-list">{drills.map((x) => <li key={x}>{x}</li>)}</ul> : <p>No weak spot stands out. Try the next difficulty.</p>}
      <div className="px-actions">
        <button type="button" className="px-btn px-btn--primary" onClick={onAgain}>New shoe</button>
        <button type="button" className="px-btn" onClick={onBrief}>Change difficulty</button>
      </div>
    </section>
  );
}
