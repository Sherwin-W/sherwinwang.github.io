import { useEffect, useRef } from 'react';
import { SCENES } from '../stage2/scenes';

export default function Transition({ onContinue }: { onContinue: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { button.current?.focus({ preventScroll: true }); }, []);
  return (
    <section className="mb-transition" aria-labelledby="mb-t-h">
      <p className="mb-transition__kicker">Stage 1 complete</p>
      <h2 id="mb-t-h" className="mb-transition__title"><span>Stage 2</span><span>Social scenes</span></h2>
      <p className="mb-transition__text">Next, a few short moments with different people. Each one says something to you. Answer naturally, as if you were really there: out loud or typed, as long or short as you like.</p>
      <p className="mb-transition__text">{SCENES.length} scenes. Do them in any order; at least four for a reading.</p>
      <button ref={button} type="button" className="mb-btn mb-btn--primary mb-btn--big" onClick={onContinue}>Open the scenes</button>
    </section>
  );
}
