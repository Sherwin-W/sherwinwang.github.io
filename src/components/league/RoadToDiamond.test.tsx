import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import league from '../../data/league';
import type { RankView } from '../../league/api';
import RoadToDiamond, { sourceText } from './RoadToDiamond';

const WUKONG = { name: 'Wukong', icon: 'https://ddragon.leagueoflegends.com/cdn/16.22.1/img/champion/MonkeyKing.png', playedAt: new Date(Date.now() - 3600_000).toISOString() };

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const show = (view: RankView) => render(<RoadToDiamond view={view} />);
const tile = () => document.querySelector('.rank-gauge') as HTMLElement;

describe('Road to Diamond', () => {
  it('shows the current rank, LP and progress, labelled with where the data came from', () => {
    show({ source: 'manual', rank: { tier: 'GOLD', division: 'II', lp: 27 }, asOf: '2026-11-05' });
    expect(screen.getByText('Gold II')).toBeTruthy();
    expect(screen.getByText('27 LP')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Progress to Diamond IV' });
    expect(bar.getAttribute('aria-valuenow')).toBe('59');
    expect(bar.getAttribute('aria-valuetext')).toBe('Gold II, 27 LP: 59% of the way from Iron IV');
    expect(screen.getByText('Updated by hand · Nov 5, 2026')).toBeTruthy();
    expect(tile().style.getPropertyValue('--p')).toBe(String(14.27 / 24));
    expect(tile().dataset.source).toBe('manual');
  });

  it('links the whole card to the verified OP.GG profile in a safe new tab', () => {
    show({ source: 'manual', rank: { tier: 'GOLD', division: 'II', lp: 27 }, asOf: '2026-11-05' });
    const link = screen.getByRole('link', { name: /Road to Diamond.*OP\.GG, DippoBippo#cccc \(opens in a new tab\)/ });
    expect(link.getAttribute('href')).toBe('https://op.gg/lol/summoners/na/DippoBippo-cccc');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('shows goal completion at Diamond IV and keeps working above Diamond', () => {
    show({ source: 'live', rank: { tier: 'DIAMOND', division: 'IV', lp: 0 }, asOf: new Date().toISOString() });
    expect(tile().classList.contains('is-done')).toBe(true);
    expect(screen.getByText('Goal reached · Diamond IV')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Diamond IV, 0 LP: goal reached');
    cleanup();
    show({ source: 'live', rank: { tier: 'MASTER', lp: 210 }, asOf: new Date().toISOString() });
    expect(screen.getByText('Master')).toBeTruthy();
    expect(screen.getByText('210 LP')).toBeTruthy();
    expect(tile().style.getPropertyValue('--p')).toBe('1');
    expect((tile().querySelector('.rank-gauge__emblem') as HTMLImageElement).src).toMatch(/league\/emblems\/master\.webp$/);
  });

  it('fills the semicircle to the overall Iron IV to Diamond IV position, not the LP within the division', () => {
    show({ source: 'live', rank: { tier: 'GOLD', division: 'II', lp: 63 }, asOf: new Date().toISOString() });
    // Gold II 63 LP = (3*4 + 2 + .63) / 24 = 61%, not 63%. The centre label and the fill use the same number.
    expect(tile().style.getPropertyValue('--p')).toBe(String(14.63 / 24));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('61');
    expect(tile().querySelector('.rank-gauge__pct')!.textContent).toBe('61%');
    // A half-circle arc from bottom-left to bottom-right, with the track and the fill on the same path.
    const [track, fill] = ['.rank-gauge__track', '.rank-gauge__fill'].map((c) => tile().querySelector(c)!);
    expect(track.getAttribute('d')).toBe('M24 100 A76 76 0 0 1 176 100');
    expect(fill.getAttribute('d')).toBe(track.getAttribute('d'));
    expect(fill.getAttribute('pathLength')).toBe('100');
    expect(tile().querySelectorAll('.rank-gauge__tick')).toHaveLength(5);
    expect((tile().querySelector('.rank-gauge__emblem') as HTMLImageElement).src).toMatch(/league\/emblems\/gold\.webp$/);
  });

  it('puts the Iron and goal emblems under the two ends of the arc', () => {
    show({ source: 'live', rank: { tier: 'GOLD', division: 'II', lp: 63 }, asOf: new Date().toISOString() });
    const start = tile().querySelector('.rank-gauge__end--start')!;
    const end = tile().querySelector('.rank-gauge__end--goal')!;
    expect(start.textContent).toBe('Iron');
    expect(end.textContent).toBe('Diamond');
    expect(start.querySelector('img')!.getAttribute('src')).toMatch(/league\/emblems\/iron\.webp$/);
    expect(end.querySelector('img')!.getAttribute('src')).toMatch(/league\/emblems\/diamond\.webp$/);
  });

  it("shows Riot's last ranked champion, a hand-entered one only when labelled, and never a made-up one", () => {
    show({ source: 'live', rank: { tier: 'GOLD', division: 'II', lp: 63 }, asOf: new Date().toISOString(), champion: WUKONG });
    expect(screen.getByText('Last ranked champion')).toBeTruthy();
    expect(screen.getByText('Wukong')).toBeTruthy();
    expect(tile().querySelector('.rank-champ__img')!.getAttribute('src')).toBe(WUKONG.icon);
    cleanup();
    // No champion from the API and none configured: nothing is shown.
    show({ source: 'live', rank: { tier: 'GOLD', division: 'II', lp: 63 }, asOf: new Date().toISOString(), champion: null });
    expect(tile().querySelector('.rank-champ')).toBeNull();
    cleanup();
    show({ source: 'manual', rank: { tier: 'GOLD', division: 'II', lp: 27 }, asOf: '2026-11-05' });
    expect(tile().querySelector('.rank-champ')).toBeNull();
    cleanup();
    const config = { ...league, manualChampion: { name: 'Lee Sin', ddragonId: 'LeeSin', version: '16.22.1', checkedOn: '2026-11-05' } };
    render(<RoadToDiamond config={config} view={{ source: 'manual', rank: { tier: 'GOLD', division: 'II', lp: 27 }, asOf: '2026-11-05' }} />);
    expect(screen.getByText('Last ranked · set by hand')).toBeTruthy();
    expect(tile().querySelector('.rank-champ__img')!.getAttribute('src')).toBe('https://ddragon.leagueoflegends.com/cdn/16.22.1/img/champion/LeeSin.png');
    cleanup();
    // Riot's answer wins over the hand-entered one.
    render(<RoadToDiamond config={config} view={{ source: 'live', rank: { tier: 'GOLD', division: 'II', lp: 63 }, asOf: new Date().toISOString(), champion: WUKONG }} />);
    expect(screen.getByText('Wukong')).toBeTruthy();
    expect(screen.queryByText('Lee Sin')).toBeNull();
  });

  it('shows no rank, emblem or progress when unranked or unavailable', () => {
    show({ source: 'unranked', rank: null, asOf: '2026-11-05T10:00:00Z' });
    expect(screen.getByText('Unranked')).toBeTruthy();
    expect(screen.getByText('No ranked games this season yet')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(tile().querySelector('.rank-gauge__emblem')).toBeNull();
    expect(tile().classList.contains('is-empty')).toBe(true);
    expect(tile().style.getPropertyValue('--p')).toBe('0');
    cleanup();
    show({ source: 'unavailable', rank: null, asOf: null });
    expect(screen.getByText('Rank unavailable right now')).toBeTruthy();
    expect(screen.queryByText(/LP/)).toBeNull();
  });

  it('says when a rank is live, saved from earlier, or still loading', () => {
    const asOf = new Date(Date.now() - 20 * 60_000).toISOString();
    expect(sourceText({ source: 'live', rank: null, asOf })).toBe('Live from Riot · 20 minutes ago');
    expect(sourceText({ source: 'cached', rank: null, asOf })).toBe('Saved rank · Riot last answered 20 minutes ago');
    expect(sourceText({ source: 'loading', rank: null, asOf: null })).toBe('Checking rank…');
  });

  it('asks the API once, then shows its answer, or the manual rank if it fails', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ranked: true, tier: 'PLATINUM', division: 'IV', lp: 3, fetchedAt: new Date().toISOString(), stale: false }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    render(<RoadToDiamond apiBaseUrl="https://api.example" config={{ ...league, mode: 'live' }} />);
    expect(screen.getByText('Checking rank…')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Platinum IV')).toBeTruthy());
    expect(screen.getByText(/^Live from Riot/)).toBeTruthy();
    expect(f).toHaveBeenCalledTimes(1);
    cleanup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"unavailable"}', { status: 502 })));
    render(<RoadToDiamond apiBaseUrl="https://api.example" config={{ ...league, mode: 'live', manual: { tier: 'SILVER', division: 'I', lp: 80, checkedOn: '2026-10-01' } }} />);
    await waitFor(() => expect(screen.getByText('Silver I')).toBeTruthy());
    expect(screen.getByText('Updated by hand · Oct 1, 2026')).toBeTruthy();
  });
});
