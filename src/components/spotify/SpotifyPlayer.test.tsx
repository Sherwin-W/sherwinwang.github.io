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
    play: vi.fn(), pause: vi.fn(), togglePlay: vi.fn(), seek: vi.fn(), destroy: vi.fn(),
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

  it('the progress bar sits between the details and the controls, and stays empty for a last-played track', () => {
    render(<SpotifyPlayer track={track}>{details}</SpotifyPlayer>);
    const bar = document.querySelector('.spotify__progress') as HTMLElement;
    expect(bar.previousElementSibling!.textContent).toBe('Track details');
    expect(bar.nextElementSibling!.getAttribute('aria-label')).toBe('Playback');
    // No invented position: no fill, nothing to seek, even though the track length is known.
    expect(bar.dataset.progress).toBe('none');
    expect(bar.style.getPropertyValue('--fill')).toBe('0');
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('follows the official player’s own playback reports, seeks through it, and resets when closed', async () => {
    const { api, controller, fire } = fakeApi();
    vi.spyOn(iframeApi, 'loadIFrameApi').mockResolvedValue(api as unknown as iframeApi.IFrameAPI);
    render(<SpotifyPlayer track={track}>{details}</SpotifyPlayer>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play Yellow with Spotify' })); });
    const bar = () => document.querySelector('.spotify__progress') as HTMLElement;
    // Loading: still nothing to show.
    expect(bar().dataset.progress).toBe('none');
    act(() => fire('ready'));
    act(() => fire('playback_update', { data: { isPaused: false, isBuffering: false, duration: 30000, position: 12000 } }));
    expect(bar().dataset.progress).toBe('live');
    expect(bar().style.getPropertyValue('--fill')).toBe('0.4');
    const seek = screen.getByRole('slider', { name: 'Seek in Yellow' });
    expect(seek.getAttribute('aria-valuetext')).toBe('0:12 of 0:30');
    act(() => fire('playback_update', { data: { isPaused: true, isBuffering: false, duration: 30000, position: 15000 } }));
    expect(bar().style.getPropertyValue('--fill')).toBe('0.5');
    expect(bar().classList.contains('is-paused')).toBe(true);
    fireEvent.change(seek, { target: { value: '24' } });
    expect(controller.seek).toHaveBeenCalledWith(24);
    expect(bar().style.getPropertyValue('--fill')).toBe('0.8');
    fireEvent.click(screen.getByRole('button', { name: /Close player/ }));
    expect(bar().dataset.progress).toBe('none');
    // A report from the closed player is ignored.
    act(() => fire('playback_update', { data: { isPaused: false, isBuffering: false, duration: 30000, position: 20000 } }));
    expect(bar().dataset.progress).toBe('none');
  });

  it('falls back to the plain official embed when the IFrame API cannot load', async () => {
    vi.spyOn(iframeApi, 'loadIFrameApi').mockRejectedValue(new Error('blocked'));
    render(<SpotifyPlayer track={track}>{details}</SpotifyPlayer>);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play Yellow with Spotify' })); });
    expect(screen.getByTitle('Spotify player: Yellow').getAttribute('src')).toContain(`/embed/track/${ID}`);
    // The plain embed reports no position, so the bar stays empty and cannot seek.
    expect((document.querySelector('.spotify__progress') as HTMLElement).dataset.progress).toBe('none');
    expect(screen.queryByRole('slider')).toBeNull();
  });
});
