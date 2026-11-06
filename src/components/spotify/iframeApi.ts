/**
 * Spotify's official Embed IFrame API (https://developer.spotify.com/documentation/embeds/references/iframe-api).
 * Loaded only when a visitor asks to play. The embed it creates is shown unaltered, as Spotify's terms require.
 */
export interface PlaybackUpdate { isPaused: boolean; isBuffering: boolean; duration: number; position: number }
export interface EmbedController {
  play(): void;
  pause(): void;
  togglePlay(): void;
  /** Jumps to a position, in seconds. */
  seek(seconds: number): void;
  destroy(): void;
  addListener(event: 'ready', cb: () => void): void;
  addListener(event: 'playback_update', cb: (e: { data: PlaybackUpdate }) => void): void;
}
export interface IFrameAPI {
  createController(el: HTMLElement, options: { uri: string; width?: string | number; height?: string | number }, cb: (c: EmbedController) => void): void;
}

export const IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
let pending: Promise<IFrameAPI> | null = null;

export function loadIFrameApi(timeoutMs = 8000): Promise<IFrameAPI> {
  if (pending) return pending;
  pending = new Promise<IFrameAPI>((resolve, reject) => {
    const w = window as unknown as { onSpotifyIframeApiReady?: (api: IFrameAPI) => void };
    const previous = w.onSpotifyIframeApiReady;
    const timer = window.setTimeout(() => fail(new Error('timeout')), timeoutMs);
    const fail = (err: Error) => { window.clearTimeout(timer); pending = null; reject(err); };
    w.onSpotifyIframeApiReady = (api) => { window.clearTimeout(timer); previous?.(api); resolve(api); };
    const script = document.createElement('script');
    script.src = IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => fail(new Error('load'));
    document.head.appendChild(script);
  });
  return pending;
}

/** For tests. */
export function resetIFrameApi(): void { pending = null; }
