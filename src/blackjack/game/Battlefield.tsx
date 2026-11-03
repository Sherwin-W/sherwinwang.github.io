import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { evaluate } from '../engine/hand';
import { ACTION_LABEL, type Action } from '../engine/strategy';
import type { Card } from '../engine/cards';
import { formatCount2 } from '../engine/systems';
import PixelCard, { type Deck } from './PixelCard';
import { WAGER_CHIPS } from './run';
import { SPRINT_BATCH, type Point, type RunApi } from './useRun';

export const ACTION_KEYS: Record<Action, string> = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
const ACTIONS: Action[] = ['hit', 'stand', 'double', 'split', 'surrender'];
const STAGGER_MS = 90;

/** Where an effect should appear: the pointer for clicks, the control's center for keyboard presses. */
export function originOf(e: MouseEvent<HTMLElement>): Point {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Gives each newly mounted card a deal delay so a batch of engine changes plays out in order
 * (hole-card flip, then each dealer draw). Presentation only: the engine has already resolved.
 */
function useStagger(reduceMotion: boolean, empty: boolean) {
  const seen = useRef(new Map<string, number>());
  const batch = useRef<{ token: unknown; n: number }>({ token: null, n: 0 });
  if (empty) seen.current.clear();
  return (key: string, token: unknown): number => {
    if (reduceMotion) return 0;
    const known = seen.current.get(key);
    if (known !== undefined) return known;
    if (batch.current.token !== token) batch.current = { token, n: 0 };
    const d = batch.current.n++ * STAGGER_MS;
    seen.current.set(key, d);
    return d;
  };
}

function renderHand({ cards, deck, keyPrefix, delay, token }: { cards: readonly (Card | null)[]; deck: Deck; keyPrefix: string; delay: (k: string, t: unknown) => number; token: unknown }) {
  const overlap = cards.length >= 5 ? 'is-tight' : cards.length >= 4 ? 'is-close' : '';
  let last = 0;
  const items = cards.map((c, i) => {
    const k = `${keyPrefix}${i}${c ? `${c.rank}${c.suit}` : 'x'}`;
    const d = delay(k, token);
    last = Math.max(last, d);
    return <PixelCard key={k} card={c} deck={deck} className={`px-deal${keyPrefix === 'd' && i === 1 && c ? ' is-flip' : ''}`} style={{ animationDelay: `${d}ms` }} />;
  });
  return { node: <div className={`px-hand ${overlap}`}>{items}</div>, last };
}

const OUTCOME: Record<string, string> = { blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust', surrender: 'Surrender' };
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

interface Props { run: RunApi; reduceMotion: boolean }

export default function Battlefield({ run, reduceMotion }: Props) {
  const { view, stage } = run;
  const [bet, setBet] = useState(1);
  const empty = view.dealer.length === 0 && view.hands.length === 0 && view.burned.length === 0;
  const delay = useStagger(reduceMotion, empty);
  const token = view;

  const dealerCards = view.dealer;
  const dealer = renderHand({ cards: dealerCards, deck: 'dark', keyPrefix: 'd', delay, token });
  const dealerKnown = dealerCards.length > 0 && dealerCards.every((c) => c !== null);
  const dealerTotal = dealerKnown ? evaluate(dealerCards as Card[]) : null;
  const upTotal = dealerCards[0] ? evaluate([dealerCards[0]]) : null;

  // Keep focus on something useful when the focused control disappears (for example Double after a hit).
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stage !== 'player') return;
    if (document.activeElement === document.body || (document.activeElement as HTMLButtonElement | null)?.disabled) {
      bar.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    }
  }, [stage, view]);

  const shoePct = Math.round((view.cardsDealt / view.totalCards) * 100);

  return (
    <div className="px-field" data-stage={stage}>
      {!(stage === 'sprint' || view.phase === 'sprint' || view.shoeFinished) && (
        <div className="px-side px-side--dealer">
          <p className="px-h">
            Dealer
            {dealerTotal ? <span className="px-total px-late" style={{ animationDelay: `${dealer.last}ms` }}>{dealerTotal.soft ? 'soft ' : ''}{dealerTotal.total}</span>
              : upTotal ? <span className="px-total px-dim">shows {upTotal.total === 11 ? 'A' : upTotal.total}</span> : null}
          </p>
          {dealerCards.length ? dealer.node : <div className="px-hand px-hand--empty" aria-hidden="true" />}
        </div>
      )}

      <div className="px-shoe" role="img" aria-label={`Shoe: ${view.cardsRemaining} of ${view.totalCards} cards left, ${view.cardsExposed} exposed`}>
        <span className="px-shoe__bar"><span style={{ width: `${shoePct}%` }} /></span>
        <span className="px-shoe__text">{view.cardsRemaining} left</span>
      </div>

      <div className="px-side px-side--player">
        {stage === 'sprint' || view.phase === 'sprint' || view.phase === 'complete' || view.shoeFinished ? (
          <div className="px-sprint">
            <p className="px-h">Endurance sprint · {view.cardsRemaining} cards left</p>
            <div className="px-hand">
              {view.burned.map((c, i) => {
                const k = `b${view.cardsDealt}-${i}`;
                return <PixelCard key={k} card={c} deck="light" className="px-deal" style={{ animationDelay: `${delay(k, token)}ms` }} />;
              })}
            </div>
          </div>
        ) : view.hands.length === 0 ? (
          <p className="px-h">You<span className="px-total px-dim">waiting for the deal</span></p>
        ) : (
          <div className={`px-seats${view.hands.length > 1 ? ' is-split' : ''}`}>
            {view.hands.map((h, i) => {
              const hand = renderHand({ cards: h.cards, deck: 'light', keyPrefix: `h${i}-`, delay, token });
              const v = evaluate(h.cards);
              const out = view.outcomes?.[i];
              const active = i === view.active && view.phase === 'player';
              return (
                <div key={i} className={`px-seat${active ? ' is-active' : ''}${h.surrendered ? ' is-surrendered' : ''}${h.doubled ? ' is-doubled' : ''}`} aria-current={active ? 'true' : undefined}>
                  <p className="px-h">
                    {view.hands.length > 1 ? `Hand ${i + 1}` : 'You'}
                    <span className="px-total px-late" style={{ animationDelay: `${hand.last}ms` }}>{v.soft && v.total < 21 ? 'soft ' : ''}{v.total}</span>
                    <span className="px-bet" title="Virtual units">BET {h.bet}</span>
                  </p>
                  {hand.node}
                  {out && <p className={`px-outcome is-${out.kind} px-late`} style={{ animationDelay: `${dealer.last + 80}ms` }}>{OUTCOME[out.kind]} <span>{signed(out.net)}</span></p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-command" aria-live="off">
        {stage === 'player' && (
          <div className="px-actions" role="group" aria-label="Your decision (keys H, S, D, P, R)" ref={bar}>
            {ACTIONS.map((a) => (
              <button key={a} type="button" className={`px-btn px-btn--act is-${a}`} disabled={!view.legal.includes(a)} aria-keyshortcuts={ACTION_KEYS[a]} onClick={(e) => run.act(a, originOf(e))}>
                {ACTION_LABEL[a]} <kbd>{ACTION_KEYS[a]}</kbd>
              </button>
            ))}
          </div>
        )}

        {stage === 'insurance' && (
          <div className="px-prompt" role="group" aria-labelledby="px-ins-q">
            <p id="px-ins-q" className="px-q">Dealer shows an ace. Insurance costs {view.hands[0]?.bet / 2} and pays 2:1 if the dealer has blackjack.</p>
            <div className="px-actions">
              <button type="button" className="px-btn" autoFocus onClick={(e) => run.insure(false, originOf(e))} aria-keyshortcuts="N">No insurance <kbd>N</kbd></button>
              <button type="button" className="px-btn" onClick={(e) => run.insure(true, originOf(e))} aria-keyshortcuts="I">Take insurance <kbd>I</kbd></button>
            </div>
          </div>
        )}

        {stage === 'betting' && (
          <div className="px-prompt">
            {run.counting ? (
              <>
                <p className="px-q" id="px-wager-l">Practice wager (virtual units). Size it from the true count.</p>
                <div className="px-chips" role="radiogroup" aria-labelledby="px-wager-l">
                  {WAGER_CHIPS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={bet === c} className="px-chip" onClick={() => setBet(c)}>{c}</button>
                  ))}
                </div>
                <p className="px-tiny px-dim">Schedule: ≤ +1 → 1 · +2 → 2 · +3 → 4 · ≥ +4 → 6. A training rubric, not betting advice.</p>
              </>
            ) : (
              <p className="px-q">Recruit: every decision is graded against basic strategy.</p>
            )}
            <button type="button" className="px-btn px-btn--primary" autoFocus onClick={(e) => run.deal(bet, originOf(e))}>Deal <kbd>Enter</kbd></button>
          </div>
        )}

        {stage === 'settled' && (
          <div className="px-prompt">
            <p className="px-q px-late" style={{ animationDelay: `${dealer.last}ms` }}>
              Round {view.roundNumber}: {signed(view.net)} units{view.insuranceNet !== 0 && ` (insurance ${signed(view.insuranceNet)})`}. Hand results do not affect your score.
            </p>
            <button type="button" className="px-btn px-btn--primary" autoFocus onClick={run.next}>Next round <kbd>Enter</kbd></button>
          </div>
        )}

        {stage === 'sprint' && (
          <div className="px-prompt">
            <p className="px-q">Full-shoe endurance format: the shoe is dealt to the last card, which a casino would not do (it reshuffles at the cut card).</p>
            <button type="button" className="px-btn px-btn--primary" autoFocus onClick={run.reveal}>Reveal next {Math.min(SPRINT_BATCH, view.cardsRemaining)} <kbd>Enter</kbd></button>
          </div>
        )}

        {stage === 'checkpoint' && run.checkpoint && <CheckpointForm run={run} />}
      </div>
    </div>
  );
}

function CheckpointForm({ run }: { run: RunApi }) {
  const cp = run.checkpoint!;
  const prefill = cp.step === 'rc' && run.assist.counter ? formatCount2(run.counter2) : '';
  const [value, setValue] = useState(prefill);
  const label = cp.step === 'rc' ? 'Running count right now?' : cp.step === 'aces' ? 'Aces seen so far?' : 'True count right now?';
  const submit = cp.step === 'rc' ? run.submitRunning : cp.step === 'aces' ? run.submitAces : run.submitTrue;
  return (
    <form key={cp.step} className="px-prompt px-checkpoint" onSubmit={(e) => { e.preventDefault(); submit(value); setValue(''); }}>
      <p className="px-h">{cp.final ? 'Final checkpoint' : 'Count checkpoint'} · {cp.step === 'rc' ? 'running count' : cp.step === 'aces' ? 'ace side count' : 'true count'}</p>
      <label className="px-field" htmlFor="px-cp">{label}</label>
      <div className="px-row">
        <input id="px-cp" className="px-input px-input--big" inputMode="decimal" autoComplete="off" autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="px-cp-help px-cp-err" />
        <button type="submit" className="px-btn px-btn--primary">Lock in <kbd>Enter</kbd></button>
      </div>
      <p id="px-cp-help" className="px-tiny px-dim">
        {cp.step === 'rc' ? (run.assist.counter ? 'Pre-filled from your counter. Fix it if you missed a card.' : 'From memory.') : cp.step === 'tc' ? `Truncate toward zero. Graded from the running count you just entered.` : 'Side count of aces since the shuffle.'}
      </p>
      <p id="px-cp-err" className="px-error" role="alert">{run.checkError}</p>
    </form>
  );
}
