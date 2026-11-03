import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Power-circuit border for the table. On mount it plays the Tron-style sequence: a spark at the bottom
 * center, two light streams running left and right along the bottom, up the sides and along the top,
 * meeting at the top center, then a short pulse; afterwards the rail stays softly lit.
 * `rainbow` plays the 100% version; `max` keeps the rail iridescent while flow is at 100%.
 * Remount (new `key`) to replay. Under reduced motion the rail simply appears lit.
 *
 * The SVG is drawn in real pixels (measured from the table) so strokes stay 3px and the dash
 * animation (`pathLength=1`) is exact: equal path lengths make both streams meet at the top center.
 */
interface Props { rainbow?: boolean; max?: boolean; id: string }

export default function TronBorder({ rainbow = false, max = false, id }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const grad = `px-rbw-${id}`;
  const neon = (side: 'l' | 'r') => (side === 'l' ? 'var(--px-cyan)' : 'var(--px-magenta)');
  // The traveling streams follow the milestone; the lit rail follows the current flow (rainbow only at 100%).
  const run = (side: 'l' | 'r') => (rainbow ? `url(#${grad})` : neon(side));
  const rail = (side: 'l' | 'r') => (max ? `url(#${grad})` : neon(side));
  const w = Math.max(size.w, 4), h = Math.max(size.h, 4), e = 1.5, mid = Math.round(w / 2);
  const left = `M${mid} ${h - e}H${e}V${e}H${mid}`;
  const right = `M${mid} ${h - e}H${w - e}V${e}H${mid}`;

  return (
    <>
      <span className={`px-tron__spark${rainbow ? ' is-rainbow' : ''}`} aria-hidden="true" />
      <svg ref={ref} className={`px-tron${rainbow ? ' is-rainbow' : ''}${max ? ' is-max' : ''}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <defs>
          <linearGradient id={grad} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff4f6d" /><stop offset=".17" stopColor="#ffb347" /><stop offset=".34" stopColor="#fff275" />
            <stop offset=".5" stopColor="#6ef2a0" /><stop offset=".67" stopColor="#4fd6ff" /><stop offset=".84" stopColor="#9b7bff" /><stop offset="1" stopColor="#ff6fd8" />
          </linearGradient>
        </defs>
        <g className="px-tron__rail">
          <path d={left} stroke={rail('l')} />
          <path d={right} stroke={rail('r')} />
        </g>
        <g className="px-tron__run">
          <path className="px-tron__trail" d={left} pathLength={1} stroke={run('l')} />
          <path className="px-tron__trail" d={right} pathLength={1} stroke={run('r')} />
          <path className="px-tron__head" d={left} pathLength={1} />
          <path className="px-tron__head" d={right} pathLength={1} />
        </g>
      </svg>
    </>
  );
}
