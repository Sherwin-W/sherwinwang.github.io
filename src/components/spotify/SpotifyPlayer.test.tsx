import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import SpotifyPlayer from './SpotifyPlayer';
import type { Track } from './types';
import * as iframeApi from './iframeApi';

const ID = '3AJwUDP919kvQ9QcozQPxg';
const track: Track = { id: ID, title: 'Yellow', artists: ['Coldplay'], album: 'Parachutes', albumArt: null, spotifyUrl: `https://open.spotify.com/track/${ID}`, embedUrl: `https://open.spotify.com/embed/track/${ID}`, durationMs: 266773 };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/** A stand-in for Spotify's IFrame API that records calls and lets the test fire events. */
function fakeApi() {
  const listeners: Record<string, ((e?: unknown) => void)[]> = {};
  const controller = {
    play: vi.fn(), pause: vi.fn(), togglePlay: vi.fn(), destroy: vi.fn(),
    addListener: (ev: string, cb: (e?: unknown) => void) => { (listeners[ev] ??= []).push(cb); },
  };
  const api = {
    createController: vi.fn((el: HTMLElement, opts: { uri: string }, cb: (c: typeof controller) => void) => {
      const frame = document.createElement('iframe');
      frame.title = 'Spotify Embed';
      frame.src = `https://open.spotify.com/embed/track/${opts.uri.split(':')[2]}`;
      el.replaceWith(frame);
      cb(controller);
    }),
  };
  const fire = (ev: string, e?: unknown) => listeners[ev]?.forEach((cb) => cb(e));
  return { api, controller, fire };
}

const details = <p>Track details</p>;

describe('<SpotifyPlayer>', () => {
  it('at rest: the track details, then only play and a Spotify link to the song, no iframe', () => {
    render(<SpotifyPlayer track={track}>{details}</SpotifyPlayer>);
    expect(screen.getByText('Track details')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'Playback' });
    expect([...group.querySelectorAll('button, a')].map((e) => e.getAttribute('aria-label'))).toEqual(['Play Yellow with Spotify', 'Open Yellow in Spotify (new tab)']);
    const link = screen.getByRole('link', { name: 'Open Yellow in Spotify (new tab)' });
    expect(link.getAttribute('href')).toBe(track.spotifyUrl);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('play swaps the details for the official embed (unaltered), starts it, and close returns focus to play', async () => {
    const { api, controller, fire } = fakeApi();
    vi.spyOn(iframeApi, 'loadIFrameApi').mockResolvedValue(api as unknown as iframeApi.IFrameAPI);
    render(<SpotifyPlayer track={track}>{details}</SpotifyPlayer>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play Yellow with Spotify' })); });
    expect(api.createController).toHaveBeenCalledWith(expect.any(HTMLElement), { uri: `spotify:track:${ID}`, width: '100%', height: 80 }, expect.any(Function));
    expect(document.querySelector('iframe')!.src).toContain(`/embed/track/${ID}`);
    // The embed already shows the art, title and artist, so ours are not shown twice.
    expect(screen.queryByText('Track details')).toBeNull();
    act(() => fire('ready'));
    expect(controller.play).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Spotify player open')).toBeTruthy();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /Close player/ }));
    act(() => { vi.runAllTimers(); });
    vi.useRealTimers();
    expect(controller.destroy).toHaveBeenCalled();
    expect(screen.getByText('Track details')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Play Yellow with Spotify' }));
  });

  it('falls back to the plain official embed when the IFrame API cannot load', async () => {
    vi.spyOn(iframeApi, 'loadIFrameApi').mockRejectedValue(new Error('blocked'));
    render(<SpotifyPlayer track={track}>{details}</SpotifyPlayer>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play Yellow with Spotify' })); });
    expect(screen.getByTitle('Spotify player: Yellow').getAttribute('src')).toContain(`/embed/track/${ID}`);
  });
});
