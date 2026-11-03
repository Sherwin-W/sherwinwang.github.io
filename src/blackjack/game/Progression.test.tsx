import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Card, Rank, Suit } from '../engine/cards';
import { newGame, startRound } from '../engine/game';
import { DEFAULT_RULES } from '../engine/rules';
import { emptyProgress } from '../engine/stats';
import { decide, type Action } from '../engine/strategy';
import Blackjack from '../ui/Blackjack';

// The site theme module reads matchMedia on import; jsdom has none.
vi.hoisted(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});
import Campaign from './Campaign';

afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState(null, '', '/'); });

const api = () => ({ progress: emptyProgress(), update: vi.fn(), reset: vi.fn() });
const RANK: Record<string, Rank> = { Ace: 'A', Two: '2', Three: '3', Four: '4', Five: '5', Six: '6', Seven: '7', Eight: '8', Nine: '9', Ten: '10', Jack: 'J', Queen: 'Q', King: 'K' };
const SUIT: Record<string, Suit> = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' };
const toCard = (label: string): Card => { const [r, , s] = label.split(/[ ,]/); return { rank: RANK[r], suit: SUIT[s] }; };
const KEYS: Record<Action, string> = { hit: 'h', stand: 's', double: 'd', split: 'p', surrender: 'r' };

const DECISION = '.px-actions[aria-label^="Your decision"]';
const key = (k: string) => fireEvent.keyDown(document.body, { key: k });
const btn = (name: RegExp) => screen.queryByRole('button', { name });
const flow = () => Number(screen.getByRole('meter', { name: 'Flow' }).getAttribute('aria-valuenow'));
const bank = () => Number(document.querySelector('.px-top__coins dd')!.textContent);
const exposed = () => Number(document.querySelector('.px-top__stats div:nth-child(2) dd')!.textContent!.split('/')[0]);

/** The legal actions and the basic-strategy play for the hand on screen. */
function spot() {
  const up = toCard(document.querySelector('.px-side--dealer svg[role="img"]')!.getAttribute('aria-label')!);
  const cards = [...document.querySelectorAll('.px-seat.is-active svg[role="img"]')].map((e) => toCard(e.getAttribute('aria-label')!));
  const legal = [...document.querySelectorAll<HTMLButtonElement>(`${DECISION} button`)].filter((b) => !b.disabled).map((b) => b.textContent!.trim().split(' ')[0].toLowerCase() as Action);
  const d = decide(cards, up, DEFAULT_RULES, { canDouble: legal.includes('double'), canSplit: legal.includes('split'), canSurrender: legal.includes('surrender') });
  return { right: d.action, legal };
}

/** One step of play. `mode` picks the basic-strategy play, a wrong play, or always stand. */
function step(mode: 'right' | 'wrong' | 'stand') {
  if (document.querySelector('#px-cp')) { fireEvent.change(document.querySelector('#px-cp')!, { target: { value: '0' } }); fireEvent.submit(document.querySelector('#px-cp')!.closest('form')!); return; }
  const notice = document.querySelector('.px-notice:not(.px-notice--confirm) button');
  if (notice) { fireEvent.click(notice); return; }
  for (const [name, k] of [[/^Deal/, null], [/Next round/, null], [/No insurance/, 'n'], [/Reveal next/, null]] as const) {
    const b = btn(name);
    if (b) { if (k) key(k); else fireEvent.click(b); return; }
  }
  if (!document.querySelector(DECISION)) return;
  const { right, legal } = spot();
  const a = mode === 'stand' ? 'stand' : mode === 'right' ? right : legal.find((x) => x !== right)!;
  key(KEYS[a]);
}

function deploy(mode: 'Recruit' | 'Operator' | 'Grandmaster', seed = 57) {
  window.history.replaceState(null, '', `/?seed=${seed}`);
  render(<Campaign rules={DEFAULT_RULES} api={api()} onOpenRules={vi.fn()} onPlaying={vi.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(mode) }));
  fireEvent.click(screen.getByRole('button', { name: /Deploy/ }));
}

describe('difficulty switching', () => {
  it('works on the first click and the HUD matches the mode', () => {
    deploy('Operator');
    expect(document.querySelector('.px-left .px-readout')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Operator' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Hi-Lo' })).toBeTruthy();
  });

  it('keeps the selected mode when the player visits another tab and comes back', () => {
    render(<Blackjack />);
    fireEvent.click(screen.getByRole('radio', { name: /Grandmaster/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Manual' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign' }));
    expect(screen.getByRole('radio', { name: /Grandmaster/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Deploy/ }));
    expect(screen.getByRole('heading', { name: 'Wong Halves' })).toBeTruthy();
  });

  it('switching during a run asks first, then starts fresh: every transition updates the HUD', () => {
    deploy('Recruit');
    const order = ['Operator', 'Grandmaster', 'Recruit', 'Grandmaster', 'Operator', 'Recruit'] as const;
    for (const m of order) {
      for (let i = 0; i < 6; i++) step('stand');
      fireEvent.click(screen.getByRole('button', { name: m }));
      fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
      expect(screen.getByRole('button', { name: m }).getAttribute('aria-pressed')).toBe('true');
      expect(exposed()).toBe(0);
      expect(flow()).toBe(0);
      expect(document.querySelector('.px-left') !== null).toBe(m !== 'Recruit');
      if (m === 'Grandmaster') expect(screen.getByRole('heading', { name: 'Wong Halves' })).toBeTruthy();
      if (m === 'Operator') expect(screen.getByRole('heading', { name: 'Hi-Lo' })).toBeTruthy();
    }
  });

  it('“Keep playing” cancels the switch without touching the run', () => {
    deploy('Operator');
    for (let i = 0; i < 4; i++) step('stand');
    const seen = exposed();
    fireEvent.click(screen.getByRole('button', { name: 'Recruit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(exposed()).toBe(seen);
    expect(screen.getByRole('button', { name: 'Operator' }).getAttribute('aria-pressed')).toBe('true');
  });
});

/** First seed whose opening decision involves a golden card the player can see. */
function goldenSeed(): number {
  for (let s = 1; s < 5000; s++) {
    const g = startRound(newGame(DEFAULT_RULES, s, { endurance: true }), 1);
    if (g.phase === 'player' && [...g.hands[0].cards, g.dealer[0]].some((c) => c.gold !== undefined)) return s;
  }
  throw new Error('none');
}

describe('run isolation, golden cards and coins', () => {
  it('a correct decision on a golden card pays one coin, once; a new run resets coins and flow', () => {
    deploy('Recruit', goldenSeed());
    step('right'); // Deal
    expect(document.querySelectorAll('.px-card.is-golden').length).toBeGreaterThan(0);
    step('right');
    expect(document.querySelectorAll('.px-coin.is-gold').length).toBeGreaterThanOrEqual(1);
    const coin = document.querySelector<HTMLButtonElement>('.px-coin')!;
    const dropped = document.querySelectorAll('.px-coin').length;
    fireEvent.click(coin);
    fireEvent.click(coin); // the same coin cannot be collected twice
    expect(bank()).toBe(1);
    key('c'); key('c');
    expect(bank()).toBe(dropped);
    expect(flow()).toBeGreaterThan(0);
    // Same golden card in the next decision of the hand (if any) does not pay again.
    const before = bank();
    if (document.querySelector(DECISION)) { step('right'); key('c'); }
    expect(bank() - before).toBeLessThanOrEqual(document.querySelectorAll('.px-seat .px-card.is-golden').length);
    // Starting fresh (mode switch) resets coins, flow and hint prices.
    fireEvent.click(screen.getByRole('button', { name: 'Operator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
    expect(bank()).toBe(0);
    expect(flow()).toBe(0);
    expect(document.querySelector('.px-price')!.textContent).toBe('Free');
  });

  it('a wrong decision on a golden card pays nothing, and the card stays settled', () => {
    deploy('Recruit', goldenSeed());
    step('right');
    step('wrong');
    expect(document.querySelectorAll('.px-coin').length).toBe(0);
  });

  it('abandon and redeploy is a new run too', () => {
    deploy('Recruit', goldenSeed());
    step('right'); step('right'); key('c');
    expect(bank()).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Abandon run' }));
    fireEvent.click(screen.getByRole('button', { name: /Deploy/ }));
    expect(bank()).toBe(0);
    expect(flow()).toBe(0);
  });
});

describe('flow rewards', () => {
  it('thumbs-up from 25, IN THE FLOW with cats and a rainbow bar from 75, gone again below 75', () => {
    deploy('Recruit', 7);
    let guard = 0;
    while (flow() < 75 && guard++ < 400) step('right');
    expect(flow()).toBeGreaterThanOrEqual(75);
    expect(screen.getByRole('img', { name: /Thumbs up/ })).toBeTruthy();
    expect(screen.getByText('IN THE FLOW!')).toBeTruthy();
    expect(document.querySelectorAll('.px-cat').length).toBe(2);
    expect(document.querySelector('.px-flowbar.tier-3')).not.toBeNull();
    expect(document.querySelector('.px-arena.is-neon')).not.toBeNull();
    while (!document.querySelector(DECISION) && guard++ < 400) step('right');
    step('wrong');
    expect(flow()).toBeLessThan(75);
    expect(screen.queryByText('IN THE FLOW!')).toBeNull();
    expect(document.querySelector('.px-flowbar.tier-3')).toBeNull();
    expect(document.querySelectorAll('.px-cat').length).toBe(0);
  });
});

describe('assistance offline and the paid dealer', () => {
  it('counter + calculator offline at 100, aces at 150; panels stay but are inert; dealer free before 150 then paid', () => {
    deploy('Operator', 11);
    // Free advice before 150: reveal once, reopening does not charge.
    while (!document.querySelector(DECISION)) step('stand');
    fireEvent.click(screen.getByRole('button', { name: /Ask the dealer/ }));
    const dialog = document.querySelector('dialog')!;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell me (free)' }));
    expect(within(dialog).getByText(/Basic strategy:/).textContent).toMatch(/Hit|Stand|Double|Split|Surrender/);
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ask the dealer/ }));
    expect(within(dialog).queryByRole('button', { name: /Tell me/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }));

    let guard = 0;
    while (exposed() < 100 && guard++ < 2000) step('stand');
    act(() => {});
    const offline = [...document.querySelectorAll('.px-assist.is-offline')];
    expect(offline.length).toBe(2);
    offline.forEach((el) => expect(el.querySelector('.px-assist__body')!.hasAttribute('inert')).toBe(true));
    expect(screen.getAllByText('OFFLINE').length).toBe(2);
    const plus = document.querySelector<HTMLButtonElement>('.px-btn--step.is-plus')!;
    expect(plus).not.toBeNull(); // still in the layout
    expect(plus.disabled).toBe(true);
    key('=');
    expect(document.querySelector('.px-readout')!.textContent).toBe('0');
    expect(document.querySelectorAll('.px-assist.is-offline .px-pips').length).toBe(0); // aces still on

    while (exposed() < 150 && guard++ < 4000) step('stand');
    expect(document.querySelectorAll('.px-assist.is-offline').length).toBe(3);
    expect(document.querySelectorAll('.px-assist.is-offline .px-pips').length).toBe(1);
    // Paid now: price 1 coin, and with an empty purse the purchase is refused.
    while (!document.querySelector(DECISION) && guard++ < 4000) step('stand');
    // Coins were never collected (standing on every hand drops at most uncollected golden coins), so the purse is empty.
    expect(bank()).toBe(0);
    expect(document.querySelector('.px-price')!.textContent).toBe('1 coin');
    fireEvent.click(screen.getByRole('button', { name: /Ask the dealer/ }));
    const pay = within(dialog).getByRole('button', { name: /Pay 1 coin/ }) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    expect(within(dialog).getByText(/Not enough coins/)).toBeTruthy();
    expect(within(dialog).queryByText(/Basic strategy:/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }));
    // Collect whatever golden coins dropped; if there are any, a purchase goes through for exactly 1 and is not re-charged.
    key('c');
    if (bank() > 0) {
      const had = bank();
      fireEvent.click(screen.getByRole('button', { name: /Ask the dealer/ }));
      fireEvent.click(within(dialog).getByRole('button', { name: /Pay 1 coin/ }));
      expect(bank()).toBe(had - 1);
      expect(within(dialog).getByText(/Basic strategy:/)).toBeTruthy();
      fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }));
      fireEvent.click(screen.getByRole('button', { name: /Ask the dealer/ }));
      expect(bank()).toBe(had - 1);
      expect(document.querySelector('.px-price')!.textContent).toBe('Paid');
    }
  });
});

describe('combo multiplier, Tron border and the 100% easter egg', () => {
  const comboEl = () => document.querySelector('.px-combo')!;
  const count = () => Number(comboEl().getAttribute('data-count'));
  const tron = () => document.querySelector('.px-tron');

  /** Plays correct decisions until `until` holds, returning the snapshots seen at each decision. */
  function playRight(until: () => boolean, max = 600) {
    const seen: { flow: number; count: number; stage: string; tronKey: string | null }[] = [];
    for (let i = 0; i < max && !until(); i++) {
      const wasDecision = !!document.querySelector(DECISION);
      step('right');
      if (wasDecision) seen.push({ flow: flow(), count: count(), stage: comboEl().getAttribute('data-stage')!, tronKey: tron()?.parentElement ? (tron() as Element).outerHTML.length.toString() : null });
    }
    return seen;
  }

  it('locked below 50%, unlocks at 50%, grows the fire 1–5, overdrive from 10×, rainbow at 100% once per run', () => {
    deploy('Recruit', 7);
    expect(comboEl().textContent).toMatch(/unlocks at 50% flow/);
    expect(tron()).toBeNull();
    const seen = playRight(() => flow() >= 50);
    seen.filter((s) => s.flow < 50).forEach((s) => expect(s.count).toBe(0));
    expect(comboEl().classList.contains('is-active')).toBe(true);
    expect(screen.getByRole('img', { name: 'multiplier 1 times' })).toBeTruthy();
    expect(comboEl().textContent).toMatch(/Multiplier/);
    expect(screen.queryByText(/Neon online/i)).toBeNull();
    // The power-up border mounted once, on the crossing; it is not re-created by later decisions.
    const firstTron = tron()!;
    expect(firstTron.classList.contains('is-rainbow')).toBe(false);
    expect(document.querySelector('.px-tron__run')).not.toBeNull();
    const stages: string[] = [comboEl().getAttribute('data-stage')!];
    while (count() < 5) { playRight(() => !!document.querySelector(DECISION), 20); step('right'); stages.push(comboEl().getAttribute('data-stage')!); }
    expect([...new Set(stages)].slice(0, 5)).toEqual(['1', '2', '3', '4', '5']);
    expect(document.querySelectorAll('.px-fire .px-fire__f')).toHaveLength(4); // animated frames, not a static glyph
    expect(document.querySelectorAll('.px-embers i').length).toBe(3);
    // 100% arrives before 10×: the rainbow sequence plays once.
    while (flow() < 100) { playRight(() => !!document.querySelector(DECISION), 20); step('right'); }
    expect(tron()!.classList.contains('is-rainbow')).toBe(true);
    expect(tron()!.classList.contains('is-max')).toBe(true);
    expect(document.querySelector('.px-arena.is-max')).not.toBeNull();
    expect(comboEl().classList.contains('is-max')).toBe(true);
    expect(screen.getByText(/Perfect flow/)).toBeTruthy();
    expect(screen.getByText('IN THE FLOW!')).toBeTruthy(); // 75% effects still there
    expect(document.querySelectorAll('.px-cat')).toHaveLength(2);
    const rainbowTron = tron();
    while (count() < 10) { playRight(() => !!document.querySelector(DECISION), 20); step('right'); }
    expect(comboEl().classList.contains('is-overdrive')).toBe(true);
    expect(comboEl().getAttribute('data-stage')).toBe('6');
    expect(screen.getByText(/Combo overdrive/i)).toBeTruthy();
    expect(tron()).toBe(rainbowTron); // staying at 100% never replays the sequence
    // A mistake: extinguish, reset, back below 100 → normal styling.
    playRight(() => !!document.querySelector(DECISION), 20);
    step('wrong');
    expect(count()).toBe(0);
    expect(flow()).toBeLessThan(100);
    expect(document.querySelector('.px-fire.is-out')).not.toBeNull();
    expect(comboEl().classList.contains('is-overdrive')).toBe(false);
    expect(comboEl().classList.contains('is-max')).toBe(false);
    expect(tron()!.classList.contains('is-max')).toBe(false);
    expect(document.querySelector('.px-arena.is-max')).toBeNull();
    // Back to 100% again: rainbow styling returns without a new Perfect-flow sequence.
    const before = tron();
    while (flow() < 100) { playRight(() => !!document.querySelector(DECISION), 20); step('right'); }
    expect(tron()).toBe(before);
    expect(tron()!.classList.contains('is-max')).toBe(true);
    // A new run resets the combo and the easter egg.
    fireEvent.click(screen.getByRole('button', { name: 'Operator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
    expect(count()).toBe(0);
    expect(comboEl().classList.contains('is-active')).toBe(false);
    expect(tron()).toBeNull();
    expect(screen.queryByText(/Perfect flow/)).toBeNull();
  });

  it('falling below 50% resets and hides the combo and the border', () => {
    deploy('Recruit', 7);
    playRight(() => flow() >= 60);
    expect(count()).toBeGreaterThan(0);
    while (flow() >= 50) { playRight(() => !!document.querySelector(DECISION), 20); step('wrong'); }
    expect(comboEl().classList.contains('is-active')).toBe(false);
    expect(count()).toBe(0);
    expect(tron()).toBeNull();
  });

  it('a duplicate key press in the same tick is graded once', () => {
    deploy('Recruit', 7);
    playRight(() => flow() >= 50 && !!document.querySelector(DECISION));
    const cards = document.querySelectorAll('.px-seat.is-active .px-card').length;
    const c0 = count(), f0 = flow();
    const { right } = spot();
    act(() => { key(KEYS[right]); key(KEYS[right]); key(KEYS[right]); });
    expect(count()).toBe(c0 + 1);
    expect(flow()).toBe(Math.min(100, f0 + 6));
    if (right === 'hit') expect(document.querySelectorAll('.px-seat .px-card').length).toBe(cards + 1);
  });
});
