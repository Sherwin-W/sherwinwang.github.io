import { useState, type MouseEvent } from 'react';
import { ArrowLeft, CornersIn, CornersOut } from '@phosphor-icons/react';
import { fullscreenElement, useFullscreenApi } from './useFullscreen';

/** "Exit to Portfolio": leaves fullscreen first (if any), then navigates. A normal link otherwise. */
export function ExitLink({ compact = false }: { compact?: boolean }) {
  const fs = useFullscreenApi();
  const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (!fullscreenElement() || !fs) return;
    e.preventDefault();
    await fs.exit();
    window.location.assign('/');
  };
  return (
    <a className={`px-back${compact ? ' is-compact' : ' px-back--text'}`} href="/" onClick={onClick} aria-label="Exit to Portfolio">
      <ArrowLeft aria-hidden="true" weight="bold" /><span className="px-back__text">Exit to Portfolio</span>
    </a>
  );
}

/**
 * Full Screen / Exit Full Screen. Where element fullscreen is unavailable (iPhone Safari) it explains
 * the honest alternatives instead of faking it. Entering or leaving never touches the run.
 */
export function FullscreenButton() {
  const fs = useFullscreenApi();
  const [note, setNote] = useState<string | null>(null);
  if (!fs) return null;
  const click = async () => {
    if (fs.active) { await fs.exit(); return; }
    const r = await fs.enter();
    if (r === 'unsupported') setNote('This browser can’t make a page full screen (iPhone Safari only allows it for video). Rotate your phone to landscape for the wide layout, or use Share → Add to Home Screen to open Blackjack without browser bars.');
    else if (r === 'blocked') setNote('The browser blocked full screen. You can keep playing here; rotating to landscape gives the wide layout.');
    else setNote(null);
  };
  return (
    <span className="px-fs">
      <button type="button" className="px-btn px-btn--fs" onClick={click} aria-pressed={fs.active}>
        {fs.active ? <CornersIn aria-hidden="true" weight="bold" /> : <CornersOut aria-hidden="true" weight="bold" />}
        <span>{fs.active ? 'Exit Full Screen' : 'Full Screen'}</span>
      </button>
      {note && (
        <span className="px-fs__note" role="status">
          {note}
          <button type="button" className="px-link" onClick={() => setNote(null)}>OK</button>
        </span>
      )}
    </span>
  );
}

/** Asks phone players in portrait to rotate, unless the browser already locked landscape. Dismissible. */
export function RotatePrompt() {
  const fs = useFullscreenApi();
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('bj-rotate-ok') === '1'; } catch { return false; } });
  if (dismissed || fs?.landscapeLocked) return null;
  return (
    <div className="px-rotate" role="status">
      <span className="px-rotate__icon" aria-hidden="true">⟳</span>
      <span>Rotate your phone for the best experience. Portrait works too.</span>
      <button type="button" className="px-link" onClick={() => { setDismissed(true); try { sessionStorage.setItem('bj-rotate-ok', '1'); } catch { /* ignore */ } }}>Got it</button>
    </div>
  );
}
