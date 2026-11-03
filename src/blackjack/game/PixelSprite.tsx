import { useMemo } from 'react';
import { spritePaths, width, type Sprite, type SpritePalette } from './pixelArt';

interface Props { sprite: Sprite; palette: SpritePalette; scale?: number; className?: string; label?: string }

/** A multi-color pixel sprite as crisp SVG. Decorative unless `label` is given. */
export default function PixelSprite({ sprite, palette, scale = 3, className = '', label }: Props) {
  const paths = useMemo(() => spritePaths(sprite, palette), [sprite, palette]);
  const w = width(sprite), h = sprite.length;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg className={`px-icon ${className}`} width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" {...a11y}>
      {paths.map((p) => <path key={p.color} d={p.d} fill={p.color} />)}
    </svg>
  );
}
