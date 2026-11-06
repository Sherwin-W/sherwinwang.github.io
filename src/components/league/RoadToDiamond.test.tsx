import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import league from '../../data/league';
import type { RankView } from '../../league/api';
import RoadToDiamond, { sourceText } from './RoadToDiamond';

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const show = (view: RankView) => render(<RoadToDiamond view={view} />);
const tile = () => document.querySelector('.rank-ring') as HTMLElement;

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
    expect((tile().querySelector('.rank-ring__emblem') as HTMLImageElement).src).toMatch(/league\/emblems\/master\.webp$/);
  });

  it('draws the ring at the overall Iron IV to Diamond IV position, not the LP within the division', () => {
    show({ source: 'live', rank: { tier: 'GOLD', division: 'II', lp: 63 }, asOf: new Date().toISOString() });
    // Gold II 63 LP = (3*4 + 2 + .63) / 24 = 61%, not 63%.
    expect(tile().style.getPropertyValue('--p')).toBe(String(14.63 / 24));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('61');
    expect(screen.getByText('61% to Diamond IV')).toBeTruthy();
    // One tick per tier boundary between Iron and Diamond.
    expect(tile().querySelectorAll('.rank-ring__tick')).toHaveLength(5);
    expect((tile().querySelector('.rank-ring__emblem') as HTMLImageElement).src).toMatch(/league\/emblems\/gold\.webp$/);
    // Only the rank emblem: no champion portrait or match details.
    expect(tile().querySelectorAll('img')).toHaveLength(1);
  });

  it('shows no rank, emblem or progress when unranked or unavailable', () => {
    show({ source: 'unranked', rank: null, asOf: '2026-11-05T10:00:00Z' });
    expect(screen.getByText('Unranked')).toBeTruthy();
    expect(screen.getByText('No ranked games this season yet')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(tile().querySelector('.rank-ring__emblem')).toBeNull();
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
