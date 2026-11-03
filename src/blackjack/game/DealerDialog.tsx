import { useEffect, useRef, useState } from 'react';
import type { Rules } from '../engine/rules';
import StrategyChart from '../ui/StrategyChart';
import { DEALER, DEALER_PALETTE, DEALER_TALK } from './pixelArt';
import PixelSprite from './PixelSprite';
import { DEALER_PAID_FROM } from './run';
import type { RunApi } from './useRun';

/** Flavor only. The advice itself always comes from `decide()` for the table rules. */
const LINES: Record<string, string> = {
  Hit: 'Take a card. The book says you need more than that.',
  Stand: 'Hold right there. Let me do the drawing.',
  Double: 'This is the spot. Double it and take one card.',
  Split: 'Split them. Two hands beat that one.',
  Surrender: 'Hand it back and keep half. No shame in it.',
  'No insurance': 'Keep your chips off that insurance line, friend.',
};

/** The dealer NPC with a portrait, for the button and the dialog. */
export function DealerPortrait({ scale = 3, talking = false }: { scale?: number; talking?: boolean }) {
  return (
    <span className={`px-dealer${talking ? ' is-talking' : ''}`} aria-hidden="true">
      <PixelSprite sprite={DEALER} palette={DEALER_PALETTE} scale={scale} className="px-dealer__a" />
      <PixelSprite sprite={DEALER_TALK} palette={DEALER_PALETTE} scale={scale} className="px-dealer__b" />
    </span>
  );
}

interface Props { open: boolean; run: RunApi; rules: Rules; onClose: () => void }

export default function DealerDialog({ open, run, rules, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [chart, setChart] = useState(false);
  const [msg, setMsg] = useState('');
  const { advice, adviceShown, paid, price } = run.dealer;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setChart(false); setMsg('');
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
    }
  }, [open]);

  const ask = () => {
    const r = run.revealAdvice();
    if (r === 'insufficient') setMsg(`You need ${price} ${price === 1 ? 'coin' : 'coins'} and have ${run.bank}. Golden cards and high flow drop coins.`);
    else setMsg('');
  };
  const canAfford = run.bank >= price;
  const chartAllowed = !paid || adviceShown;

  let line: string;
  if (!advice) line = 'Nothing in front of you yet. Ask me when you have a decision to make.';
  else if (adviceShown) line = LINES[advice.action] ?? 'Here is what the book says.';
  else if (paid) line = `Past ${DEALER_PAID_FROM} cards my advice costs ${price} ${price === 1 ? 'coin' : 'coins'}.`;
  else line = `First ${DEALER_PAID_FROM} cards, advice is on the house.`;

  return (
    <dialog ref={ref} className="px-dialog px-dealer-dlg" aria-labelledby="px-dlg-h" onClose={onClose} onCancel={onClose}>
      <div className="px-dialog__bar">
        <h2 id="px-dlg-h" className="px-h">Ask the dealer</h2>
        <button type="button" className="px-btn" onClick={onClose} autoFocus>Close <kbd>Esc</kbd></button>
      </div>
      <div className="px-dealer-dlg__body">
        <DealerPortrait scale={5} talking={open} />
        <div className="px-bubble">
          <p className="px-bubble__line">“{line}”</p>
          {advice && adviceShown && (
            <div className="px-advice" role="status">
              <p className="px-advice__spot">{advice.spot}</p>
              <p className="px-advice__play">Basic strategy: <strong>{advice.action}</strong></p>
              <p className="px-tiny">{advice.why}</p>
            </div>
          )}
          {advice && !adviceShown && (
            <div className="px-row">
              <button type="button" className="px-btn px-btn--primary" onClick={ask} disabled={paid && !canAfford}>
                {paid ? `Pay ${price} ${price === 1 ? 'coin' : 'coins'} for advice` : 'Tell me (free)'}
              </button>
              {paid && <span className="px-tiny">You have {run.bank} {run.bank === 1 ? 'coin' : 'coins'}.</span>}
            </div>
          )}
          {advice && !adviceShown && paid && !canAfford && <p className="px-error">Not enough coins: this hint costs {price}. Golden cards and flow above 75% drop coins.</p>}
          <p className="px-error" role="alert">{msg}</p>
          <p className="px-tiny px-dim">Advice is basic strategy for these table rules, worked out from your cards and the dealer’s upcard only. Following it still grades the decision, but it does not raise flow or pay coins.</p>
        </div>
      </div>
      {chartAllowed ? (
        <>
          <button type="button" className="px-link" aria-expanded={chart} onClick={() => setChart((v) => !v)}>{chart ? 'Hide' : 'Show'} the full strategy chart</button>
          {chart && <StrategyChart rules={rules} />}
        </>
      ) : (
        <p className="px-tiny px-dim">The full chart comes with paid advice for the current decision.</p>
      )}
    </dialog>
  );
}
