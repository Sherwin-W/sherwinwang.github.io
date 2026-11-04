import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CaretUp, DotsThree, Play, SpotifyLogo } from '@phosphor-icons/react';
import { clock } from './api';
import { loadIFrameApi, type EmbedController, type PlaybackUpdate } from './iframeApi';
import type { Track } from './types';

type Mode = 'strip' | 'loading' | 'player' | 'fallback';

/**
 * Compact playback strip under the track details: play, a thin progress bar, time, Spotify link and a ⋯ menu.
 * No album art or title (they are already shown above). Pressing play loads Spotify's official compact
 * player in its place and starts it through the IFrame API; that player is shown as Spotify provides it.
 * Nothing here acts on the site owner's Spotify account.
 */
export default function SpotifyPlayer({ track }: { track: Track }) {
  const [mode, setMode] = useState<Mode>('strip');
  const [progress, setProgress] = useState<PlaybackUpdate | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<EmbedController | null>(null);
  const playButton = useRef<HTMLButtonElement>(null);

  const destroy = useCallback(() => { try { controller.current?.destroy(); } catch { /* already gone */ } controller.current = null; }, []);
  useEffect(() => destroy, [destroy]);

  const play = () => setMode('loading');

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
        c.addListener('playback_update', (e) => setProgress(e.data));
      });
    }).catch(() => {
      // The API script is blocked or slow: fall back to the plain official embed.
      if (!cancelled) setMode('fallback');
    });
    return () => { cancelled = true; };
  }, [mode, track.id]);

  const collapse = () => {
    destroy();
    setMode('strip');
    window.setTimeout(() => playButton.current?.focus(), 0);
  };

  const duration = progress?.duration || track.durationMs || 0;
  const position = progress?.position ?? 0;
  const pct = duration ? Math.min(100, (position / duration) * 100) : 0;
  const expanded = mode === 'loading' || mode === 'player' || mode === 'fallback';

  return (
    <div className="spotify__player">
      {!expanded && (
        <div className="spotify__strip" role="group" aria-label="Playback">
          <button ref={playButton} type="button" className="spotify__play" onClick={play} aria-label={`Play ${track.title} with Spotify`}>
            <Play aria-hidden="true" weight="fill" />
          </button>
          {duration > 0 && (
            <>
              <div className="spotify__bar" role="progressbar" aria-label="Playback position" aria-valuemin={0} aria-valuemax={Math.round(duration / 1000)} aria-valuenow={Math.round(position / 1000)} aria-valuetext={`${clock(position)} of ${clock(duration)}`}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="spotify__time" aria-hidden="true">{clock(position)} / {clock(duration)}</span>
            </>
          )}
          <a className="spotify__brand" href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Spotify (new tab)">
            <SpotifyLogo aria-hidden="true" weight="fill" />
          </a>
          <OptionsMenu track={track} />
        </div>
      )}
      {expanded && (
        <div className="spotify__live">
          <div className="spotify__live-bar">
            <span className="spotify__live-note" role="status">{mode === 'loading' ? 'Loading Spotify player…' : 'Spotify player'}</span>
            <button type="button" className="spotify__collapse" onClick={collapse}><CaretUp aria-hidden="true" /> Hide player</button>
          </div>
          {mode === 'fallback' ? (
            <iframe className="spotify__embed" title={`Spotify player: ${track.title}`} src={`${track.embedUrl}?utm_source=sherwinwang.dev`} width="100%" height="80" allow="encrypted-media; autoplay" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          ) : (
            <div ref={host} className="spotify__host" data-loading={mode === 'loading' || undefined} />
          )}
        </div>
      )}
    </div>
  );
}

/** ⋯ menu: only actions that work for any visitor, through Spotify itself. */
function OptionsMenu({ track }: { track: Track }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onDoc = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && e.target !== button.current) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = (refocus = true) => { setOpen(false); if (refocus) button.current?.focus(); };
  const onKey = (e: ReactKeyboardEvent) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === 'Tab') close(false);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(track.spotifyUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
    close();
  };

  return (
    <div className="spotify__menuwrap">
      <button ref={button} type="button" className="spotify__more" aria-haspopup="menu" aria-expanded={open} aria-label="More options" onClick={() => setOpen((v) => !v)}>
        <DotsThree aria-hidden="true" weight="bold" />
      </button>
      {open && (
        <div ref={menu} className="spotify__menu" role="menu" aria-label="Song options" onKeyDown={onKey}>
          <a role="menuitem" tabIndex={-1} href={`spotify:track:${track.id}`} onClick={() => close(false)}>Open in the Spotify app</a>
          <a role="menuitem" tabIndex={-1} href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" onClick={() => close(false)}>Open in the web player</a>
          <a role="menuitem" tabIndex={-1} href={track.spotifyUrl} target="_blank" rel="noopener noreferrer" onClick={() => close(false)}>Add to a playlist or queue in Spotify…</a>
          <button role="menuitem" tabIndex={-1} type="button" onClick={() => void copy()}>Copy song link</button>
        </div>
      )}
      <span className="visually-hidden" role="status">{copied ? 'Song link copied' : ''}</span>
    </div>
  );
}
