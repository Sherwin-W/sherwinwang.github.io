/** Pixel backgrounds for the video calls (64×48), drawn in code. Each fits its character's situation. */
import { Grid, type Palette } from './grid';

export type SceneId = 'kitchen' | 'office' | 'living' | 'apartment' | 'diner' | 'park' | 'porch';

export const SCENE_W = 64;
export const SCENE_H = 48;

const dither = (g: Grid, x0: number, y0: number, w: number, h: number, a: string, b: string) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) g.set(x, y, (x + y) % 2 ? a : b);
};

function kitchen(): Grid {
  const g = new Grid(SCENE_W, SCENE_H, 'a');
  dither(g, 0, 36, 64, 12, 'b', 'a');
  g.rect(0, 30, 64, 2, 'c'); g.rect(0, 32, 64, 4, 'd'); // counter
  // Window with the night sky and the moon.
  g.rect(3, 5, 18, 14, 'k'); g.rect(4, 6, 16, 12, 'n'); g.rect(11, 6, 1, 12, 'k'); g.rect(4, 11, 16, 1, 'k');
  g.ellipse(16, 8.5, 1.6, 1.6, 'y'); g.set(6, 8, 'y'); g.set(8, 14, 'y'); g.set(14, 15, 'y');
  // Upper cabinets and a pendant lamp.
  g.rect(42, 3, 20, 10, 'e'); g.rect(42, 3, 20, 1, 'k'); g.rect(52, 3, 1, 10, 'k'); g.set(50, 8, 'k'); g.set(54, 8, 'k');
  g.rect(31, 0, 1, 6, 'k'); g.ellipse(31, 7, 3, 1.5, 'y');
  // Plant on the sill and jars on the counter.
  g.rect(22, 25, 4, 5, 'f'); g.ellipse(24, 23, 3, 2.5, 'g');
  g.rect(48, 25, 3, 5, 'j'); g.rect(53, 26, 3, 4, 'f');
  return g;
}

function office(): Grid {
  const g = new Grid(SCENE_W, SCENE_H, 'a');
  g.rect(0, 38, 64, 10, 'b');
  // Bookshelf.
  g.rect(44, 4, 18, 34, 'd'); g.rect(45, 5, 16, 32, 'e');
  const spines = ['r', 'g', 'y', 'n', 'c', 'r', 'n', 'g'];
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 6 + shelf * 8;
    g.rect(45, y + 6, 16, 1, 'd');
    for (let i = 0; i < 7; i++) g.rect(46 + i * 2, y + (i % 3 === 0 ? 1 : 0), 2, 6 - (i % 3 === 0 ? 1 : 0), spines[(i + shelf) % spines.length]);
  }
  // Framed certificate and a tall plant.
  g.rect(6, 6, 14, 10, 'k'); g.rect(7, 7, 12, 8, 'w'); g.rect(9, 9, 8, 1, 'c'); g.rect(9, 11, 6, 1, 'c'); g.set(16, 13, 'r');
  g.rect(4, 30, 6, 8, 'f'); g.ellipse(7, 26, 4, 5, 'g'); g.ellipse(4, 22, 2, 3, 'g'); g.ellipse(10, 21, 2, 3, 'g');
  return g;
}

function living(): Grid {
  const g = new Grid(SCENE_W, SCENE_H, 'a');
  for (let x = 0; x < 64; x += 4) g.rect(x, 0, 1, 36, 'b'); // wallpaper stripes
  g.rect(0, 36, 64, 12, 'd'); dither(g, 0, 42, 64, 6, 'd', 'e');
  // Window with daylight and curtains.
  g.rect(40, 4, 20, 18, 'k'); g.rect(41, 5, 18, 16, 'n'); g.rect(50, 5, 1, 16, 'k');
  g.rect(38, 3, 4, 22, 'r'); g.rect(58, 3, 4, 22, 'r');
  g.ellipse(46, 11, 3, 1.5, 'w'); g.ellipse(54, 15, 2, 1, 'w');
  // Photos on the wall: one of an old bus.
  g.rect(4, 6, 12, 9, 'k'); g.rect(5, 7, 10, 7, 'y'); g.rect(6, 9, 8, 3, 'c'); g.rect(7, 12, 1, 1, 'k'); g.rect(12, 12, 1, 1, 'k'); g.rect(7, 9, 2, 1, 'n'); g.rect(10, 9, 2, 1, 'n');
  g.rect(18, 9, 6, 7, 'k'); g.rect(19, 10, 4, 5, 'g');
  // Lamp.
  g.rect(31, 18, 1, 18, 'k'); g.stamp(27, 12, ['..#####..', '.#######.', '#########'], 'y');
  return g;
}

function apartment(): Grid {
  const g = new Grid(SCENE_W, SCENE_H, 'a');
  g.rect(0, 38, 64, 10, 'b');
  // Mountain poster and a gig poster.
  g.rect(4, 5, 16, 12, 'k'); g.rect(5, 6, 14, 10, 'n'); g.stamp(5, 9, ['......#.......', '.....###......', '....#####..#..', '...#######.###', '.############.', '##############', '##############'], 'g'); g.set(15, 7, 'y');
  g.rect(46, 6, 10, 14, 'k'); g.rect(47, 7, 8, 12, 'r'); g.rect(48, 9, 6, 2, 'y'); g.rect(48, 13, 4, 1, 'w'); g.rect(48, 15, 5, 1, 'w');
  // String lights.
  for (let x = 0; x < 64; x++) g.set(x, 2 + Math.round(Math.sin(x / 5) * 1.2), 'k');
  for (let x = 2; x < 64; x += 6) g.set(x, 3 + Math.round(Math.sin(x / 5) * 1.2), (x / 6) % 2 ? 'y' : 'c');
  // Plant shelf.
  g.rect(24, 24, 16, 2, 'd'); g.rect(26, 20, 3, 4, 'f'); g.ellipse(27.5, 18, 2.5, 2, 'g'); g.rect(34, 21, 3, 3, 'j');
  return g;
}

function diner(): Grid {
  const g = new Grid(SCENE_W, SCENE_H, 'a');
  for (let x = 0; x < 64; x += 2) for (let y = 40; y < 48; y++) g.set(x + (y % 2), y, 'b'); // checker floor
  g.rect(0, 26, 64, 3, 'r'); g.rect(0, 29, 64, 1, 'k'); // booth back
  // Window with the street at dusk and a neon sign.
  g.rect(4, 4, 30, 18, 'k'); g.rect(5, 5, 28, 16, 'n'); g.rect(5, 15, 28, 6, 'd'); g.rect(19, 5, 1, 16, 'k');
  g.rect(8, 11, 6, 4, 'y'); g.rect(24, 9, 5, 6, 'y');
  g.stamp(40, 6, ['#.#.###.#.#', '#.#.#...#.#', '###.##..###', '#.#.#.....#', '#.#.###...#'], 'c');
  g.rect(39, 4, 13, 1, 'c'); g.rect(39, 12, 13, 1, 'c');
  // Milkshake and fries on the table.
  g.rect(0, 36, 64, 2, 'e');
  g.rect(50, 28, 4, 8, 'w'); g.rect(51, 26, 1, 3, 'r'); g.rect(56, 32, 5, 4, 'r'); g.rect(57, 29, 1, 3, 'y'); g.rect(59, 30, 1, 2, 'y');
  return g;
}

function park(): Grid {
  const g = new Grid(SCENE_W, SCENE_H, 'a');
  g.rect(0, 30, 64, 18, 'b'); dither(g, 0, 40, 64, 8, 'b', 'c');
  // Hills, a tree and a lamp post at golden hour.
  g.ellipse(14, 34, 22, 8, 'c'); g.ellipse(52, 33, 18, 6, 'c');
  g.rect(52, 14, 3, 18, 'd'); g.ellipse(53, 11, 9, 8, 'g'); g.ellipse(48, 15, 4, 3, 'g'); g.ellipse(58, 15, 4, 3, 'g');
  g.rect(8, 10, 1, 24, 'k'); g.stamp(6, 7, ['.###.', '#yyy#', '.###.'], 'k');
  g.ellipse(30, 6, 3, 3, 'y');
  for (const [x, y] of [[20, 4], [38, 8], [44, 3]]) { g.set(x, y, 'w'); g.set(x + 1, y, 'w'); }
  // Bench slats behind the shoulders.
  g.rect(0, 33, 64, 2, 'e'); g.rect(0, 36, 64, 2, 'e');
  return g;
}

function porch(): Grid {
  const g = new Grid(SCENE_W, SCENE_H, 'a');
  for (let y = 0; y < 34; y += 3) g.rect(0, y, 64, 1, 'b'); // wooden siding
  // Window glowing at dusk, with a sill plant.
  g.rect(4, 6, 20, 16, 'k'); g.rect(5, 7, 18, 14, 'n'); g.rect(13, 7, 1, 14, 'k'); g.rect(5, 13, 18, 1, 'k');
  g.rect(6, 15, 6, 5, 'y'); g.rect(15, 8, 6, 4, 'y');
  g.rect(3, 22, 22, 2, 'd'); g.rect(8, 19, 3, 3, 'f'); g.ellipse(9.5, 18, 2.5, 2, 'g');
  // Lantern by the door.
  g.rect(44, 6, 1, 4, 'k'); g.stamp(42, 10, ['.###.', '#yyy#', '#yyy#', '.###.'], 'k');
  // Hanging plant.
  g.rect(55, 0, 1, 7, 'k'); g.rect(53, 7, 5, 3, 'f'); g.ellipse(55.5, 11, 4, 2.5, 'g'); g.set(52, 13, 'g'); g.set(59, 14, 'g');
  // Railing and floor boards.
  g.rect(0, 34, 64, 2, 'c'); for (let x = 1; x < 64; x += 5) g.rect(x, 36, 2, 7, 'c');
  g.rect(0, 43, 64, 5, 'd'); dither(g, 0, 45, 64, 3, 'd', 'e');
  return g;
}

const BUILDERS: Record<SceneId, () => Grid> = { kitchen, office, living, apartment, diner, park, porch };

export const SCENE_PALETTES: Record<SceneId, Palette> = {
  kitchen: { a: '#f4c9a6', b: '#e3a983', c: '#8a5a44', d: '#b97a57', e: '#e8dcc6', k: '#3b2a3a', n: '#283a6b', y: '#ffe08a', f: '#c86b4a', g: '#5aa36b', j: '#7fb7c9' },
  office: { a: '#d8dfe8', b: '#9aa6b8', c: '#6b7488', d: '#6b4a3a', e: '#8a6450', k: '#2f3346', w: '#fdf7ee', r: '#c9584a', g: '#4f9a6c', y: '#e8b04b', n: '#4a62a8', f: '#b97a57' },
  living: { a: '#ead9b5', b: '#dcc59a', d: '#8a5a44', e: '#7a4e3b', k: '#3b2a2a', n: '#9fd2f0', w: '#ffffff', r: '#b8505a', y: '#f3c86b', c: '#e0853f', g: '#6f9a6a' },
  diner: { a: '#f6e7c8', b: '#2f3346', k: '#2f2433', n: '#5b4a8a', d: '#3b3360', y: '#ffd166', c: '#ff6f91', r: '#c9473f', e: '#e8dcc6', w: '#fdf7ee' },
  park: { a: '#ffcf9e', b: '#7fb069', c: '#5f9a55', d: '#7a5236', g: '#3f7a4a', k: '#2f2a33', y: '#fff1b8', w: '#fffaf0', e: '#8a5a44' },
  porch: { a: '#c98f6a', b: '#b57a58', c: '#f2e6d0', d: '#7a4e3b', e: '#6a4232', k: '#2f2433', n: '#4a5a9a', y: '#ffd98a', f: '#c86b4a', g: '#5aa36b' },
  apartment: { a: '#bfe3d0', b: '#8cc7b0', k: '#2f3a46', n: '#9fc7f0', g: '#4f8a6c', y: '#ffd166', w: '#fdf7ee', r: '#7b5cd6', c: '#ff7a59', d: '#8a6450', f: '#d98a5a', j: '#f2a6c4' },
};

const cache = new Map<SceneId, Grid>();
export function scene(id: SceneId): Grid {
  let g = cache.get(id);
  if (!g) { g = BUILDERS[id](); cache.set(id, g); }
  return g;
}

/** A pizza slice Lena holds up to the camera (drawn over her shoulder). */
export const PIZZA = new Grid(14, 12).stamp(0, 0, [
  '.kkkkkkkkkkkk.',
  'kccccccccccccck'.slice(0, 14),
  'kcyyyyyyyyyyck',
  '.kyrryygyyrrk.',
  '.kyrryyyyyrrk.',
  '..kyyygyyyyk..',
  '..kyyyyrryk...',
  '...kyyyrrk....',
  '...kyyyyk.....',
  '....kygk......',
  '....kyk.......',
  '.....k........',
]);
export const PIZZA_PALETTE: Palette = { k: '#3b2a3a', c: '#c98a4a', y: '#ffd166', r: '#c9473f', g: '#5aa36b' };
