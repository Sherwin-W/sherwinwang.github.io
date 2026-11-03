import { useId } from 'react';
import { digitsPath } from './pixelArt';

interface Props { text: string; scale?: number; label: string; rainbow?: boolean; className?: string }

/**
 * Digits drawn from the game's own 5×7 bitmap font as crisp SVG, so every digit (including 4)
 * reads clearly at any size and widths stay uniform. Gold with a dark pixel outline; rainbow at 100%.
 */
export default function PixelNumber({ text, scale = 4, label, rainbow = false, className = '' }: Props) {
  const { d, w } = digitsPath(text);
  const id = `pn${useId().replace(/:/g, '')}`;
  return (
    <svg className={`px-num ${className}${rainbow ? ' is-rainbow' : ''}`} width={(w + 2) * scale} height={9 * scale} viewBox={`-1 -1 ${w + 2} 9`} shapeRendering="crispEdges" role="img" aria-label={label}>
      {rainbow && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2={w} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff4f6d" /><stop offset=".25" stopColor="#ffb347" /><stop offset=".45" stopColor="#fff275" />
            <stop offset=".65" stopColor="#6ef2a0" /><stop offset=".82" stopColor="#4fd6ff" /><stop offset="1" stopColor="#ff6fd8" />
          </linearGradient>
        </defs>
      )}
      <g fill="#1b1326">
        <path d={d} transform="translate(-1 0)" /><path d={d} transform="translate(1 0)" />
        <path d={d} transform="translate(0 -1)" /><path d={d} transform="translate(0 1)" />
      </g>
      <path d={d} fill={rainbow ? `url(#${id})` : 'var(--px-gold)'} />
    </svg>
  );
}
