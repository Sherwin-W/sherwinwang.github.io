import { DealerPortrait } from './DealerDialog';
import { DEALER_PAID_FROM } from './run';
import type { RunApi } from './useRun';

/** The NPC button that opens dealer advice. Shows the current price. */
export default function DealerCard({ run, onAsk }: { run: RunApi; onAsk: () => void }) {
  const { paid, price, adviceShown, advice } = run.dealer;
  const tag = !paid ? 'Free' : advice && adviceShown ? 'Paid' : `${price} ${price === 1 ? 'coin' : 'coins'}`;
  return (
    <section className="px-box px-dealer-card" aria-labelledby="px-ask">
      <DealerPortrait scale={3} />
      <div className="px-dealer-card__main">
        <button id="px-ask" type="button" className="px-btn px-btn--ask" onClick={onAsk} aria-keyshortcuts="?">
          Ask the dealer <span className="px-price">{tag}</span>
        </button>
        <p className="px-tiny px-dim">{run.counting ? (paid ? 'Each paid hint costs 1 coin more. Key ?' : `Free until ${DEALER_PAID_FROM} cards. Key ?`) : 'Free all shoe in Recruit. Key ?'}</p>
      </div>
    </section>
  );
}
