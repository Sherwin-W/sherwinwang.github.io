import { useRef, useState } from 'react';
import { mulberry32, randomSeed } from '../engine/rng';
import { countSequence, trayQuestion, trueCountQuestion } from '../engine/drills';
import { hiLoValue } from '../engine/cards';
import { trueCountScored } from '../engine/count';
import { pct, recordDeckEstimate, recordTrueCount } from '../engine/stats';
import PlayingCard from './PlayingCard';
import type { ProgressApi } from './useProgress';

type Level = 1 | 2 | 3;

/** Discard tray: the filled part is what has been dealt, the rest is what is left in the shoe. */
function Tray({ decks, remaining }: { decks: number; remaining: number }) {
  const total = decks * 52;
  const dealtPct = Math.round(((total - remaining) / total) * 100);
  return (
    <div className="bj-tray" role="img" aria-label={`Shoe diagram: about ${dealtPct}% of a ${decks}-deck shoe is in the discard tray`}>
      <span className="bj-tray__dealt" style={{ width: `${dealtPct}%` }} />
      <span className="bj-tray__ticks" aria-hidden="true">{Array.from({ length: decks - 1 }, (_, k) => <i key={k} style={{ left: `${((k + 1) / decks) * 100}%` }} />)}</span>
    </div>
  );
}

export default function TrueCountDrill({ api }: { api: ProgressApi }) {
  const rng = useRef(mulberry32(randomSeed()));
  const [level, setLevel] = useState<Level>(1);
  const [q, setQ] = useState(() => trueCountQuestion(rng.current));
  const [seq, setSeq] = useState(() => countSequence(rng.current, 10));
  const [tray, setTray] = useState(() => trayQuestion(rng.current, 6));
  const [entry, setEntry] = useState('');
  const [entry2, setEntry2] = useState('');
  const [msg, setMsg] = useState('');

  const fresh = (l: Level) => { setLevel(l); setQ(trueCountQuestion(rng.current)); setSeq(countSequence(rng.current, 10)); setTray(trayQuestion(rng.current, 6)); setEntry(''); setEntry2(''); setMsg(''); };
  const again = () => fresh(level);

  const submit1 = () => {
    const g = Number(entry); if (entry.trim() === '' || Number.isNaN(g)) return;
    const ok = g === q.answer;
    api.update((p) => recordTrueCount(p, ok));
    setMsg(ok ? `Correct. ${q.running} ÷ ${q.decks} = ${(q.running / q.decks).toFixed(2)}, which truncates to ${q.answer}.` : `Not quite: ${q.running} ÷ ${q.decks} = ${(q.running / q.decks).toFixed(2)}, which truncates toward zero to ${q.answer}.`);
  };
  const seqCount = seq.reduce((n, x) => n + hiLoValue(x.card.rank), 0);
  const submit2 = () => {
    const rc = Number(entry), tc = Number(entry2);
    if (entry.trim() === '' || entry2.trim() === '' || Number.isNaN(rc) || Number.isNaN(tc)) return;
    const decks = q.decks; const trueTc = trueCountScored(seqCount, decks);
    const rcOk = rc === seqCount; const tcOk = tc === trueTc;
    api.update((p) => recordTrueCount(p, tcOk && rcOk));
    setMsg(`Running count ${seqCount} (you said ${rc}); with ${decks} decks left the true count is ${trueTc} (you said ${tc}).`);
  };
  const submit3 = () => {
    const g = Number(entry); if (entry.trim() === '' || Number.isNaN(g)) return;
    const error = g - tray.remaining / 52;
    const ok = Math.abs(g - tray.answer) <= 0.5;
    api.update((p) => recordDeckEstimate(p, error));
    setMsg(`${ok ? 'Good estimate.' : 'A little off.'} About ${(tray.remaining / 52).toFixed(2)} decks remain (rounds to ${tray.answer}); you said ${g}. Aim to be within half a deck.`);
  };

  const t = api.progress;
  return (
    <section className="bj-drill" aria-labelledby="bj-tc-h">
      <h3 id="bj-tc-h">True count drill</h3>
      <p>True count = running count ÷ decks remaining. We estimate decks in half-deck steps and drop the fraction toward zero, so +8 over 4 decks is +2 and +7 over 4 decks is +1.</p>
      <div className="px-tabs px-tabs--sub" role="group" aria-label="Drill level">
        <button type="button" aria-pressed={level === 1} onClick={() => fresh(1)}>1 · Calculate</button>
        <button type="button" aria-pressed={level === 2} onClick={() => fresh(2)}>2 · Count then convert</button>
        <button type="button" aria-pressed={level === 3} onClick={() => fresh(3)}>3 · Estimate decks</button>
      </div>

      {level === 1 && (
        <form className="bj-drill__stage" onSubmit={(e) => { e.preventDefault(); submit1(); }}>
          <p className="bj-big">Running count {q.running > 0 ? '+' : ''}{q.running}, {q.decks} {q.decks === 1 ? 'deck' : 'decks'} remaining.</p>
          <label className="bj-label" htmlFor="bj-tc">True count?</label>
          <input id="bj-tc" className="px-input" inputMode="numeric" value={entry} onChange={(e) => setEntry(e.target.value)} />
          <button type="submit" className="px-btn px-btn--primary" disabled={msg !== ''}>Check</button>
        </form>
      )}
      {level === 2 && (
        <form className="bj-drill__stage" onSubmit={(e) => { e.preventDefault(); submit2(); }}>
          <p className="bj-label">Count these cards (start at 0), then convert with {q.decks} {q.decks === 1 ? 'deck' : 'decks'} remaining.</p>
          <div className="bj-hand bj-hand--wrap">{seq.map((x, k) => <PlayingCard key={k} card={x.card} small />)}</div>
          <label className="bj-label" htmlFor="bj-rc2">Running count</label>
          <input id="bj-rc2" className="px-input" inputMode="numeric" value={entry} onChange={(e) => setEntry(e.target.value)} />
          <label className="bj-label" htmlFor="bj-tc2">True count</label>
          <input id="bj-tc2" className="px-input" inputMode="numeric" value={entry2} onChange={(e) => setEntry2(e.target.value)} />
          <button type="submit" className="px-btn px-btn--primary" disabled={msg !== ''}>Check</button>
        </form>
      )}
      {level === 3 && (
        <form className="bj-drill__stage" onSubmit={(e) => { e.preventDefault(); submit3(); }}>
          <p className="bj-label">A 6-deck shoe. The dark part is the discard tray; each tick is one deck. About how many decks are still in the shoe?</p>
          <Tray decks={6} remaining={tray.remaining} />
          <label className="bj-label" htmlFor="bj-d">Decks remaining</label>
          <input id="bj-d" className="px-input" inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} />
          <button type="submit" className="px-btn px-btn--primary" disabled={msg !== ''}>Check</button>
        </form>
      )}
      <p className="bj-feedback" role="status" aria-live="polite">{msg}</p>
      {msg && <button type="button" className="px-btn" onClick={again}>Next</button>}
      <p className="bj-stats">True-count accuracy {pct(t.trueCount)} · Average deck-estimate error {t.deckEstimate.count ? (t.deckEstimate.absError / t.deckEstimate.count).toFixed(2) : 'n/a'} decks</p>
    </section>
  );
}
