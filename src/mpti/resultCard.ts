import { POLE_NAMES } from './scoring';
import type { Dimension, Pole, Profile } from './types';

const ORDER: Dimension[] = ['EI', 'SN', 'TF', 'JP'];

/** Draws a shareable card from the type and leanings only. No quotes, no transcript. */
export function renderResultCard(canvas: HTMLCanvasElement, profile: Profile, chosen: Record<Dimension, Pole | null>): void {
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) return;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#12151d'); grad.addColorStop(1, '#1b2f6b');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = '#a2a9b8'; g.font = '500 34px system-ui, sans-serif';
  g.fillText('MPTI · a conversational personality exploration', 80, 120);
  g.fillStyle = '#eceef3'; g.font = '700 220px system-ui, sans-serif';
  g.fillText(ORDER.map((d) => chosen[d] ?? 'X').join(''), 80, 380);
  ORDER.forEach((d, i) => {
    const y = 520 + i * 110;
    const r = profile.dimensions[d];
    const label = chosen[d] ? POLE_NAMES[chosen[d] as Pole] : 'Not enough evidence';
    g.fillStyle = '#eceef3'; g.font = '600 40px system-ui, sans-serif'; g.fillText(label, 80, y);
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(560, y - 30, 440, 16);
    const frac = 0.5 + (r.lean * { unclear: 0, low: 0.35, medium: 0.65, high: 1 }[r.confidence]) / 2;
    g.fillStyle = '#6f9bff'; g.fillRect(560 + 440 * frac - 8, y - 38, 16, 32);
    g.fillStyle = '#a2a9b8'; g.font = '400 28px system-ui, sans-serif'; g.fillText(r.confidence, 560, y + 24);
  });
  g.fillStyle = '#a2a9b8'; g.font = '400 26px system-ui, sans-serif';
  g.fillText('Exploratory and for fun. Not a validated test. sherwinwang.dev/mpti', 80, 1020);
}
