/**
 * Parametric pixel portraits (40×40, head and shoulders). Every character is built from the same
 * structure with their own skin tone, hair, clothing and accessories, so the cast is varied without
 * caricature. Faces come in expressions × mouth frames × blink, all original art drawn in code.
 */
import { Grid, type Palette } from './grid';

export type Expression = 'neutral' | 'happy' | 'curious' | 'thinking' | 'surprised' | 'laugh';
export type Mouth = 'rest' | 'open' | 'mid';
export type HairStyle = 'bob' | 'curls' | 'grey-sides' | 'swoop' | 'bun' | 'short';

export interface PortraitSpec {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairStyle: HairStyle;
  clothes: string;
  clothesShade: string;
  collar: string;
  glasses?: boolean;
  earrings?: boolean;
  mustache?: boolean;
  beard?: boolean;
  /** Gentle lines for an older face. */
  lines?: boolean;
  blush?: string;
}

export const SIZE = 40;
const CX = 20;

export function palette(spec: PortraitSpec): Palette {
  return {
    k: '#1d1730', s: spec.skin, S: spec.skinShade, h: spec.hair, H: spec.hairShade,
    c: spec.clothes, C: spec.clothesShade, d: spec.collar, e: '#1d1730', w: '#fdf7ee',
    m: '#5a1f2e', r: '#e8707e', p: spec.blush ?? '#e9967f', g: '#2a2740', j: '#f2c14e', t: '#fdf7ee',
  };
}

function base(spec: PortraitSpec): Grid {
  const g = new Grid(SIZE, SIZE);
  // Hair volume that sits behind the head.
  if (spec.hairStyle === 'curls') g.ellipse(CX, 12.5, 12.5, 10.5, 'h');
  if (spec.hairStyle === 'bob') { g.ellipse(CX, 14, 11.5, 12, 'h'); g.rect(8, 14, 3, 13, 'h'); g.rect(29, 14, 3, 13, 'h'); }
  if (spec.hairStyle === 'bun') g.ellipse(CX, 3.5, 3.5, 3, 'h');
  // Shoulders and clothes.
  for (let y = 31; y < SIZE; y++) {
    const half = 8 + Math.min(10, (y - 31) * 1.6);
    for (let x = Math.round(CX - half); x <= Math.round(CX + half) - 1; x++) g.set(x, y, 'c');
  }
  for (let y = 33; y < SIZE; y++) { g.set(Math.round(CX - 8 - (y - 31) * 1.2), y, 'C'); g.set(Math.round(CX + 7 + (y - 31) * 1.2), y, 'C'); }
  // Neck and collar.
  g.rect(17, 26, 6, 6, 's');
  g.rect(17, 30, 6, 1, 'S');
  g.stamp(14, 30, ['ddd......ddd', '.ddd....ddd.', '..ddd..ddd..', '...dd..dd...'], 'd');
  // Head and ears.
  g.ellipse(CX, 16, 8.5, 10.5, 's');
  g.ellipse(10.5, 17, 1.5, 2, 's');
  g.ellipse(29.5, 17, 1.5, 2, 's');
  g.set(10, 17, 'S'); g.set(29, 17, 'S');
  // Jaw shading.
  for (let x = 15; x <= 25; x++) if (g.get(x, 26) === 's') g.set(x, 26, 'S');
  // Hair on top of the head.
  hairFront(g, spec.hairStyle);
  if (spec.earrings) { g.set(10, 20, 'j'); g.set(29, 20, 'j'); g.set(10, 21, 'j'); g.set(29, 21, 'j'); }
  g.outline('k');
  return g;
}

function hairFront(g: Grid, style: HairStyle): void {
  const onHead = (x: number, y: number) => g.get(x, y) === 's' || g.get(x, y) === 'h';
  switch (style) {
    case 'bob':
      g.ellipse(CX, 9, 9.5, 5.5, 'h', (x, y) => y <= 11 && onHead(x, y));
      g.rect(12, 9, 16, 3, 'h'); g.rect(12, 12, 4, 1, 'h'); g.rect(24, 12, 4, 1, 'h');
      for (let x = 13; x <= 27; x += 3) g.set(x, 11, 'H');
      break;
    case 'bun':
      g.ellipse(CX, 9, 9, 5, 'h', (x, y) => y <= 11 && onHead(x, y));
      g.rect(11, 10, 3, 6, 'h'); g.rect(26, 10, 3, 6, 'h');
      g.set(18, 6, 'H'); g.set(22, 7, 'H'); g.set(20, 2, 'H');
      break;
    case 'curls':
      for (let y = 3; y <= 11; y++) for (let x = 9; x <= 31; x++) if ((x + y * 2) % 5 === 0 && g.get(x, y) === 'h') g.set(x, y, 'H');
      g.ellipse(CX, 8.5, 8.5, 3.5, 'h', (x, y) => y <= 10 && onHead(x, y));
      for (let x = 13; x <= 27; x += 2) g.set(x, 10, 'H');
      break;
    case 'grey-sides':
      g.rect(11, 12, 2, 7, 'h'); g.rect(27, 12, 2, 7, 'h');
      g.rect(12, 11, 2, 2, 'h'); g.rect(26, 11, 2, 2, 'h');
      g.set(19, 6, 'h'); g.set(21, 6, 'h'); g.set(17, 7, 'H'); g.set(23, 7, 'H');
      break;
    case 'swoop':
      g.rect(11, 9, 2, 6, 'H'); g.rect(27, 9, 2, 6, 'H');
      g.ellipse(CX, 8, 9, 4, 'H', (x, y) => y <= 9 && onHead(x, y));
      g.stamp(12, 6, ['..hhhhhhhh.......', '.hhhhhhhhhhhh....', 'hhhhhhhhhhhhhhh..', '...hhhhhhhhhhhhh.', '.....hhhhhhh.hhh.'], 'h');
      break;
    case 'short':
      g.ellipse(CX, 8.5, 9, 4.5, 'h', (x, y) => y <= 10 && onHead(x, y));
      g.rect(11, 10, 2, 4, 'h'); g.rect(27, 10, 2, 4, 'h');
      break;
  }
}

const BROWS: Record<Expression, [string[], string[]]> = {
  neutral: [['hhhh'], ['hhhh']],
  happy: [['.hh.', 'h..h'], ['.hh.', 'h..h']],
  curious: [['..hh', 'hh..'], ['hhhh']],
  thinking: [['hhhh'], ['hh..', '..hh']],
  surprised: [['.hh.', 'h..h'], ['.hh.', 'h..h']],
  laugh: [['.hh.', 'h..h'], ['.hh.', 'h..h']],
};

const MOUTHS: Record<Expression, Record<Mouth, string[]>> = {
  neutral: { rest: ['.mmmm.'], mid: ['.mmmm.', '..rr..'], open: ['.mmmm.', '.mrrm.', '..mm..'] },
  happy: { rest: ['m....m', '.mmmm.'], mid: ['mmmmmm', '.mrrm.'], open: ['mmmmmm', 'mrrrrm', '.mmmm.'] },
  curious: { rest: ['..mm..'], mid: ['.mmm..', '.mrm..'], open: ['.mmmm.', '.mrrm.', '..mm..'] },
  thinking: { rest: ['...mm.', '.mm...'], mid: ['..mmm.', '.mrm..'], open: ['.mmmm.', '.mrrm.', '..mm..'] },
  surprised: { rest: ['..mm..', '.m..m.', '..mm..'], mid: ['..mm..', '.mrrm.', '..mm..'], open: ['.mmmm.', 'mrrrrm', '.mmmm.'] },
  laugh: { rest: ['mttttm', '.mrrm.'], mid: ['mttttm', 'mrrrrm', '.mmmm.'], open: ['mttttm', 'mrrrrm', 'mrrrrm', '.mmmm.'] },
};

/** Draws the face onto a copy of the base: eyes (or a blink), brows, nose, mouth, extras. */
function face(b: Grid, spec: PortraitSpec, expression: Expression, mouth: Mouth, blink: boolean): Grid {
  const g = b.clone();
  const [lb, rb] = BROWS[expression];
  const browY = expression === 'surprised' ? 11 : 12;
  g.stamp(14, browY, lb, spec.hairStyle === 'grey-sides' ? 'H' : 'k');
  g.stamp(22, browY, rb, spec.hairStyle === 'grey-sides' ? 'H' : 'k');
  if (blink || expression === 'laugh') {
    g.rect(15, 16, 3, 1, 'e'); g.rect(22, 16, 3, 1, 'e');
  } else {
    const eyeH = expression === 'surprised' ? 3 : 2;
    g.rect(15, 15, 2, eyeH, 'e'); g.rect(23, 15, 2, eyeH, 'e');
    g.set(15, 15, 'w'); g.set(23, 15, 'w');
  }
  if (spec.glasses) g.stamp(13, 14, ['######..######', '#....####....#', '#....#..#....#', '######..######'], 'g');
  if (spec.lines) { g.set(14, 18, 'S'); g.set(15, 18, 'S'); g.set(24, 18, 'S'); g.set(25, 18, 'S'); g.set(16, 22, 'S'); g.set(24, 22, 'S'); }
  g.set(20, 19, 'S'); g.set(20, 20, 'S'); g.set(21, 20, 'S');
  if (expression === 'happy' || expression === 'laugh') { g.set(14, 20, 'p'); g.set(15, 20, 'p'); g.set(25, 20, 'p'); g.set(26, 20, 'p'); }
  if (spec.beard) {
    g.stamp(13, 21, ['h............h', 'hh..........hh', 'hhh........hhh', '.hhh......hhh.', '..hhhhhhhhhh..', '....hhhhhh....'], 'h');
    g.stamp(17, 22, ['.hhhh.'], 'h');
  }
  const m = MOUTHS[expression][mouth];
  g.stamp(17, 23, m, 'm');
  if (spec.mustache) g.stamp(16, 21, ['.hhhhhhh.', 'hhh...hhh'], 'h');
  return g;
}

const cache = new Map<string, Grid>();
const bases = new Map<PortraitSpec, Grid>();

export function portrait(spec: PortraitSpec, expression: Expression = 'neutral', mouth: Mouth = 'rest', blink = false): Grid {
  let b = bases.get(spec);
  if (!b) { b = base(spec); bases.set(spec, b); }
  const key = `${expression}|${mouth}|${blink}`;
  const k = `${JSON.stringify(spec)}|${key}`;
  let g = cache.get(k);
  if (!g) { g = face(b, spec, expression, mouth, blink); cache.set(k, g); }
  return g;
}

/** Half-size copy for thumbnails (nearest-neighbour sample of the centre of each 2×2 block). */
export function shrink(g: Grid): Grid {
  const out = new Grid(Math.floor(g.w / 2), Math.floor(g.h / 2));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const block = [g.get(2 * x, 2 * y), g.get(2 * x + 1, 2 * y), g.get(2 * x, 2 * y + 1), g.get(2 * x + 1, 2 * y + 1)];
    const filled = block.filter((c) => c !== '.');
    if (!filled.length) continue;
    // Prefer features (eyes, mouth, outline) so tiny faces stay readable.
    const pick = filled.find((c) => c === 'e' || c === 'm') ?? filled.find((c) => c === 'k') ?? filled[0];
    out.set(x, y, pick);
  }
  return out;
}
