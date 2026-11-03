import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { newGame, startRound } from '../engine/game';
import { DEFAULT_RULES } from '../engine/rules';
import { emptyProgress } from '../engine/stats';
import StrategyChart from '../ui/StrategyChart';
import Campaign from './Campaign';
import RunScreen from './RunScreen';
import type { Difficulty } from './run';
import type { Settings } from './useRun';

afterEach(() => { cleanup(); localStorage.clear(); });

const api = () => ({ progress: emptyProgress(), update: vi.fn(), reset: vi.fn() });
const SETTINGS: Settings = { sound: false, reduceMotion: false, reduceFlashing: false, aceTracking: false };

/** First seed whose opening round reaches the given phase under the default rules. */
function seedWhere(phase: 'player' | 'insurance'): number {
  for (let s = 1; s < 5000; s++) if (startRound(newGame(DEFAULT_RULES, s, { endurance: true }), 1).phase === phase) return s;
  throw new Error('no seed');
}

function setup(difficulty: Difficulty, opts: { seed?: number; settings?: Partial<Settings> } = {}) {
  const utils = render(
    <RunScreen difficulty={difficulty} rules={DEFAULT_RULES} seed={opts.seed ?? seedWhere('player')} settings={{ ...SETTINGS, ...opts.settings }}
      api={api()} best={null} onComplete={vi.fn()} onAgain={vi.fn()} onSwitch={vi.fn()} onBrief={vi.fn()} />,
  );
  const playerCards = () => utils.container.querySelectorAll('.px-seat .px-card').length;
  const readout = () => utils.container.querySelector('.px-readout')?.textContent;
  const key = (k: string, target: Element = document.body) => fireEvent.keyDown(target, { key: k });
  return { ...utils, playerCards, readout, key };
}

describe('keyboard play', () => {
  it('ignores action keys before the deal, then H hits during the player turn', () => {
    const t = setup('recruit');
    t.key('h');
    expect(t.playerCards()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /^Deal/ }));
    expect(screen.getAllByRole('img', { name: 'Face-down card' })).toHaveLength(1);
    expect(t.playerCards()).toBe(2);
    t.key('h');
    expect(t.playerCards()).toBe(3);
    expect(document.querySelector('.px-feed')!.textContent).toMatch(/correct|Mistake|, not /i);
  });

  it('shortcuts are ignored while typing in a field and while the strategy dialog is open', () => {
    const t = setup('operator');
    fireEvent.click(screen.getByRole('button', { name: /^Deal/ }));
    const before = t.playerCards();
    t.key('?');
    const dialog = document.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    t.key('h');
    expect(t.playerCards()).toBe(before);
    fireEvent.click(within(dialog).getByRole('button', { name: /Close/ }));
    expect(dialog.open).toBe(false);
    t.key('h');
    expect(t.playerCards()).toBe(before + 1);
  });

  it('insurance: action keys do nothing, N declines and is graded correct', () => {
    const t = setup('recruit', { seed: seedWhere('insurance') });
    fireEvent.click(screen.getByRole('button', { name: /^Deal/ }));
    expect(screen.getByRole('button', { name: /No insurance/ })).toBeTruthy();
    t.key('s');
    expect(screen.getByRole('button', { name: /No insurance/ })).toBeTruthy();
    t.key('n');
    expect(screen.queryByRole('button', { name: /No insurance/ })).toBeNull();
    expect(document.querySelector('.px-feed')!.textContent).toMatch(/Insurance declined/);
  });
});

describe('manual counter', () => {
  it('Hi-Lo: = and - step by one, half steps are not available', () => {
    const t = setup('operator');
    expect(t.readout()).toBe('0');
    t.key('='); t.key('=');
    expect(t.readout()).toBe('+2');
    t.key('-'); t.key('-'); t.key('-');
    expect(t.readout()).toBe('−1');
    t.key(']');
    expect(t.readout()).toBe('−1');
    expect(screen.queryByRole('button', { name: 'Add 0.5' })).toBeNull();
  });

  it('Wong Halves: ±0.5, ±1 and ±1.5 buttons, and ] [ keys for halves', () => {
    const t = setup('grandmaster');
    t.key(']');
    expect(t.readout()).toBe('+0.5');
    fireEvent.click(screen.getByRole('button', { name: 'Add 1.5' }));
    expect(t.readout()).toBe('+2');
    fireEvent.click(screen.getByRole('button', { name: 'Subtract 0.5' }));
    t.key('[');
    expect(t.readout()).toBe('+1');
  });

  it('typing in an input does not trigger the counter', () => {
    const t = setup('operator');
    const input = document.createElement('input');
    document.body.appendChild(input);
    t.key('=', input);
    expect(t.readout()).toBe('0');
    input.remove();
  });

  it('Recruit has no counting panel', () => {
    const t = setup('recruit');
    expect(t.readout()).toBeUndefined();
    expect(screen.queryByText(/Count command/)).toBeNull();
  });
});

describe('motion', () => {
  it('staggers newly dealt cards, and uses no delay with reduced motion', () => {
    const a = setup('recruit');
    fireEvent.click(screen.getByRole('button', { name: /^Deal/ }));
    const delays = [...a.container.querySelectorAll<SVGElement>('.px-card')].map((el) => el.style.animationDelay);
    expect(delays.some((d) => d !== '0ms')).toBe(true);
    cleanup();
    const b = setup('recruit', { settings: { reduceMotion: true } });
    fireEvent.click(screen.getByRole('button', { name: /^Deal/ }));
    const reduced = [...b.container.querySelectorAll<SVGElement>('.px-card')].map((el) => el.style.animationDelay);
    expect(reduced.every((d) => d === '0ms')).toBe(true);
  });

  it('the briefing option adds the reduced-motion class to the game', () => {
    const { container } = render(<Campaign rules={DEFAULT_RULES} api={api()} onOpenRules={vi.fn()} onPlaying={vi.fn()} />);
    expect(container.querySelector('.px-reduce-motion')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reduce motion' }));
    expect(container.querySelector('.px-reduce-motion')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('blackjack-settings-v1')!).reduceMotion).toBe(true);
  });
});

describe('strategy chart', () => {
  it('shows hard 17 on its own row: surrender vs an ace under H17, while 18+ always stands', () => {
    render(<StrategyChart rules={DEFAULT_RULES} />);
    const table = screen.getByRole('table', { name: /Hard totals/ });
    const cellVsAce = (row: string) => within(within(table).getByRole('row', { name: new RegExp(`^${row}`) })).getAllByRole('cell').at(-1)!.textContent;
    expect(cellVsAce('17')).toMatch(/Surrender, otherwise stand/);
    expect(cellVsAce('18\\+')).toMatch(/^S/);
    expect(cellVsAce('18\\+')).not.toMatch(/Surrender/);
  });
});
