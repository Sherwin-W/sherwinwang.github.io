import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import SpotifyLastPlayed from './SpotifyLastPlayed';
import { parseLastPlayed, relativeTime } from './api';

const ID = '3AJwUDP919kvQ9QcozQPxg';
const payload = (over: object = {}) => ({
  track: { id: ID, title: 'Gravity', artists: ['John Mayer'], album: 'Continuum', albumArt: 'https://i.scdn.co/image/a', spotifyUrl: 'x', embedUrl: 'https://evil.example/embed' },
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
    expect(await screen.findByText('Gravity')).toBeTruthy();
    expect(screen.getByText('Last played on Spotify')).toBeTruthy();
    expect(screen.getByTitle('Spotify player: Gravity').getAttribute('src')).toContain(`/embed/track/${ID}`);
    expect(screen.getByRole('link', { name: /Gravity/ }).getAttribute('href')).toBe(`https://open.spotify.com/track/${ID}`);
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
    expect(await screen.findByText('Gravity')).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText('Spotify is unavailable right now.')).toBeNull();
  });
});
