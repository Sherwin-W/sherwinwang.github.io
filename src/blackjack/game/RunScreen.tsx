import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cardName, type Card } from '../engine/cards';
import { evaluate } from '../engine/hand';
import type { Rules } from '../engine/rules';
import type { Action } from '../engine/strategy';
import { formatCount2 } from '../engine/systems';
import type { ProgressApi } from '../ui/useProgress';
import Battlefield from './Battlefield';
import Coins from './Coins';
import CountPanel from './CountPanel';
import DealerCard from './DealerCard';
import DealerDialog from './DealerDialog';
import ComboMeter from './ComboMeter';
import FlowBar from './FlowBar';
import TronBorder from './TronBorder';
import ResourcePanel from './ResourcePanel';
import RunReport from './RunReport';
import { ExitLink, FullscreenButton, RotatePrompt } from './ScreenControls';
import { DIFFICULTIES, gradeOf, runScore, tierOf, type Difficulty, type Grade } from './run';
import { useRun, type Point, type Settings } from './useRun';

const KEY_ACTIONS: Record<string, Action> = { h: 'hit', s: 'stand', d: 'double', p: 'split', r: 'surrender' };

interface Props {
  difficulty: Difficulty;
  rules: Rules;
  seed: number;
  settings: Settings;
  api: ProgressApi;
  best: Grade | null;
  onComplete: (d: Difficulty, g: Grade) => void;
  onAgain: () => void;
  /** Start a fresh run in another mode. */
  onSwitch: (d: Difficulty) => void;
  onBrief: () => void;
}

function Drawer({ id, title, summary, defaultOpen, children }: { id: string; title: string; summary: string; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`px-drawer${open ? ' is-open' : ''}`} aria-label={title}>
      <button type="button" className="px-drawer__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span>{open ? '▾' : '▸'} {title}</span><span className="px-dim">{summary}</span>
      </button>
      <div id={id} className="px-drawer__body">{children}</div>
    </section>
  );
}

const names = (cards: readonly (Card | null)[]) => cards.map((c) => (c ? cardName(c) : 'face-down card')).join(', ');

export default function RunScreen({ difficulty, rules, seed, settings, api, best, onComplete, onAgain, onSwitch, onBrief }: Props) {
  const run = useRun({ difficulty, rules, seed, settings, updateProgress: api.update });
  const { view, stage } = run;
  const [chart, setChart] = useState(false);
  const [pendingMode, setPendingMode] = useState<Difficulty | null>(null);
  const [shake, setShake] = useState(false);
  const chartBtn = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const d = DIFFICULTIES[difficulty];
  const tier = tierOf(run.flow);
  // The border replays only on a milestone (crossing 50% upward, first 100% of the run).
  const powerKey = `tron-${run.milestone?.id ?? 0}`;

  // Mistake feedback: a short shake and red edge pulse, or a static outline when motion/flashing are reduced.
  useEffect(() => {
    if (run.pulse === 0) return;
    setShake(true);
    const t = window.setTimeout(() => setShake(false), settings.reduceFlashing ? 600 : 320);
    return () => window.clearTimeout(t);
  }, [run.pulse, settings.reduceFlashing]);

  const reported = useRef(false);
  useEffect(() => {
    if (stage === 'report' && !reported.current) { reported.current = true; onComplete(difficulty, gradeOf(runScore(run.stats))); }
  }, [stage, run.stats, onComplete, difficulty]);

  const openChart = () => { chartBtn.current = document.activeElement as HTMLElement; setChart(true); };
  const closeChart = () => { setChart(false); window.setTimeout(() => chartBtn.current?.focus(), 0); };

  // Keyboard: H S D P R, I/N for insurance, = - [ ] for the counter, C coins, ? chart. Off in fields, dialogs and the report.
  useEffect(() => {
    const barOrigin = (): Point | undefined => {
      const r = field.current?.querySelector('.px-command')?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top } : undefined;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (chart || pendingMode || stage === 'report') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, dialog')) return;
      const k = e.key.toLowerCase();
      const press = (fn: () => void) => { e.preventDefault(); fn(); };
      if (e.key === '?') return press(openChart);
      if (k === 'c' && run.coins.length) return press(run.collectAll);
      if (stage === 'player' && KEY_ACTIONS[k]) return press(() => run.act(KEY_ACTIONS[k], barOrigin()));
      if (stage === 'insurance' && (k === 'i' || k === 'n')) return press(() => run.insure(k === 'i', barOrigin()));
      if (run.counting && run.assist.counter) {
        if (e.key === '=' || e.key === '+') return press(() => run.adjustCounter(2));
        if (e.key === '-' || e.key === '_') return press(() => run.adjustCounter(-2));
        if (run.system?.id === 'wong' && e.key === ']') return press(() => run.adjustCounter(1));
        if (run.system?.id === 'wong' && e.key === '[') return press(() => run.adjustCounter(-1));
      }
      // Enter with nothing focused triggers the main button of the current step.
      if (e.key === 'Enter' && (t === document.body || t === null)) {
        const primary = field.current?.querySelector<HTMLButtonElement>('.px-command .px-btn--primary');
        if (primary) press(() => primary.click());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (stage === 'report') {
    return (
      <div className="px-run is-report">
        <div className="px-report__bar"><ExitLink /><FullscreenButton /></div>
        <RunReport difficulty={difficulty} stats={run.stats} exposed={view.cardsExposed} total={view.totalCards} best={best} onAgain={onAgain} onBrief={onBrief} />
        <Coins coins={run.coins} onCollect={run.collect} onCollectAll={run.collectAll} />
      </div>
    );
  }

  const hand = view.hands[view.active];
  const announce = view.hands.length
    ? `Dealer: ${names(view.dealer)}. ${view.hands.length > 1 ? `Hand ${view.active + 1}` : 'You'}: ${hand ? `${names(hand.cards)}, ${evaluate(hand.cards).total}` : ''}.`
    : view.burned.length ? `Revealed: ${names(view.burned)}.` : '';

  return (
    <div className={`px-run tier-${tier}`}>
      <header className="px-top">
        <ExitLink compact />
        <div className="px-top__title">
          <p className="px-brand">Blackjack Ops</p>
          <p className="px-top__sub"><span className="px-chipline">{d.name}</span> {d.focus}</p>
        </div>
        <div className="px-modes" role="group" aria-label="Mode (switching starts a fresh run)">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((m) => (
            <button key={m} type="button" className="px-mode" aria-pressed={m === difficulty} onClick={() => {
              if (m === difficulty) return;
              // Nothing played yet: switch at once. Otherwise confirm, because the run is discarded.
              if (view.cardsExposed === 0 && view.roundNumber === 0) onSwitch(m); else setPendingMode(m);
            }}>{DIFFICULTIES[m].name}</button>
          ))}
        </div>
        <dl className="px-top__stats">
          <div><dt>Round</dt><dd>{view.roundNumber}</dd></div>
          <div><dt>Exposed</dt><dd>{view.cardsExposed}<span className="px-dim">/{view.totalCards}</span></dd></div>
          <div className="px-top__coins"><dt>Coins</dt><dd aria-label={`${run.bank} coins`}>{run.bank}</dd></div>
        </dl>
        <FullscreenButton />
      </header>
      <RotatePrompt />

      {pendingMode && (
        <div className="px-notice px-notice--confirm" role="alertdialog" aria-labelledby="px-switch-q">
          <span id="px-switch-q"><strong>Switch to {DIFFICULTIES[pendingMode].name}?</strong> This run ends and a fresh shoe starts: coins, flow, hints and progress reset.</span>
          <button type="button" className="px-btn px-btn--primary" autoFocus onClick={() => onSwitch(pendingMode)}>Start fresh</button>
          <button type="button" className="px-btn" onClick={() => setPendingMode(null)}>Keep playing</button>
        </div>
      )}

      {run.notice && (
        <div className="px-notice" role="status">
          <strong>{run.notice.title}.</strong> {run.notice.text}
          <button type="button" className="px-link" onClick={run.dismissNotice}>OK</button>
        </div>
      )}

      <div className={`px-grid${run.counting ? '' : ' is-solo'}`}>
        {run.counting && run.system && (
          <div className="px-left">
            <Drawer id="px-left-body" title="Count command" summary={run.assist.counter ? `RC ${formatCount2(run.counter2)}` : 'from memory'} defaultOpen>
              <CountPanel run={run} system={run.system} />
            </Drawer>
          </div>
        )}

        <div className="px-center">
          <FlowBar value={run.flow} reward={run.reward} />
          <ComboMeter combo={run.combo} broken={run.comboBroken} max={run.flow >= 100} />
          <div ref={field} className={`px-arena${tier >= 2 ? ' is-neon' : ''}${run.flow >= 100 ? ' is-max' : ''}${shake ? (settings.reduceMotion || settings.reduceFlashing ? ' is-miss-static' : ' is-miss') : ''}`}>
            <Battlefield run={run} reduceMotion={settings.reduceMotion} />
            {tier >= 2 && <TronBorder key={powerKey} id={powerKey} rainbow={run.milestone?.kind === 'rainbow'} max={run.flow >= 100} />}
            {run.milestone?.kind === 'rainbow' && <p key={run.milestone.id} className="px-perfect" role="status">Perfect flow!</p>}
          </div>
          <div className={`px-feed${run.feedback ? ` is-${run.feedback.tone}` : ''}`} role="status" aria-live="polite">
            {run.feedback ? <><strong>{run.feedback.title}</strong> {run.feedback.text}</> : <span className="px-dim">Decisions, counts and wagers are graded. Hand results are not.</span>}
          </div>
          <p className="visually-hidden" aria-live="polite">{announce}</p>
        </div>

        <div className="px-right">
          <DealerCard run={run} onAsk={openChart} />
          <Drawer id="px-right-body" title="Intel" summary={run.counting && run.assist.aces ? `aces ${view.acesSeen}` : 'rules'} defaultOpen={false}>
            <ResourcePanel run={run} aceTracking={settings.aceTracking} />
          </Drawer>
        </div>
      </div>

      <p className="px-tiny px-dim px-seed">Shoe seed {seed} (same seed, same shoe) · <button type="button" className="px-link" onClick={onBrief}>Abandon run</button></p>
      <Coins coins={run.coins} onCollect={run.collect} onCollectAll={run.collectAll} />
      <DealerDialog open={chart} run={run} rules={rules} onClose={closeChart} />
    </div>
  );
}
