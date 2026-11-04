import { useEffect, useMemo, useRef, useState } from 'react';
import { readAll, type Evidence } from '../analysis';
import { APP_NAME, DISCLAIMER } from '../brand';
import { markerPosition, renderResultCard } from '../resultCard';
import { DIMENSIONS, POLES, POLE_NAMES } from '../scoring';
import { responses, type State } from '../session';
import { sceneById } from '../stage2/scenes';
import type { Confidence, Dimension, Pole } from '../types';
import VoiceCredits from './VoiceCredits';
import Window from './Window';

const CONF_TEXT: Record<Confidence, string> = { unclear: 'Not enough evidence', low: 'Tentative', medium: 'Moderate evidence', high: 'Consistent evidence' };
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** One quote per sentence: a sentence matching several cues is shown once. */
const distinct = (es: Evidence[]) => es.filter((e, i) => es.findIndex((x) => x.quote === e.quote) === i);

/** The three strongest quotes, always including the best one from each stage that has any. */
function topQuotes(es: Evidence[]): Evidence[] {
  const ranked = distinct([...es].sort((x, y) => y.weight - x.weight));
  const top = ranked.slice(0, 3);
  for (const stage of [1, 2] as const) {
    const best = ranked.find((e) => e.stage === stage);
    if (best && !top.includes(best)) top[top.length - 1] = best;
  }
  return top;
}

function where(e: Evidence): string {
  return e.stage === 1 ? 'Questions' : `Scene: ${sceneById(e.responseId)?.title ?? ''}`;
}

interface Props { state: State; onRestart: () => void }

export default function Results({ state, onRestart }: Props) {
  const rs = useMemo(() => responses(state), [state]);
  const reading = useMemo(() => readAll(rs), [rs]);
  const [chosen, setChosen] = useState<Record<Dimension, Pole | null>>(() => Object.fromEntries(DIMENSIONS.map((d) => [d, reading.dimensions[d].preference])) as Record<Dimension, Pole | null>);
  const canvas = useRef<HTMLCanvasElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (canvas.current) renderResultCard(canvas.current, reading, chosen, APP_NAME); }, [reading, chosen]);
  const type = DIMENSIONS.map((d) => chosen[d] ?? 'X').join('');
  const adjusted = DIMENSIONS.some((d) => chosen[d] !== reading.dimensions[d].preference);
  const stage1 = rs.filter((r) => r.stage === 1 && !r.skipped && r.text);
  const stage2 = rs.filter((r) => r.stage === 2 && !r.skipped && r.text);
  const avg = (xs: typeof rs) => (xs.length ? Math.round(xs.reduce((n, r) => n + words(r.text), 0) / xs.length) : 0);

  const download = () => {
    const a = document.createElement('a');
    a.download = `personality-${type}.png`;
    a.href = canvas.current!.toDataURL('image/png');
    a.click();
  };

  return (
    <Window title="reading.txt" accent="violet" labelledBy="mb-res-h" className="mb-results">
      <p className="mb-eyebrow">Your reading</p>
      <h2 id="mb-res-h" className="mb-type" tabIndex={-1} ref={heading} aria-label={`Suggested type ${type.split('').join(' ')}`}>
        {type.split('').map((ch, i) => <span key={i} style={{ animationDelay: `${i * 120}ms` }}>{ch}</span>)}
      </h2>
      <p className="mb-note">
        Based on {stage1.length} {stage1.length === 1 ? 'answer' : 'answers'} and {stage2.length} {stage2.length === 1 ? 'scene' : 'scenes'}.
        {type.includes('X') && ' X means your answers did not lean either way.'}
        {adjusted && ' Includes your own adjustments.'}
      </p>
      {reading.alternatives.length > 0 && <p className="mb-note">Close alternatives: <strong>{reading.alternatives.join(', ')}</strong>. The least certain letters could easily go the other way.</p>}

      <ul className="mb-dims">
        {DIMENSIONS.map((d) => {
          const r = reading.dimensions[d];
          const [a, b] = POLES[d];
          const pos = markerPosition(r.lean, r.confidence) * 100;
          const top = topQuotes(r.evidence.filter((e) => e.pole === r.preference));
          const other = r.evidence.filter((e) => e.pole !== r.preference).slice(0, 1);
          return (
            <li key={d} className="mb-dim">
              <div className="mb-dim__head"><span>{POLE_NAMES[a]}</span><span>{POLE_NAMES[b]}</span></div>
              <div className="mb-meter" role="img" aria-label={`${CONF_TEXT[r.confidence]}, leaning ${r.preference ? POLE_NAMES[r.preference] : 'neither way'}`}>
                <span className="mb-meter__mid" /><span className="mb-meter__dot" style={{ left: `${pos}%` }} />
              </div>
              <p className="mb-dim__verdict"><strong>{r.preference ? `Leaning ${POLE_NAMES[r.preference]}` : 'No clear lean'}</strong> · {CONF_TEXT[r.confidence]}</p>
              {top.length > 0 && (
                <ul className="mb-quotes">
                  {top.map((e, i) => (
                    <li key={i}><q>{e.quote}</q><span>{where(e)} · read as {POLE_NAMES[e.pole]}: {e.label}{e.hedged ? ' (said tentatively)' : ''}</span></li>
                  ))}
                </ul>
              )}
              {other.length > 0 && <p className="mb-dim__other">Pointing the other way: <q>{other[0].quote}</q> <span>({other[0].label})</span></p>}
              {r.notes.map((n, i) => <p key={i} className="mb-dim__note">{n}</p>)}
              <div className="mb-fix" role="group" aria-label={`Your call: ${POLE_NAMES[a]} or ${POLE_NAMES[b]}`}>
                <span>Doesn’t fit? Your call:</span>
                {[a, b].map((p) => <button key={p} type="button" aria-pressed={chosen[d] === p} onClick={() => setChosen((c) => ({ ...c, [d]: p }))}>{p}</button>)}
              </div>
            </li>
          );
        })}
      </ul>

      <details className="mb-stats">
        <summary>How you answered (not used for the reading)</summary>
        <p>Average answer length: {avg(stage1)} words in the questions, {avg(stage2)} in the scenes. Length, pace and voice are never scored; only what you said.</p>
      </details>
      <details className="mb-stats">
        <summary>How this reading works</summary>
        <p>Each sentence you said is checked against plain-language patterns for the four preference pairs, and in the scenes against patterns specific to that situation. Negations, hedges (“maybe”, “it depends”) and statements about other people are handled; general statements (“I usually…”) count more than reactions to one scene, and no single answer can decide a letter. “Consistent evidence” means several answers agreed; it is not a statistical accuracy.</p>
      </details>
      <VoiceCredits />
      <p className="mb-disclaimer">{DISCLAIMER} A different day or different questions could give a different result.</p>
      <div className="mb-actions">
        <button type="button" className="mb-btn mb-btn--primary" onClick={download}>Download card</button>
        <button type="button" className="mb-btn" onClick={onRestart}>Start over (deletes this session)</button>
      </div>
      <canvas ref={canvas} className="mb-sharecard" aria-label="Preview of your shareable card: type and leanings only, none of your answers" />
    </Window>
  );
}
