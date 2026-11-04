import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import SpotifyLastPlayed from './SpotifyLastPlayed';
import { parseLastPlayed, relativeTime } from './api';

const ID = '3AJwUDP919kvQ9QcozQPxg';
const payload = (over: object = {}) => ({
  track: { id: ID, title: 'Yellow', artists: ['Coldplay'], album: 'Parachutes', albumArt: 'https://i.scdn.co/image/a', spotifyUrl: 'x', embedUrl: 'https://evil.example/embed', durationMs: 266773 },
  isCurrentlyPlaying: false, playedAt: '2026-11-01T18:30:00Z', updatedAt: '2026-11-01T20:16:00Z', ...over,
});
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('parseLastPlayed', () => {
  it('rebuilds links from the id instead of trusting the payload', () => {
    const d = parseLastPlayed(payload())!;
    expect(d.track.embedUrl).toBe(`https://open.spotify.com/embed/track/${ID}`);
    expect(d.track.spotifyUrl).toBe(`https://open.spotify.com/track/${ID}`);
  });
  it('rejects bad ids and non-Spotify art', () => {
    expect(parseLastPlayed(payload({ track: { ...payload().track, id: '../x' } }))).toBeNull();
    expect(parseLastPlayed(payload({ track: { ...payload().track, albumArt: 'https://evil.example/a.png' } }))!.track.albumArt).toBeNull();
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-11-01T20:00:00Z');
  it.each([['2026-11-01T19:59:30Z', 'just now'], ['2026-11-01T19:30:00Z', '30 minutes ago'], ['2026-11-01T18:00:00Z', '2 hours ago'], ['2026-10-30T20:00:00Z', '2 days ago']])('%s', (iso, text) => expect(relativeTime(iso, now)).toBe(text));
});

describe('<SpotifyLastPlayed>', () => {
  it('shows a skeleton, then the last played track with a matching embed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(payload())));
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeTruthy();
    expect(await screen.findByText('Yellow')).toBeTruthy();
    expect(screen.getByText('Last played on Spotify')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull(); // no third-party player until the visitor asks
    expect(screen.getByRole('button', { name: 'Play Yellow with Spotify' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Yellow/ }).getAttribute('href')).toBe(`https://open.spotify.com/track/${ID}`);
  });
  it('shows the now listening state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(payload({ isCurrentlyPlaying: true, playedAt: null }))));
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    expect(await screen.findByText('Now listening')).toBeTruthy();
  });
  it('shows an error with retry when the API fails and nothing is cached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 502 })));
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    expect(await screen.findByText('Spotify is unavailable right now.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
  it('keeps showing the browser-cached track when the API fails', async () => {
    localStorage.setItem('spotify-last-played', JSON.stringify(payload()));
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    expect(await screen.findByText('Yellow')).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText('Spotify is unavailable right now.')).toBeNull();
  });
});

describe('honest live status (Codex finding 1)', () => {
  it('drops “Now listening” when a later refresh fails, keeping the track as a saved one', async () => {
    let fail = false;
    vi.stubGlobal('fetch', vi.fn(async () => (fail ? new Response('{}', { status: 503 }) : ok(payload({ isCurrentlyPlaying: true, playedAt: null, updatedAt: new Date().toISOString() })))));
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    expect(await screen.findByText('Now listening')).toBeTruthy();
    fail = true;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await waitFor(() => expect(screen.queryByText('Now listening')).toBeNull());
    expect(screen.getByText('Last played on Spotify')).toBeTruthy();
    expect(screen.getByText('Showing saved track')).toBeTruthy();
    expect(screen.getByText('just now')).toBeTruthy(); // when it was last seen playing
    expect(screen.getByText('Yellow')).toBeTruthy();
  });

  it('never shows a browser-restored track as “Now listening” before the API confirms it', async () => {
    localStorage.setItem('spotify-last-played', JSON.stringify(payload({ isCurrentlyPlaying: true, playedAt: null })));
    let resolve!: (r: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { resolve = r; })));
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    expect(screen.getByText('Yellow')).toBeTruthy();
    expect(screen.queryByText('Now listening')).toBeNull();
    expect(screen.getByText('Showing saved track')).toBeTruthy();
    await act(async () => { resolve(ok(payload({ isCurrentlyPlaying: true, playedAt: null }))); });
    expect(await screen.findByText('Now listening')).toBeTruthy();
    expect(screen.queryByText('Showing saved track')).toBeNull();
  });
});

describe('rate-limit pause (Codex finding 2)', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('stops polling for the Retry-After wait, then resumes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const f = vi.fn(async () => new Response(JSON.stringify({ error: 'rate-limited', retryAfter: 120 }), { status: 429, headers: { 'retry-after': '120' } }));
    vi.stubGlobal('fetch', f);
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(f).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Spotify asked for a short break. Back soon.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    // Two polling ticks and a visibility change inside the wait: no requests.
    await act(async () => { await vi.advanceTimersByTimeAsync(91_000); document.dispatchEvent(new Event('visibilitychange')); });
    expect(f).toHaveBeenCalledTimes(1);
    // After the wait the next tick asks again.
    f.mockImplementation(async () => ok(payload()));
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(f.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Yellow')).toBeTruthy();
  });

  it('a stale answer with a wait also pauses polling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const f = vi.fn(async () => ok(payload({ stale: true, retryAfter: 300 })));
    vi.stubGlobal('fetch', f);
    render(<SpotifyLastPlayed apiBaseUrl="https://api.example" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByText('Showing saved track')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(200_000); });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
