import { useEffect, useRef, useState } from 'react';
import { DIMENSIONS, POLES, POLE_NAMES } from './scoring';
import { renderResultCard } from './resultCard';
import type { Dimension, Pole, Profile } from './types';

interface Props { profile: Profile; onRestart: () => void; onDelete: () => void }

const CONF_SCALE = { unclear: 0, low: 0.35, medium: 0.65, high: 1 } as const;
const CONF_TEXT = { unclear: 'Not enough evidence', low: 'Low confidence', medium: 'Medium confidence', high: 'Higher confidence' } as const;

export default function ResultsView({ profile, onRestart, onDelete }: Props) {
  const [chosen, setChosen] = useState<Record<Dimension, Pole | null>>(
    () => Object.fromEntries(DIMENSIONS.map((d) => [d, profile.dimensions[d].preference])) as Record<Dimension, Pole | null>,
  );
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvas.current) renderResultCard(canvas.current, profile, chosen); }, [profile, chosen]);
  const adjusted = DIMENSIONS.some((d) => chosen[d] !== profile.dimensions[d].preference);
  const type = DIMENSIONS.map((d) => chosen[d] ?? 'X').join('');

  const download = () => {
    const a = document.createElement('a');
    a.download = `mpti-${type}.png`;
    a.href = canvas.current!.toDataURL('image/png');
    a.click();
  };

  return (
    <div className="mpti__results">
      <p className="mpti__eyebrow">Your reading</p>
      <h2 className="mpti__type" aria-label={`Type ${type.split('').join(' ')}`}>{type}</h2>
      <p className="mpti__note">{adjusted ? 'This includes your own adjustments. ' : ''}{type.includes('X') && 'X means there was not enough evidence to lean either way. '} Based on {profile.answered} {profile.answered === 1 ? 'answer' : 'answers'}.</p>

      <ul className="mpti__dims">
        {DIMENSIONS.map((d) => {
          const r = profile.dimensions[d];
          const [first, second] = POLES[d];
          // Weak evidence keeps the marker near the middle so it never looks more certain than it is.
          const pct = (0.5 + (r.lean * CONF_SCALE[r.confidence]) / 2) * 100;
          return (
            <li key={d} className="mpti__dim">
              <div className="mpti__dim-head">
                <span>{POLE_NAMES[first]}</span><span>{POLE_NAMES[second]}</span>
              </div>
              <div className="mpti__meter" role="img" aria-label={`${CONF_TEXT[r.confidence]}, leaning ${r.preference ? POLE_NAMES[r.preference] : 'neither way'}`}>
                <span className="mpti__meter-mid" /><span className="mpti__meter-dot" style={{ left: `${pct}%` }} />
              </div>
              <p className="mpti__conf"><strong>{r.preference ? `Leaning ${POLE_NAMES[r.preference]}` : 'No clear lean'}</strong> · {CONF_TEXT[r.confidence]}</p>
              {r.evidence.length > 0 ? (
                <details>
                  <summary>What you said ({r.evidence.length})</summary>
                  <ul className="mpti__evidence">
                    {r.evidence.slice(0, 4).map((e, i) => (
                      <li key={i}><q>{e.quote}</q><span>Read as {POLE_NAMES[e.pole]}: {e.cue}</span></li>
                    ))}
                  </ul>
                </details>
              ) : <p className="mpti__conf">Nothing in your answers pointed either way.</p>}
              <div className="mpti__fix" role="group" aria-label={`Your own call for ${POLE_NAMES[first]} or ${POLE_NAMES[second]}`}>
                <span>Doesn’t fit? You decide:</span>
                {[first, second].map((p) => (
                  <button key={p} type="button" aria-pressed={chosen[d] === p} onClick={() => setChosen((c) => ({ ...c, [d]: p }))}>{p}</button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mpti__limits">{profile.limitations} A different set of questions, or a different mood, could give a different result.</p>
      <div className="mpti__actions">
        <button type="button" className="bento-link bento-link--primary" onClick={download}>Download results card</button>
        <button type="button" className="bento-link" onClick={onRestart}>Start over</button>
        <button type="button" className="bento-link" onClick={onDelete}>Delete this session</button>
      </div>
      <canvas ref={canvas} className="mpti__card" aria-label="Preview of your shareable results card, which contains your type and leanings but none of your answers" />
    </div>
  );
}
