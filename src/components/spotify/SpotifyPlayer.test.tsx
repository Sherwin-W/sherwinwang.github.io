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

describe('<SpotifyPlayer> strip', () => {
  it('at rest: play, thin bar, time, Spotify link and menu — no art, no title, no iframe', () => {
    render(<SpotifyPlayer track={track} />);
    expect(screen.getByRole('button', { name: 'Play Yellow with Spotify' })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Playback position' }).getAttribute('aria-valuetext')).toBe('0:00 of 4:27');
    expect(screen.getByText('0:00 / 4:27')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open in Spotify (new tab)' }).getAttribute('href')).toBe(track.spotifyUrl);
    expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.queryByText('Yellow')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('play loads the official embed (unaltered, visible), starts it, and the strip reflects real progress after hiding it', async () => {
    const { api, controller, fire } = fakeApi();
    vi.spyOn(iframeApi, 'loadIFrameApi').mockResolvedValue(api as unknown as iframeApi.IFrameAPI);
    render(<SpotifyPlayer track={track} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play Yellow with Spotify' })); });
    expect(api.createController).toHaveBeenCalledWith(expect.any(HTMLElement), { uri: `spotify:track:${ID}`, width: '100%', height: 80 }, expect.any(Function));
    const frame = document.querySelector('iframe')!;
    expect(frame.src).toContain(`/embed/track/${ID}`);
    act(() => fire('ready'));
    expect(controller.play).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Spotify player')).toBeTruthy();
    act(() => fire('playback_update', { data: { isPaused: false, isBuffering: false, duration: 30000, position: 12000 } }));
    fireEvent.click(screen.getByRole('button', { name: /Hide player/ }));
    expect(controller.destroy).toHaveBeenCalled();
    expect(screen.getByText('0:12 / 0:30')).toBeTruthy(); // real position and the length Spotify actually played
  });

  it('falls back to the plain official embed when the IFrame API cannot load', async () => {
    vi.spyOn(iframeApi, 'loadIFrameApi').mockRejectedValue(new Error('blocked'));
    render(<SpotifyPlayer track={track} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play Yellow with Spotify' })); });
    expect(screen.getByTitle('Spotify player: Yellow').getAttribute('src')).toContain(`/embed/track/${ID}`);
  });
});

describe('options menu', () => {
  it('opens from the keyboard, moves with arrows, closes with Escape and returns focus', () => {
    render(<SpotifyPlayer track={track} />);
    const more = screen.getByRole('button', { name: 'More options' });
    fireEvent.click(more);
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Open in the Spotify app', 'Open in the web player', 'Add to a playlist or queue in Spotify…', 'Copy song link']);
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1], { key: 'ArrowUp' });
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[3]);
    fireEvent.keyDown(items[3], { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('only offers actions that go through Spotify itself (nothing acts on the site owner’s account)', () => {
    render(<SpotifyPlayer track={track} />);
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    const hrefs = screen.getAllByRole('menuitem').map((i) => i.getAttribute('href')).filter(Boolean);
    expect(hrefs).toEqual([`spotify:track:${ID}`, track.spotifyUrl, track.spotifyUrl]);
  });

  it('copies the song link', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SpotifyPlayer track={track} />);
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Copy song link' })); });
    expect(writeText).toHaveBeenCalledWith(track.spotifyUrl);
    expect(screen.getByText('Song link copied')).toBeTruthy();
  });
});
