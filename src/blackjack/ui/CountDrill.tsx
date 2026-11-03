import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hiLoValue, type HiLoCategory } from '../engine/cards';
import { countSequence, type CountItem } from '../engine/drills';
import { mulberry32, randomSeed } from '../engine/rng';
import { pct, recordClassify, recordRunningCount } from '../engine/stats';
import HiLoLegend from './HiLoLegend';
import PlayingCard, { type Assist } from './PlayingCard';
import type { ProgressApi } from './useProgress';

type Level = 'guided' | 'color' | 'cards' | 'speed';
const LEVELS: { id: Level; name: string; blurb: string }[] = [
  { id: 'guided', name: '1 · Guided', blurb: 'Each card shows its color, marker and value. Tap the matching count.' },
  { id: 'color', name: '2 · Color only', blurb: 'The color and marker stay, the numbers go.' },
  { id: 'cards', name: '3 · Cards only', blurb: 'Just the cards. Decide each one yourself.' },
  { id: 'speed', name: '4 · Speed', blurb: 'Cards flash by. Keep the running count in your head; it will ask for it.' },
];
const assistFor = (l: Level): Assist => (l === 'guided' ? 'value' : l === 'color' ? 'color' : 'none');
const CATEGORY_NAME: Record<HiLoCategory, string> = { low: '2–6', neutral: '7–9', high: '10–A' };
const VALUE: Record<HiLoCategory, number> = { low: 1, neutral: 0, high: -1 };

export default function CountDrill({ api }: { api: ProgressApi }) {
  const [level, setLevel] = useState<Level>('guided');
  const [ms, setMs] = useState(1200);
  const rng = useRef(mulberry32(randomSeed()));
  const [deck, setDeck] = useState<CountItem[]>(() => countSequence(rng.current, 20));
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [checkpoint, setCheckpoint] = useState(false);
  const [entry, setEntry] = useState('');
  const [result, setResult] = useState('');
  const shownAt = useRef(performance.now());
  const promptAt = useRef(0);
  const done = i >= deck.length && !checkpoint;

  const restart = useCallback((l: Level) => {
    setLevel(l); setDeck(countSequence(rng.current, l === 'speed' ? 24 : 20)); setI(0); setRunning(0); setFeedback(''); setCheckpoint(false); setEntry(''); setResult('');
    shownAt.current = performance.now();
  }, []);

  const card = deck[i];

  // Speed: advance automatically; pause every 8 cards (and at the end) for the count.
  useEffect(() => {
    if (level !== 'speed' || checkpoint || done) return undefined;
    const t = window.setTimeout(() => {
      const nextIndex = i + 1;
      if (nextIndex % 8 === 0 || nextIndex >= deck.length) { setCheckpoint(true); promptAt.current = performance.now(); setEntry(''); }
      setI(nextIndex);
    }, ms);
    return () => window.clearTimeout(t);
  }, [level, i, checkpoint, done, ms, deck.length]);

  const classify = (v: number) => {
    if (!card) return;
    const truth = VALUE[card.category];
    const ok = v === truth;
    api.update((p) => recordClassify(p, card.category, ok));
    setFeedback(ok ? `Right: ${card.card.rank} is ${truth > 0 ? '+' : truth < 0 ? '−' : ''}${Math.abs(truth)}.` : `${card.card.rank} (${CATEGORY_NAME[card.category]}) is ${truth > 0 ? '+1' : truth < 0 ? '−1' : '0'}.`);
    setRunning((r) => r + truth);
    setI((n) => n + 1);
  };

  const trueRunning = useMemo(() => deck.slice(0, i).reduce((n, x) => n + hiLoValue(x.card.rank), 0), [deck, i]);

  const submitCount = () => {
    const guess = Number(entry);
    if (entry.trim() === '' || Number.isNaN(guess)) return;
    const ok = guess === trueRunning;
    const took = performance.now() - promptAt.current;
    api.update((p) => recordRunningCount(p, ok, took));
    setResult(ok ? `Correct: ${trueRunning}. (${(took / 1000).toFixed(1)}s)` : `The count was ${trueRunning}; you said ${guess}.`);
    setCheckpoint(false);
  };

  const c = api.progress.classify;
  return (
    <section className="bj-drill" aria-labelledby="bj-count-h">
      <h3 id="bj-count-h">Hi-Lo counting drill</h3>
      <div className="px-tabs px-tabs--sub" role="group" aria-label="Assistance level">
        {LEVELS.map((l) => <button key={l.id} type="button" aria-pressed={level === l.id} onClick={() => restart(l.id)}>{l.name}</button>)}
      </div>
      <p>{LEVELS.find((l) => l.id === level)!.blurb}</p>
      {level === 'speed' && (
        <label className="bj-range">Speed: {(ms / 1000).toFixed(1)}s per card
          <input type="range" min={400} max={2500} step={100} value={ms} onChange={(e) => setMs(Number(e.target.value))} />
        </label>
      )}
      {level === 'guided' && <HiLoLegend />}

      {!done && card && !checkpoint && (
        <div className="bj-drill__stage">
          <p className="bj-label" aria-live="polite">Card {i + 1} of {deck.length}</p>
          <div className="bj-hand" key={i}><PlayingCard card={card.card} assist={assistFor(level)} /></div>
          {level !== 'speed' && (
            <div className="bj-actions" role="group" aria-label="What does this card count as?">
              <button type="button" className="px-btn" onClick={() => classify(1)}>+1</button>
              <button type="button" className="px-btn" onClick={() => classify(0)}>0</button>
              <button type="button" className="px-btn" onClick={() => classify(-1)}>−1</button>
            </div>
          )}
          {level !== 'speed' && <p className="bj-stats">Your running count so far: {running}</p>}
        </div>
      )}

      {checkpoint && (
        <form className="bj-drill__stage" onSubmit={(e) => { e.preventDefault(); submitCount(); }}>
          <label className="bj-label" htmlFor="bj-rc">What is the running count after {i} cards?</label>
          <input id="bj-rc" className="px-input" inputMode="numeric" autoFocus value={entry} onChange={(e) => setEntry(e.target.value)} />
          <button type="submit" className="px-btn px-btn--primary">Check</button>
        </form>
      )}

      <p className="bj-feedback" role="status" aria-live="polite">{result || feedback}</p>
      {done && (
        <div className="bj-drill__stage">
          <p>Finished. {level === 'speed' ? `Final running count: ${trueRunning}.` : `Your final running count was ${running}; the true value is ${trueRunning}.`}</p>
          <button type="button" className="px-btn px-btn--primary" onClick={() => restart(level)}>Another round</button>
        </div>
      )}
      <p className="bj-stats">Per-card accuracy · 2–6: {pct(c.low)} · 7–9: {pct(c.neutral)} · 10–A: {pct(c.high)} · Running-count checks: {pct(api.progress.runningCount)}</p>
    </section>
  );
}
