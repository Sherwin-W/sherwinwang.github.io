import { toPath, width, type Bitmap } from './pixelArt';

interface Props { bitmap: Bitmap; color: string; scale?: number; className?: string; label?: string; outline?: string }

/** Renders a bitmap as crisp SVG. Decorative unless `label` is given. */
export default function PixelIcon({ bitmap, color, scale = 3, className = '', label, outline }: Props) {
  const w = width(bitmap), h = bitmap.length;
  const pad = outline ? 1 : 0;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg className={`px-icon ${className}`} width={(w + pad * 2) * scale} height={(h + pad * 2) * scale} viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} shapeRendering="crispEdges" {...a11y}>
      {outline && <path d={toPath(bitmap, -1, 0) + toPath(bitmap, 1, 0) + toPath(bitmap, 0, -1) + toPath(bitmap, 0, 1)} fill={outline} />}
      <path d={toPath(bitmap, 0, 0)} fill={color} />
    </svg>
  );
}
