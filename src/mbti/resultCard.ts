import type { Reading } from './analysis';
import { DIMENSIONS, POLES, POLE_NAMES } from './scoring';
import type { Dimension, Pole } from './types';

const CONF_SCALE = { unclear: 0, low: 0.35, medium: 0.65, high: 1 } as const;
/** Marker position 0..1 from the left label (first pole) to the right label (second pole). */
export const markerPosition = (lean: number, confidence: keyof typeof CONF_SCALE): number => 0.5 - (lean * CONF_SCALE[confidence]) / 2;

/** A shareable image from the type and leanings only: no quotes, nothing the person said. */
export function renderResultCard(canvas: HTMLCanvasElement, reading: Reading, chosen: Record<Dimension, Pole | null>, appName: string): void {
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#241c3a'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < W; x += 12) { g.fillStyle = '#2d2448'; g.fillRect(x, y, 4, 4); }
  g.fillStyle = '#f4ecdf'; g.fillRect(60, 60, W - 120, H - 120);
  g.fillStyle = '#6b5bd2'; g.fillRect(60, 60, W - 120, 64);
  g.fillStyle = '#f4ecdf'; g.font = '40px VT323, monospace'; g.fillText(appName, 90, 104);
  g.fillStyle = '#1d1730'; g.font = '220px VT323, monospace';
  g.fillText(DIMENSIONS.map((d) => chosen[d] ?? 'X').join(''), 100, 380);
  DIMENSIONS.forEach((d, i) => {
    const y = 470 + i * 120;
    const r = reading.dimensions[d];
    const [a, b] = POLES[d];
    g.fillStyle = '#5a4f6e'; g.font = '34px VT323, monospace';
    g.fillText(POLE_NAMES[a], 100, y); const bw = g.measureText(POLE_NAMES[b]).width; g.fillText(POLE_NAMES[b], W - 100 - bw, y);
    g.fillStyle = '#d9cfe8'; g.fillRect(100, y + 18, W - 200, 16);
    const x = 100 + (W - 200) * markerPosition(r.lean, r.confidence);
    g.fillStyle = '#ff7a59'; g.fillRect(x - 10, y + 8, 20, 36);
  });
  g.fillStyle = '#5a4f6e'; g.font = '28px VT323, monospace';
  g.fillText('Independent, MBTI-inspired self-exploration. Not an official or validated assessment.', 100, 980);
  g.fillText('sherwinwang.dev/mbti', 100, 1010);
}
