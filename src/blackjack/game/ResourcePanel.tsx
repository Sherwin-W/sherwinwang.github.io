import { ASSIST_THRESHOLDS } from './run';
import Offline from './Offline';
import type { RunApi } from './useRun';

interface Props { run: RunApi; aceTracking: boolean }

/** Right HUD: ace tracking and what the table offers. (Ask the Dealer sits above it.) */
export default function ResourcePanel({ run, aceTracking }: Props) {
  const { view, assist, counting } = run;
  const r = view.rules;
  const aces = r.decks * 4;
  return (
    <div className="px-intel">
      {counting && (
        <section className="px-box" aria-labelledby="px-aces-h">
          <h2 id="px-aces-h" className="px-h">Aces</h2>
          <Offline offline={!assist.aces} label={aceTracking ? 'Track aces in your head.' : 'Ace tracker removed.'}>
            <p className="px-readout px-readout--sm" aria-label={`${view.acesSeen} of ${aces} aces seen`}>{view.acesSeen}<span className="px-dim">/{aces}</span></p>
            <div className="px-pips" aria-hidden="true">
              {Array.from({ length: aces }, (_, i) => <i key={i} className={i < view.acesSeen ? 'is-on' : ''} />)}
            </div>
            <p className="px-tiny px-dim">Offline at {ASSIST_THRESHOLDS.aces} cards.</p>
          </Offline>
          <p className="px-tiny">{aceTracking ? 'Side count ON: checkpoints also ask for aces seen.' : 'Side count OFF (turn on before a run).'} Aces still count −1 in the main count; the side count is separate.</p>
        </section>
      )}

      <section className="px-box" aria-labelledby="px-rules-h">
        <h2 id="px-rules-h" className="px-h">Table</h2>
        <dl className="px-rules">
          <div><dt>Surrender</dt><dd className={r.lateSurrender ? 'is-on' : 'is-off'}>{r.lateSurrender ? 'Late, 2 cards' : 'No'}</dd></div>
          <div><dt>Insurance</dt><dd className={r.insurance ? 'is-on' : 'is-off'}>{r.insurance ? 'Vs ace' : 'No'}</dd></div>
          <div><dt>Dealer</dt><dd>{r.dealerHitsSoft17 ? 'Hits soft 17' : 'Stands soft 17'}</dd></div>
          <div><dt>Blackjack</dt><dd>{r.blackjackPayout === 1.5 ? '3:2' : '6:5'}</dd></div>
          <div><dt>Double</dt><dd>{r.doubleOn === 'any' ? 'Any 2' : r.doubleOn}{r.doubleAfterSplit ? ', DAS' : ''}</dd></div>
          <div><dt>Shoe</dt><dd>{r.decks} decks, to the last card</dd></div>
        </dl>
      </section>
    </div>
  );
}
