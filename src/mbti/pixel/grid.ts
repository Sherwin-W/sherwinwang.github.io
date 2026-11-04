/**
 * A tiny pixel canvas: a grid of palette keys ('.' is empty). Art is built from shapes in code
 * (original, no third-party assets) and rendered as SVG paths, one per colour, merged into runs.
 */
export type Palette = Readonly<Record<string, string>>;

export class Grid {
  readonly cells: string[];
  constructor(readonly w: number, readonly h: number, fill = '.') { this.cells = new Array(w * h).fill(fill); }
  get(x: number, y: number): string { return x < 0 || y < 0 || x >= this.w || y >= this.h ? '.' : this.cells[y * this.w + x]; }
  set(x: number, y: number, k: string): this { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = k; return this; }
  rect(x: number, y: number, w: number, h: number, k: string): this { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, k); return this; }
  /** Filled ellipse by centre and radii (pixel centres). */
  ellipse(cx: number, cy: number, rx: number, ry: number, k: string, only?: (x: number, y: number) => boolean): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1 && (!only || only(x, y))) this.set(x, y, k);
      }
    }
    return this;
  }
  /** Writes a small bitmap ('#' = key k, other chars = their own key, '.' = skip). */
  stamp(x: number, y: number, rows: readonly string[], k = '#'): this {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') this.set(x + i, y + j, ch === '#' ? k : ch); }));
    return this;
  }
  /** Adds an outline of key k around every non-empty pixel (4-neighbourhood). */
  outline(k: string, skip: readonly string[] = []): this {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y) !== '.') continue;
      const n = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
      if (n.some((c) => c !== '.' && c !== k && !skip.includes(c))) add.push([x, y]);
    }
    add.forEach(([x, y]) => this.set(x, y, k));
    return this;
  }
  copyFrom(src: Grid, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c !== '.') this.set(ox + x, oy + y, c); }
    return this;
  }
  clone(): Grid { const g = new Grid(this.w, this.h); g.cells.splice(0, g.cells.length, ...this.cells); return g; }
}

/** One SVG path per palette key; horizontal runs are merged so paths stay small. */
export function toPaths(g: Grid, palette: Palette): { color: string; d: string }[] {
  const by = new Map<string, string>();
  for (let y = 0; y < g.h; y++) {
    let x = 0;
    while (x < g.w) {
      const k = g.get(x, y);
      if (k === '.') { x++; continue; }
      let run = 1;
      while (x + run < g.w && g.get(x + run, y) === k) run++;
      by.set(k, (by.get(k) ?? '') + `M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  }
  return [...by.entries()].filter(([k]) => palette[k]).map(([k, d]) => ({ color: palette[k], d }));
}
