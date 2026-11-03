/** Original 8-bit style blips synthesized with Web Audio at runtime. No audio files. Off by default. */
export type Sfx = 'deal' | 'flip' | 'hit' | 'stand' | 'double' | 'split' | 'surrender' | 'good' | 'bad' | 'coin' | 'reward' | 'clear';

type Note = [freq: number, start: number, dur: number, type?: OscillatorType];
const SFX: Record<Sfx, Note[]> = {
  deal: [[880, 0, 0.03, 'square']],
  flip: [[660, 0, 0.03, 'square'], [990, 0.035, 0.03, 'square']],
  hit: [[520, 0, 0.05, 'square']],
  stand: [[220, 0, 0.08, 'triangle']],
  double: [[440, 0, 0.05, 'square'], [880, 0.06, 0.07, 'square']],
  split: [[700, 0, 0.04, 'square'], [500, 0.05, 0.04, 'square']],
  surrender: [[330, 0, 0.08, 'triangle'], [220, 0.09, 0.1, 'triangle']],
  good: [[784, 0, 0.05, 'square'], [1046, 0.05, 0.07, 'square']],
  bad: [[140, 0, 0.16, 'sawtooth']],
  coin: [[988, 0, 0.05, 'square'], [1319, 0.05, 0.09, 'square']],
  reward: [[523, 0, 0.07, 'square'], [659, 0.07, 0.07, 'square'], [784, 0.14, 0.12, 'square']],
  clear: [[523, 0, 0.1, 'square'], [659, 0.1, 0.1, 'square'], [784, 0.2, 0.1, 'square'], [1046, 0.3, 0.25, 'square']],
};

let ctx: AudioContext | null = null;

export function playSfx(name: Sfx, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const t0 = ctx.currentTime;
    for (const [freq, start, dur, type = 'square'] of SFX[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch { /* audio unavailable: stay silent */ }
}
