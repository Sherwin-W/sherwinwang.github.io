/**
 * Original pixel art for the trainer, drawn as bitmaps. Each bitmap is rows of '#' (ink) and '.'
 * (empty); `toPath` turns one into an SVG path of 1×1 squares for crisp rendering at whole-number scales.
 */
import type { Rank, Suit } from '../engine/cards';

export type Bitmap = readonly string[];

const RANK_GLYPHS: Record<Exclude<Rank, '10'>, Bitmap> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
};
const ONE: Bitmap = ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'];
const ZERO: Bitmap = ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'];

/** "10" is a narrow 1, a gap, and a narrow 0 (8 px wide). */
function joinH(a: Bitmap, b: Bitmap, gap = 1): Bitmap {
  return a.map((row, i) => row + '.'.repeat(gap) + b[i]);
}
export const rankGlyph = (r: Rank): Bitmap => (r === '10' ? joinH(ONE, ZERO) : RANK_GLYPHS[r]);

export const SUIT_SMALL: Record<Suit, Bitmap> = {
  S: ['..#..', '.###.', '#####', '..#..', '.###.'],
  H: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  D: ['..#..', '.###.', '#####', '.###.', '..#..'],
  C: ['.###.', '.###.', '#####', '##.##', '..#..'],
};

export const SUIT_BIG: Record<Suit, Bitmap> = {
  S: ['....#....', '...###...', '..#####..', '.#######.', '#########', '#########', '.##.#.##.', '....#....', '...###...'],
  H: ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....', '.........'],
  D: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  C: ['...###...', '..#####..', '..#####..', '##.###.##', '#########', '#########', '##..#..##', '....#....', '...###...'],
};

export const CROWN: Bitmap = ['#..#..#', '##.#.##', '#######', '#######'];

export const THUMBS_UP: Bitmap = [
  '......##....',
  '.....#..#...',
  '.....#..#...',
  '....#...#...',
  '##.#....####',
  '##.#.......#',
  '##.#....###.',
  '##.#.......#',
  '##.#....###.',
  '##.#.......#',
  '##..#######.',
];

export const COIN: Bitmap = ['..####..', '.#....#.', '#..##..#', '#.#..#.#', '#.#....#', '#..##..#', '.#....#.', '..####..'];

export function width(b: Bitmap): number { return b[0].length; }

/** SVG path for a bitmap at (x, y). With `flip` the bitmap is rotated 180°. */
export function toPath(b: Bitmap, x: number, y: number, flip = false): string {
  const h = b.length, w = b[0].length;
  let d = '';
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (b[r][c] !== '#') continue;
      const px = flip ? x + (w - 1 - c) : x + c;
      const py = flip ? y + (h - 1 - r) : y + r;
      d += `M${px} ${py}h1v1h-1z`;
    }
  }
  return d;
}

/** A filled rectangle with 1px notched corners, as a path. */
export function notchedRect(x: number, y: number, w: number, h: number): string {
  return `M${x + 1} ${y}h${w - 2}v1h1v${h - 2}h-1v1h${-(w - 2)}v-1h-1v${-(h - 2)}h1z`;
}

export const CARD_W = 23;
export const CARD_H = 33;

// ---------- Multi-color sprites (original art) ----------

/** Rows of palette keys; '.' is transparent. */
export type Sprite = readonly string[];
export type SpritePalette = Readonly<Record<string, string>>;

/** One SVG path per palette color. */
export function spritePaths(s: Sprite, palette: SpritePalette): { color: string; d: string }[] {
  return Object.entries(palette)
    .map(([key, color]) => ({ color, d: toPath(s.map((r) => [...r].map((ch) => (ch === key ? '#' : '.')).join('')), 0, 0) }))
    .filter((p) => p.d);
}

export const CAT_PALETTE: SpritePalette = { k: '#1b1326', o: '#f2a541', w: '#fff3e0', p: '#ff7fa8' };
/** Dancing cat, frame A: paws down. */
export const CAT_A: Sprite = [
  '...k........k...',
  '..kok......kok..',
  '..kookkkkkkook..',
  '..kooooooooook..',
  '..kookooookook..',
  '..kopowwwwopok..',
  '..kooowkkwoook..',
  '...kooooooook...',
  '...kooooooook...',
  '..kowwwwwwwwokk.',
  '..kowwwwwwwwokok',
  '..kooooooooookok',
  '..kwwoooooowwkk.',
  '...kkkkkkkkkk...',
];
/** Dancing cat, frame B: paws up by the cheeks. */
export const CAT_B: Sprite = [
  '...k........k...',
  '..kok......kok..',
  '..kookkkkkkook..',
  '.kkooooooooookk.',
  'kwkookooookookwk',
  'kwkopowwwwopokwk',
  '.kkooowkkwoookk.',
  '...kooooooook...',
  '...kooooooook...',
  '..kowwwwwwwwokk.',
  '..kowwwwwwwwokok',
  '..kooooooooookok',
  '..kooooooooookk.',
  '...kkkkkkkkkk...',
];

export const DEALER_PALETTE: SpritePalette = { k: '#14101f', v: '#2fb26b', h: '#4a3426', s: '#f1c27d', w: '#f6f1e3', r: '#d1344b', b: '#2a2d55', g: '#f2c14e' };
/** The dealer NPC: green eyeshade, mustache, bow tie and vest. */
export const DEALER: Sprite = [
  '...kkkkkkkkkk...',
  '..kvvvvvvvvvvk..',
  '.kvvvvvvvvvvvvk.',
  '..kkhhhhhhhhkk..',
  '..khsssssssshk..',
  '..kssksssskssk..',
  '..kssssssssssk..',
  '..kssshhhhsssk..',
  '...ksskkkkssk...',
  '....kssssssk....',
  '..kbbwrrrrwbbk..',
  '.kbbbwwrrwwbbbk.',
  '.kbbbbwwwwbbbbk.',
  '.kbbbbwwgwbbbbk.',
  '.kbbbbwwwwbbbbk.',
  '.kkkkkkkkkkkkkk.',
];
export const DEALER_TALK: Sprite = [
  '...kkkkkkkkkk...',
  '..kvvvvvvvvvvk..',
  '.kvvvvvvvvvvvvk.',
  '..kkhhhhhhhhkk..',
  '..khsssssssshk..',
  '..kssksssskssk..',
  '..kssssssssssk..',
  '..kssshhhhsssk..',
  '...ksskrrkssk...',
  '....kssssssk....',
  '..kbbwrrrrwbbk..',
  '.kbbbwwrrwwbbbk.',
  '.kbbbbwwwwbbbbk.',
  '.kbbbbwwgwbbbbk.',
  '.kbbbbwwwwbbbbk.',
  '.kkkkkkkkkkkkkk.',
];

// ---------- Combo fire (original art) ----------

export const FIRE_PALETTE: SpritePalette = { d: '#8f1d2c', r: '#e8333a', o: '#ff8a2b', y: '#ffd23f', w: '#fff6c2' };
/** Four flame frames, shown in an irregular order by CSS for a natural flicker. */
export const FIRE_FRAMES: Sprite[] = [
  ['....r.......', '....rr......', '...rrr...r..', '...ror..rr..', '..rroor.rr..', '..rooorrror.', '.rrooyoooor.', '.rooyyyooorr', 'rrooyyyyoorr', 'rooyywwyyoor', 'rooywwwwyoor', '.roywwwwyor.', '.rrooyyoorr.', '..ddrrrrdd..'],
  ['......r.....', '.....rr.....', '.r...rrr....', '.rr..ror....', '.rr.roorr...', '.rorrooorr..', '.roooyoorrr.', 'rrooyyyooorr', 'rooyyyyyoorr', 'rooyywwyyoor', 'rooywwwwyoor', '.roywwwwyor.', '.rrooyyoorr.', '..ddrrrrdd..'],
  ['.....r......', '.....rr.....', '....rrr.....', '....rorr....', '...rroor....', '...rooorr.r.', 'r.rooyoorrr.', 'rrrooyyoorr.', 'rooyyyyyoorr', 'rooyywwyyoor', 'rooywwwwyoor', '.roywwwwyor.', '.rrooyyoorr.', '..ddrrrrdd..'],
  ['............', '.......r....', '..r...rr....', '..rr..rrr...', '..ror.roor..', '.rroorroorr.', '.rooooyooor.', 'rrooyyyyoorr', 'rooyyyyyyorr', 'rooyywwyyoor', 'rooywwwwyoor', '.roywwwwyor.', '.rrooyyoorr.', '..ddrrrrdd..'],
];

// ---------- HUD digits (original 5×7 bitmap font, uniform width for steady layouts) ----------

export const DIGITS: Record<string, Bitmap> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': RANK_GLYPHS['2'], '3': RANK_GLYPHS['3'], '5': RANK_GLYPHS['5'], '6': RANK_GLYPHS['6'],
  '7': RANK_GLYPHS['7'], '8': RANK_GLYPHS['8'], '9': RANK_GLYPHS['9'],
  // An open, unmistakable 4 (the card 4 is closed and reads as a blob when small).
  '4': ['#...#', '#...#', '#...#', '#####', '....#', '....#', '....#'],
  '×': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
};

/** Lays out a string of DIGITS glyphs with 1px gaps. Returns the path and the total width. */
export function digitsPath(text: string): { d: string; w: number } {
  let x = 0, d = '';
  for (const ch of text) {
    const g = DIGITS[ch];
    if (!g) continue;
    d += toPath(g, x, 0);
    x += width(g) + 1;
  }
  return { d, w: Math.max(1, x - 1) };
}
