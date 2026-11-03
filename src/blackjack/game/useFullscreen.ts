import { createContext, useCallback, useContext, useEffect, useState, type RefObject } from 'react';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type Lockable = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

export const fullscreenElement = (): Element | null => document.fullscreenElement ?? (document as FsDoc).webkitFullscreenElement ?? null;
/** Element fullscreen. False on iPhone Safari, which only allows video fullscreen. */
export function fullscreenSupported(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}
const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const orientation = (): Lockable | undefined => (typeof screen !== 'undefined' ? (screen.orientation as Lockable | undefined) : undefined);

export type FsResult = 'entered' | 'unsupported' | 'blocked';

export function useFullscreen(target: RefObject<HTMLElement>) {
  const [supported] = useState(fullscreenSupported);
  const [active, setActive] = useState(() => !!fullscreenElement());
  /** True only when the browser actually granted a landscape lock. */
  const [landscapeLocked, setLandscapeLocked] = useState(false);

  useEffect(() => {
    const sync = () => {
      const on = !!fullscreenElement();
      setActive(on);
      if (!on) {
        // Leaving fullscreen by any route (button, Esc, system gesture) releases the orientation.
        try { orientation()?.unlock?.(); } catch { /* not locked */ }
        setLandscapeLocked(false);
      }
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const enter = useCallback(async (): Promise<FsResult> => {
    const el = target.current as FsEl | null;
    if (!el || !fullscreenSupported()) return 'unsupported';
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
    } catch { return 'blocked'; }
    // Phones: ask for landscape. Many browsers (and every iPhone) refuse; that is fine.
    if (isTouch() && orientation()?.lock) {
      try { await orientation()!.lock!('landscape'); setLandscapeLocked(true); } catch { setLandscapeLocked(false); }
    }
    return 'entered';
  }, [target]);

  const exit = useCallback(async () => {
    try { orientation()?.unlock?.(); } catch { /* not locked */ }
    const d = document as FsDoc;
    if (!fullscreenElement()) return;
    try { await (document.exitFullscreen ? document.exitFullscreen() : d.webkitExitFullscreen?.()); } catch { /* already out */ }
  }, []);

  return { supported, active, landscapeLocked, enter, exit };
}

export type FullscreenApi = ReturnType<typeof useFullscreen>;
export const FullscreenContext = createContext<FullscreenApi | null>(null);
export const useFullscreenApi = () => useContext(FullscreenContext);
