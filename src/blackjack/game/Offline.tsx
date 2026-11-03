import { useEffect, useRef, type ReactNode } from 'react';

interface Props { offline: boolean; label: string; children: ReactNode }

/**
 * Keeps an assistance tool in the layout and, once it goes offline, blurs and dims it, marks it
 * OFFLINE and makes it inert (no clicks, no focus, hidden from assistive tech). The badge says why.
 */
export default function Offline({ offline, label, children }: Props) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    if (offline) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  }, [offline]);
  return (
    <div className={`px-assist${offline ? ' is-offline' : ''}`}>
      <div ref={body} className="px-assist__body" aria-hidden={offline || undefined}>{children}</div>
      {offline && <p className="px-assist__badge"><span>OFFLINE</span> {label}</p>}
    </div>
  );
}
