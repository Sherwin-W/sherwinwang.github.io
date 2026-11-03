import { estimateDecks } from '../engine/count';
import { formatCount2, type CountingSystem } from '../engine/systems';
import Offline from './Offline';
import { ASSIST_THRESHOLDS } from './run';
import type { RunApi } from './useRun';

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/** Left HUD: manual counter, true-count calculator and the counting system card. */
export default function CountPanel({ run, system }: { run: RunApi; system: CountingSystem }) {
  const { assist, view, counter2 } = run;
  const decks = estimateDecks(view.cardsRemaining);
  // The calculator only ever uses the player's own counter, never the engine's count.
  const tc = run.calc(counter2);
  const steps = system.steps2.flatMap((s) => [-s, s]).sort((a, b) => a - b);

  return (
    <div className="px-count">
      <section className="px-box" aria-labelledby="px-counter-h">
        <h2 id="px-counter-h" className="px-h">Running count</h2>
        <Offline offline={!assist.counter} label="Keep the count in your head.">
          <output className="px-readout" aria-live="off" aria-label={`Your running count ${formatCount2(counter2)}`}>{formatCount2(counter2)}</output>
          <div className={`px-steps px-steps--${steps.length}`} role="group" aria-label="Adjust your running count">
            {steps.map((s) => (
              <button key={s} type="button" disabled={!assist.counter} className={`px-btn px-btn--step ${s > 0 ? 'is-plus' : 'is-minus'}`} onClick={() => run.adjustCounter(s)} aria-label={`${s > 0 ? 'Add' : 'Subtract'} ${formatCount2(Math.abs(s)).replace('+', '')}`}>
                {formatCount2(s)}
              </button>
            ))}
          </div>
          <p className="px-tiny">
            Keys: <kbd>=</kbd> +1 · <kbd>-</kbd> −1{system.id === 'wong' && <> · <kbd>]</kbd> +½ · <kbd>[</kbd> −½</>}
            {' '}· <button type="button" className="px-link" disabled={!assist.counter} onClick={run.resetCounter}>reset</button>
          </p>
          <p className="px-tiny px-dim">Your tally, not the real count. Offline at {ASSIST_THRESHOLDS.counter} cards.</p>
        </Offline>
      </section>

      <section className="px-box" aria-labelledby="px-calc-h">
        <h2 id="px-calc-h" className="px-h">True count</h2>
        <Offline offline={!assist.calculator} label="Divide by decks remaining yourself.">
          <p className="px-calc" aria-live="polite">
            <span title="Your running count">{formatCount2(counter2)}</span>
            <span aria-hidden="true">÷</span>
            <span title="Decks remaining, nearest half deck">{decks}</span>
            <span aria-hidden="true">=</span>
            <strong title="True count, truncated toward zero">{sign(tc)}</strong>
          </p>
          <p className="px-tiny px-dim">Your RC ÷ decks left (half-deck steps), truncated toward zero. A wrong count gives a wrong answer. Offline at {ASSIST_THRESHOLDS.calculator} cards.</p>
        </Offline>
      </section>

      <section className="px-box" aria-labelledby="px-sys-h">
        <h2 id="px-sys-h" className="px-h">{system.name}</h2>
        <table className="px-tags">
          <caption className="visually-hidden">{system.name} card tags</caption>
          <tbody>
            {system.legend.map((row) => (
              <tr key={row.ranks} className={row.tag2 > 0 ? 'is-plus' : row.tag2 < 0 ? 'is-minus' : ''}>
                <th scope="row">{row.ranks}</th>
                <td>{formatCount2(row.tag2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-tiny px-dim">{system.id === 'wong' ? 'Balanced: a full shoe sums to 0. Fractions are kept exact.' : 'Balanced: a full shoe sums to 0.'}</p>
      </section>
    </div>
  );
}
