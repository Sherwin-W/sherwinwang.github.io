import { useCallback, useRef, useState } from 'react';
import { applyAction, burn, newGame, nextRound, publicView, resolveInsurance, startRound, type Game, type PublicView } from '../engine/game';
import { ACTION_LABEL, categoryOf, decide, type Action, type Move } from '../engine/strategy';
import { describeHand, explain, type StrategyQuestion } from '../engine/drills';
import { upcardValue, type Card } from '../engine/cards';
import type { Rules } from '../engine/rules';
import { recordRound, recordStrategy, type Progress } from '../engine/stats';
import { formatCount2, parseCount2 } from '../engine/systems';
import {
  applyFlow, assistAvailable, bump, checkpointDue, dealerIsPaid, dropsCoin, emptyStats, expectedConversion, expectedWager, hintPrice,
  isCounting, isPlayDecision, milestoneFor, removedBetween, revealHint, settleGolden, stepCombo, emptyCombo, systemFor, toolList, trueCountFor, upcomingRemoval,
  type Combo, type Difficulty, type FlowKind, type FlowTier, type Milestone, type MistakeKind, type RunStats,
} from './run';
import { playSfx, type Sfx } from './sound';

export type Stage = 'betting' | 'checkpoint' | 'insurance' | 'player' | 'settled' | 'sprint' | 'report';
export type Tone = 'good' | 'bad' | 'info' | 'warn';
export interface Feedback { id: number; tone: Tone; title: string; text: string }
export interface Checkpoint { step: 'rc' | 'aces' | 'tc'; enteredRc2: number | null; final: boolean }
export interface CoinDrop { id: number; x: number; y: number; kind: 'flow' | 'gold' }
export interface Point { x: number; y: number }
export interface Settings { sound: boolean; reduceMotion: boolean; reduceFlashing: boolean; aceTracking: boolean }

/** What the dealer says for the decision in front of the player. Built only from public cards and the rules. */
export interface Advice { key: string; spot: string; action: string; move: Move | 'decline'; why: string }

/** Identifies one player decision: round, hand, cards in that hand, number of hands. */
export const decisionKey = (v: PublicView): string => `p:${v.roundNumber}:${v.active}:${v.hands[v.active]?.cards.length ?? 0}:${v.hands.length}`;

/** Cards exposed per sprint reveal. */
export const SPRINT_BATCH = 4;
/** The last checkpoint of a shoe comes before the final cards, while the answer is not trivially 0. */
export const FINAL_CHECK_AT = 8;

const ACTION_SFX: Record<Action, Sfx> = { hit: 'hit', stand: 'stand', double: 'double', split: 'split', surrender: 'surrender' };

interface Options {
  difficulty: Difficulty;
  rules: Rules;
  seed: number;
  settings: Settings;
  updateProgress: (fn: (p: Progress) => Progress) => void;
}

/**
 * One run's state. The run screen is keyed by run id, so a new run (restart, new shoe, mode switch)
 * mounts a fresh hook: coins, flow, hint prices, golden-card history, assistance and the shoe all start over.
 */
export function useRun({ difficulty, rules, seed, settings, updateProgress }: Options) {
  const counting = isCounting(difficulty);
  const system = systemFor(difficulty);
  // The full game (undealt cards, hole card, objective count) lives in a ref; state holds only the public view.
  const game = useRef<Game>(newGame(rules, seed, { endurance: true }));
  const [view, setView] = useState<PublicView>(() => publicView(game.current));
  const [stage, setStage] = useState<Stage>('betting');
  const [flow, setFlow] = useState(0);
  const flowRef = useRef(0);
  const [reward, setReward] = useState<{ tier: FlowTier; id: number } | null>(null);
  // Combo multiplier and border milestones. Refs keep updates atomic across fast events.
  const comboRef = useRef<Combo>(emptyCombo());
  const [combo, setCombo] = useState<Combo>(comboRef.current);
  /** Bumped when a live combo is broken by a mistake (plays the extinguish animation). */
  const [comboBroken, setComboBroken] = useState(0);
  const [milestone, setMilestone] = useState<{ kind: Milestone; id: number } | null>(null);
  const reached100 = useRef(false);
  const [pulse, setPulse] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notice, setNotice] = useState<Feedback | null>(null);
  const [stats, setStats] = useState<RunStats>(emptyStats);
  const [counter2, setCounter2] = useState(0);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [checkError, setCheckError] = useState('');
  const [coins, setCoins] = useState<CoinDrop[]>([]);
  const coinsRef = useRef<CoinDrop[]>([]);
  // Coins available to spend this run. Refs make collection and purchases atomic across fast events.
  const [bank, setBank] = useState(0);
  const bankRef = useRef(0);
  const paidRef = useRef(0);
  const [paidHints, setPaidHints] = useState(0);
  /** Decision keys whose advice has been revealed (free or bought). Revealing twice never charges twice. */
  const revealed = useRef(new Set<string>());
  const [revealedTick, setRevealedTick] = useState(0);
  const goldSettled = useRef(new Set<number>());
  const exposedRef = useRef(0);
  const lastCheckpoint = useRef(0);
  const finalChecked = useRef(false);
  const warnedAt = useRef(new Set<number>());
  const seq = useRef(1);
  const sound = settings.sound;

  const sfx = useCallback((s: Sfx) => playSfx(s, sound), [sound]);
  const say = (tone: Tone, title: string, text = '') => setFeedback({ id: seq.current++, tone, title, text });

  /** Objective running count × 2 for the difficulty's system. Private: used only to grade. */
  const objective2 = () => (system?.id === 'wong' ? game.current.tally.wong2 : game.current.tally.hiLo * 2);

  const publish = useCallback(() => {
    const before = exposedRef.current;
    const v = publicView(game.current);
    exposedRef.current = v.cardsExposed;
    setView(v);
    const gone = removedBetween(difficulty, before, v.cardsExposed);
    if (gone.length) {
      const paidNow = !dealerIsPaid(difficulty, before) && dealerIsPaid(difficulty, v.cardsExposed);
      setNotice({ id: seq.current++, tone: 'warn', title: 'Assistance offline', text: `${toolList(gone)} offline at ${v.cardsExposed} cards.${paidNow ? ' The dealer now charges coins for advice.' : ''} The engine keeps scoring the real count.` });
    } else {
      const soon = upcomingRemoval(difficulty, v.cardsExposed);
      if (soon && !warnedAt.current.has(soon.at)) {
        warnedAt.current.add(soon.at);
        setNotice({ id: seq.current++, tone: 'warn', title: 'Assistance warning', text: `The ${toolList(soon.tools)} ${soon.tools.length > 1 ? 'go' : 'goes'} offline at ${soon.at} exposed cards (${soon.inCards} to go).` });
      }
    }
    return v;
  }, [difficulty]);

  const spawnCoin = (at: Point | undefined, kind: CoinDrop['kind'], spread = 0) => {
    const id = seq.current++;
    const p = at ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const jitter = () => Math.round((Math.random() - 0.5) * 40);
    coinsRef.current = [...coinsRef.current, { id, kind, x: p.x + jitter() + spread * 34, y: p.y - 28 + jitter() }];
    setCoins(coinsRef.current);
  };

  /**
   * Applies one graded event: flow, combo, milestones and flow coins. Hand outcomes never reach this.
   * An advised correct decision changes nothing (no flow, no combo step); mistakes always count.
   */
  const grade = (kind: FlowKind, ok: boolean, at?: Point, coinEligible = false, assisted = false) => {
    if (!ok) { setPulse((n) => n + 1); sfx('bad'); }
    if (ok && assisted) return;
    const before = flowRef.current;
    const r = applyFlow(before, kind, ok);
    flowRef.current = r.value;
    setFlow(r.value);
    setStats((s) => ({ ...s, flowPeak: Math.max(s.flowPeak, r.value) }));
    if (r.to > r.from) { setReward({ tier: r.to, id: seq.current++ }); sfx('reward'); }

    const prev = comboRef.current;
    const nextCombo = stepCombo(prev, ok, r.value, isPlayDecision(kind));
    comboRef.current = nextCombo;
    setCombo(nextCombo);
    if (prev.count > 0 && nextCombo.count === 0) setComboBroken((n) => n + 1);
    setStats((s) => (nextCombo.best > s.comboBest ? { ...s, comboBest: nextCombo.best } : s));

    const m = milestoneFor(before, r.value, reached100.current);
    if (r.value >= 100) reached100.current = true;
    if (m) setMilestone({ kind: m, id: seq.current++ });

    if (coinEligible && dropsCoin(r.value, ok)) spawnCoin(at, 'flow');
  };

  /** Settles golden cards taking part in a decision (see settleGolden) and drops their coins. */
  const goldFor = (participants: readonly Card[], ok: boolean, assisted: boolean, at?: Point) => {
    const { settle, pay } = settleGolden(participants, goldSettled.current, ok, assisted);
    settle.forEach((g) => goldSettled.current.add(g));
    pay.forEach((_, i) => spawnCoin(at, 'gold', i + 1));
    if (pay.length) sfx('coin');
    return pay.length;
  };

  const mistake = (kind: MistakeKind, title: string, detail: string) => {
    setStats((s) => ({ ...s, mistakes: [...s.mistakes, { kind, round: game.current.roundNumber, title, detail }] }));
    say('bad', title, detail);
  };

  /** Where to go between rounds: a checkpoint, the next bet, the sprint, or the report. */
  const betweenRounds = (v: PublicView) => {
    if (v.shoeFinished) {
      if (!counting) { finish(); return; }
      setStage('sprint');
      say('info', 'Endurance sprint', `No full round is guaranteed to fit in the last ${v.cardsRemaining} cards, so hands stop here. Keep counting while the rest of the shoe is revealed.`);
      return;
    }
    if (checkpointDue(difficulty, v.cardsExposed, lastCheckpoint.current)) { openCheckpoint(false); return; }
    setStage('betting');
  };

  const openCheckpoint = (final: boolean) => {
    setCheckpoint({ step: 'rc', enteredRc2: null, final });
    setCheckError('');
    setStage('checkpoint');
  };

  const finish = () => {
    setStage('report');
    sfx('clear');
  };

  const onSettled = (g: Game) => {
    setStats((s) => ({ ...s, rounds: s.rounds + 1, net: s.net + g.net }));
    updateProgress((p) => recordRound(p, g.net));
    setStage('settled');
  };

  const afterEngine = (g: Game) => {
    publish();
    if (g.phase === 'insurance') setStage('insurance');
    else if (g.phase === 'settled') onSettled(g);
    else setStage('player');
  };

  // ---------- Ask the Dealer ----------

  /** The decision in front of the player right now, or null between decisions. */
  const currentAdvice = (): Advice | null => {
    const g = game.current;
    if (stage === 'insurance' && g.phase === 'insurance') {
      return { key: `i:${g.roundNumber}`, spot: `insurance against a dealer ace`, action: 'No insurance', move: 'decline', why: 'Insurance is a side bet that loses over time. Basic strategy always declines it, even with a blackjack.' };
    }
    if (stage !== 'player' || g.phase !== 'player') return null;
    const v = publicView(g);
    const h = v.hands[v.active];
    const up = g.dealer[0];
    const ctx = { canDouble: v.legal.includes('double'), canSplit: v.legal.includes('split'), canSurrender: v.legal.includes('surrender') };
    const decision = decide(h.cards, up, rules, ctx);
    const q: StrategyQuestion = { player: h.cards, upcard: up, category: categoryOf(h.cards, ctx.canSplit), ...ctx, decision, dependsOn: [] };
    return {
      key: decisionKey(v),
      spot: `${describeHand(q)} vs ${up.rank === 'A' ? 'A' : upcardValue(up)}`,
      action: ACTION_LABEL[decision.action], move: decision.move, why: explain(q),
    };
  };

  const paid = dealerIsPaid(difficulty, view.cardsExposed);
  const price = hintPrice(paidHints);
  const advice = currentAdvice();
  const adviceShown = advice !== null && revealed.current.has(advice.key);
  void revealedTick; // re-render trigger for `adviceShown`

  /** Reveals advice for the current decision through the pure ledger (atomic: refs are updated synchronously). */
  const revealAdvice = (): 'shown' | 'already' | 'insufficient' | 'none' => {
    const a = currentAdvice();
    if (!a) return 'none';
    const { ledger, result, cost } = revealHint({ bank: bankRef.current, paid: paidRef.current, revealed: revealed.current }, a.key, dealerIsPaid(difficulty, exposedRef.current));
    if (result === 'already' || result === 'insufficient') return result;
    bankRef.current = ledger.bank;
    paidRef.current = ledger.paid;
    revealed.current = new Set(ledger.revealed);
    setBank(ledger.bank);
    setPaidHints(ledger.paid);
    setStats((s) => (result === 'bought' ? { ...s, hintsPaid: s.hintsPaid + 1, coinsSpent: s.coinsSpent + cost } : { ...s, hintsFree: s.hintsFree + 1 }));
    setRevealedTick((n) => n + 1);
    return 'shown';
  };

  // ---------- Actions ----------

  const deal = (bet: number, at?: Point) => {
    if (stage !== 'betting' || game.current.phase !== 'betting') return;
    const g0 = game.current;
    if (counting) {
      const want = expectedWager(objective2(), publicView(g0).cardsRemaining);
      const ok = bet === want;
      grade('wager', ok, at);
      setStats((s) => ({ ...s, wagers: bump(s.wagers, ok) }));
      if (ok) say('good', `Wager on schedule: ${bet}`, 'The practice schedule is a drill, not a prediction of this hand.');
      else mistake('wager', `Wager off schedule: ${bet} → ${want}`, `At this true count the practice schedule asks for ${want} ${want === 1 ? 'unit' : 'units'}. ≤ +1 → 1, +2 → 2, +3 → 4, ≥ +4 → 6.`);
    } else {
      setFeedback(null);
    }
    game.current = startRound(g0, counting ? bet : 1);
    sfx('deal');
    afterEngine(game.current);
  };

  const insure = (take: boolean, at?: Point) => {
    const g = game.current;
    if (stage !== 'insurance' || g.phase !== 'insurance') return;
    const assisted = revealed.current.has(`i:${g.roundNumber}`);
    const ok = !take;
    grade('insurance', ok, at, true, assisted);
    const gold = goldFor([...g.hands[0].cards, g.dealer[0]], ok, assisted, at);
    setStats((s) => ({ ...s, insurance: bump(s.insurance, ok), assisted: s.assisted + (assisted ? 1 : 0) }));
    if (ok) say('good', 'Insurance declined', `Basic strategy never takes insurance.${gold ? ' Golden card bonus!' : ''}`);
    else mistake('insurance', 'Insurance taken', 'Basic strategy declines insurance: it is a side bet that loses over time. Counters take it only at high counts (an index play this trainer does not score).');
    game.current = resolveInsurance(g, take);
    afterEngine(game.current);
  };

  const act = (a: Action, at?: Point) => {
    const g = game.current;
    if (stage !== 'player' || g.phase !== 'player') return;
    const v = publicView(g);
    if (!v.legal.includes(a)) return;
    const info = currentAdvice()!;
    // Only the decision the player is looking at can be answered: a repeated callback that fires
    // before the screen updates would otherwise be graded as a second decision.
    if (info.key !== decisionKey(view)) return;
    const assisted = revealed.current.has(info.key);
    const h = v.hands[v.active];
    const up = g.dealer[0];
    const ctx = { canDouble: v.legal.includes('double'), canSplit: v.legal.includes('split'), canSurrender: v.legal.includes('surrender') };
    const decision = decide(h.cards, up, rules, ctx);
    const category = categoryOf(h.cards, ctx.canSplit);
    const q: StrategyQuestion = { player: h.cards, upcard: up, category, ...ctx, decision, dependsOn: [] };
    const ok = a === decision.action;
    grade('decision', ok, at, true, assisted);
    const gold = goldFor([...h.cards, up], ok, assisted, at);
    setStats((s) => ({ ...s, decisions: { ...s.decisions, [category]: bump(s.decisions[category], ok) }, assisted: s.assisted + (assisted ? 1 : 0) }));
    updateProgress((p) => recordStrategy(p, category, info.spot, ok));
    if (ok) say('good', `${ACTION_LABEL[a]}: correct${assisted ? ' (dealer advice)' : ''}`, `${info.spot}.${gold ? ` Golden card bonus: ${gold} ${gold === 1 ? 'coin' : 'coins'}!` : ''}`);
    else mistake('decision', `${info.spot}: ${ACTION_LABEL[decision.action]}, not ${ACTION_LABEL[a]}`, explain(q));
    game.current = applyAction(g, a);
    sfx(ACTION_SFX[a]);
    afterEngine(game.current);
  };

  const next = () => {
    if (stage !== 'settled' || game.current.phase !== 'settled') return;
    game.current = nextRound(game.current);
    betweenRounds(publish());
  };

  const reveal = () => {
    if (stage !== 'sprint' || game.current.phase === 'complete') return;
    const v = publicView(game.current);
    if (checkpointDue(difficulty, v.cardsExposed, lastCheckpoint.current)) { openCheckpoint(false); return; }
    if (!finalChecked.current && v.cardsRemaining <= FINAL_CHECK_AT && v.cardsRemaining > 0) { finalChecked.current = true; openCheckpoint(true); return; }
    game.current = burn(game.current, SPRINT_BATCH);
    sfx('deal');
    publish();
    if (game.current.phase === 'complete') finish();
  };

  const submitRunning = (text: string) => {
    if (!checkpoint || checkpoint.step !== 'rc') return;
    const v2 = parseCount2(text);
    if (v2 === null || (system?.id === 'hilo' && v2 % 2 !== 0)) { setCheckError(system?.id === 'wong' ? 'Enter a whole or half number, like +3 or −1.5.' : 'Enter a whole number, like +3 or −2.'); return; }
    setCheckError('');
    const truth = objective2();
    const ok = v2 === truth;
    grade('count', ok);
    setStats((s) => ({ ...s, counts: bump(s.counts, ok) }));
    if (ok) say('good', `Running count ${formatCount2(truth)}: correct`, '');
    else mistake('count', `Running count was ${formatCount2(truth)}, you said ${formatCount2(v2)}`, 'Re-sync to the real count and keep going. Missed cards most often come from fast dealer draws and split hands.');
    setCheckpoint({ ...checkpoint, step: settings.aceTracking ? 'aces' : 'tc', enteredRc2: v2 });
  };

  const submitAces = (text: string) => {
    if (!checkpoint || checkpoint.step !== 'aces') return;
    const n = Number(text.trim());
    if (text.trim() === '' || !Number.isInteger(n) || n < 0) { setCheckError('Enter how many aces you have seen, like 5.'); return; }
    setCheckError('');
    const truth = game.current.tally.aces;
    const ok = n === truth;
    grade('aces', ok);
    setStats((s) => ({ ...s, aces: bump(s.aces, ok) }));
    if (!ok) mistake('aces', `Aces seen: ${truth}, you said ${n}`, 'The ace side count is kept apart from the main count; aces still count −1 in the main count.');
    setCheckpoint({ ...checkpoint, step: 'tc' });
  };

  const submitTrue = (text: string) => {
    if (!checkpoint || checkpoint.step !== 'tc' || checkpoint.enteredRc2 === null) return;
    const t = text.trim().replace('−', '-').replace(/^\+/, '');
    if (!/^-?\d+$/.test(t)) { setCheckError('Enter a whole number, like +1 or −2 (truncate toward zero).'); return; }
    setCheckError('');
    const n = Number(t);
    const remaining = publicView(game.current).cardsRemaining;
    const want = expectedConversion(checkpoint.enteredRc2, remaining);
    const ok = n === want;
    grade('trueCount', ok);
    setStats((s) => ({ ...s, trueCounts: bump(s.trueCounts, ok) }));
    const decks = Math.max(0.5, Math.round((remaining / 52) * 2) / 2);
    if (ok) say('good', `True count ${want > 0 ? '+' : ''}${want}: correct`, `From your running count ${formatCount2(checkpoint.enteredRc2)} over about ${decks} decks.`);
    else mistake('trueCount', `True count ${want > 0 ? '+' : ''}${want}, not ${n > 0 ? '+' : ''}${n}`, `Your running count ${formatCount2(checkpoint.enteredRc2)} ÷ about ${decks} decks remaining, truncated toward zero.`);
    lastCheckpoint.current = publicView(game.current).cardsExposed;
    setCheckpoint(null);
    setStage(game.current.phase === 'sprint' || publicView(game.current).shoeFinished ? 'sprint' : 'betting');
  };

  /** Collects coins by id. A coin leaves the field before it is banked, so it can never be counted twice. */
  const takeCoins = (ids: number[]) => {
    const taken = coinsRef.current.filter((c) => ids.includes(c.id));
    if (taken.length === 0) return;
    coinsRef.current = coinsRef.current.filter((c) => !ids.includes(c.id));
    setCoins(coinsRef.current);
    const gold = taken.filter((c) => c.kind === 'gold').length;
    setStats((s) => ({ ...s, coins: s.coins + taken.length, goldCoins: s.goldCoins + gold }));
    bankRef.current += taken.length;
    setBank(bankRef.current);
    sfx('coin');
  };
  const collect = (id: number) => takeCoins([id]);
  const collectAll = () => takeCoins(coinsRef.current.map((c) => c.id));

  const adjustCounter = (step2: number) => setCounter2((n) => n + step2);
  const resetCounter = () => setCounter2(0);

  const assist = assistAvailable(difficulty, view.cardsExposed);
  /** Display only; the objective true count is never shown during play. */
  const calc = (rc2: number) => trueCountFor(rc2, view.cardsRemaining);

  return {
    view, stage, flow, reward, pulse, combo, comboBroken, milestone, feedback, notice, stats, counter2, checkpoint, checkError, coins, bank, assist, system, counting,
    dealer: { paid, price, paidHints, advice, adviceShown },
    deal, insure, act, next, reveal, submitRunning, submitAces, submitTrue, collect, collectAll, adjustCounter, resetCounter, calc, revealAdvice,
    dismissNotice: () => setNotice(null),
  };
}

export type RunApi = ReturnType<typeof useRun>;
