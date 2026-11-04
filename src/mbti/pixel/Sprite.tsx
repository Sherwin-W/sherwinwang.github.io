import { memo, useMemo } from 'react';
import { toPaths, type Grid, type Palette } from './grid';

interface Props { grid: Grid; palette: Palette; className?: string; label?: string; width?: number | string }

/** Crisp pixel art as SVG. Decorative unless `label` is given. */
function Sprite({ grid, palette, className = '', label, width }: Props) {
  const paths = useMemo(() => toPaths(grid, palette), [grid, palette]);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg className={`px ${className}`} viewBox={`0 0 ${grid.w} ${grid.h}`} width={width} shapeRendering="crispEdges" preserveAspectRatio="xMidYMax meet" {...a11y}>
      {paths.map((p) => <path key={p.color + p.d.length} d={p.d} fill={p.color} />)}
    </svg>
  );
}

export default memo(Sprite);
