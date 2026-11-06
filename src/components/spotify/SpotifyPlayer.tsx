import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CaretLeft, Play, SpotifyLogo } from '@phosphor-icons/react';
import { clock } from './api';
import { loadIFrameApi, type EmbedController, type PlaybackUpdate } from './iframeApi';
import type { Track } from './types';

type Mode = 'idle' | 'loading' | 'player' | 'fallback';

/**
 * Play and a Spotify link under the track details, with a thin progress bar between them. Pressing play swaps the
 * details for Spotify's official compact player and starts it through the IFrame API. The embed already shows the
 * art, title and artist, so the details are hidden while it is open rather than shown twice; the embed itself is
 * never cropped or altered. Nothing here acts on the site owner's Spotify account.
 *
 * The bar only ever shows what that player reports (`playback_update`): it stays empty for a last-played track
 * and while the player loads, and it can seek only while the player is open.
 */
export default function SpotifyPlayer({ track, children }: { track: Track; children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [playback, setPlayback] = useState<PlaybackUpdate | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<EmbedController | null>(null);
  const playButton = useRef<HTMLButtonElement>(null);

  const destroy = useCallback(() => { try { controller.current?.destroy(); } catch { /* already gone */ } controller.current = null; }, []);
  useEffect(() => destroy, [destroy]);

  // Create the official embed once its host is on screen; stale loads are ignored.
  useEffect(() => {
    if (mode !== 'loading') return;
    let cancelled = false;
    loadIFrameApi().then((api) => {
      const el = host.current;
      if (cancelled || !el) return;
      const target = document.createElement('div');
      el.replaceChildren(target);
      api.createController(target, { uri: `spotify:track:${track.id}`, width: '100%', height: 80 }, (c) => {
        controller.current = c;
        c.addListener('ready', () => { setMode('player'); c.play(); });
        // Only the open player's reports count; a closed or replaced one is ignored.
        c.addListener('playback_update', (e) => { if (controller.current === c) setPlayback(e.data); });
      });
    }).catch(() => {
      // The API script is blocked or slow: fall back to the plain official embed (it reports no progress).
      if (!cancelled) setMode('fallback');
    });
    return () => { cancelled = true; };
  }, [mode, track.id]);

  const close = () => {
    destroy();
    setPlayback(null);
    setMode('idle');
    window.setTimeout(() => playButton.current?.focus(), 0);
  };

  const seekable = mode === 'player' && Boolean(playback?.duration);
  const bar = <ProgressBar title={track.title} playback={mode === 'player' ? playback : null} onSeek={seekable ? (s) => { controller.current?.seek(s); setPlayback((p) => (p ? { ...p, position: s * 1000 } : p)); } : undefined} />;

  if (mode === 'idle') {
    return (
      <>
        {children}
        {bar}
        <div className="spotify__controls" role="group" aria-label="Playback">
          <button ref={playButton} type="button" className="spotify__play" onClick={() => setMode('loading')} aria-label={`Play ${track.title} with Spotify`}>
            <Play aria-hidden="true" weight="fill" />
          </button>
          <a className="spotify__brand" href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${track.title} in Spotify (new tab)`}>
            <SpotifyLogo aria-hidden="true" weight="fill" />
          </a>
        </div>
      </>
    );
  }

  return (
    <div className="spotify__live">
      {mode === 'fallback' ? (
        <iframe className="spotify__embed" title={`Spotify player: ${track.title}`} src={`${track.embedUrl}?utm_source=sherwinwang.dev`} width="100%" height="80" allow="encrypted-media; autoplay" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <div ref={host} className="spotify__host" data-loading={mode === 'loading' || undefined} />
      )}
      {bar}
      <div className="spotify__controls">
        <button type="button" className="spotify__collapse" onClick={close}><CaretLeft aria-hidden="true" /> Close player</button>
        <span className="visually-hidden" role="status">{mode === 'loading' ? 'Loading Spotify player' : 'Spotify player open'}</span>
      </div>
    </div>
  );
}

/**
 * A 2px floating bar. Without playback data it is an empty, decorative track. With data from the official player
 * it fills to the reported position, and a native range input on top makes it seekable (keyboard included).
 */
function ProgressBar({ title, playback, onSeek }: { title: string; playback: PlaybackUpdate | null; onSeek?: (seconds: number) => void }) {
  const duration = playback?.duration ?? 0;
  const position = Math.min(playback?.position ?? 0, duration);
  const live = Boolean(playback && duration > 0);
  const style = { '--fill': live ? position / duration : 0 } as CSSProperties;
  return (
    <div className={`spotify__progress${live ? ' is-live' : ''}${playback?.isPaused ? ' is-paused' : ''}`} style={style} data-progress={live ? 'live' : 'none'}>
      <span className="spotify__progress-fill" aria-hidden="true" />
      {live && onSeek && (
        <input
          className="spotify__seek"
          type="range"
          min={0}
          max={Math.round(duration / 1000)}
          step={1}
          value={Math.round(position / 1000)}
          aria-label={`Seek in ${title}`}
          aria-valuetext={`${clock(position)} of ${clock(duration)}`}
          onChange={(e) => onSeek(Number(e.currentTarget.value))}
        />
      )}
    </div>
  );
}
