import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CaretLeft, Play, SpotifyLogo } from '@phosphor-icons/react';
import { loadIFrameApi, type EmbedController } from './iframeApi';
import type { Track } from './types';

type Mode = 'idle' | 'loading' | 'player' | 'fallback';

/**
 * Two controls under the track details: play and a Spotify link. Pressing play swaps the details for Spotify's
 * official compact player and starts it through the IFrame API. The embed already shows the art, title and
 * artist, so the details are hidden while it is open rather than shown twice; the embed itself is never cropped
 * or altered. Nothing here acts on the site owner's Spotify account.
 */
export default function SpotifyPlayer({ track, children }: { track: Track; children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('idle');
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
      });
    }).catch(() => {
      // The API script is blocked or slow: fall back to the plain official embed.
      if (!cancelled) setMode('fallback');
    });
    return () => { cancelled = true; };
  }, [mode, track.id]);

  const close = () => {
    destroy();
    setMode('idle');
    window.setTimeout(() => playButton.current?.focus(), 0);
  };

  if (mode === 'idle') {
    return (
      <>
        {children}
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
      <div className="spotify__controls">
        <button type="button" className="spotify__collapse" onClick={close}><CaretLeft aria-hidden="true" /> Close player</button>
        <span className="visually-hidden" role="status">{mode === 'loading' ? 'Loading Spotify player' : 'Spotify player open'}</span>
      </div>
    </div>
  );
}
