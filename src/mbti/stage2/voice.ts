import { useCallback, useEffect, useRef, useState } from 'react';
import { clipSrc, type VoiceClip } from './voiceLines';

/** Rough speaking time for a line with no audio, so the face still talks while the subtitle shows. */
export const estimatedDuration = (text: string) => Math.min(9000, 600 + text.split(/\s+/).length * 300);

/**
 * What happened to the last line:
 * - `playing` / `done`: the human recording played.
 * - `missing`: no recording exists for this line; it is shown as text only.
 * - `failed`: a recording exists but would not load or play; shown as text.
 * - `blocked`: the browser refused to start audio without a tap; the caller offers a play button.
 * - `muted`: voices are off.
 */
export type VoiceStatus = 'idle' | 'playing' | 'done' | 'missing' | 'failed' | 'blocked' | 'muted';

export interface Line { id: string; text: string; clip?: VoiceClip }

/**
 * Plays a character's prerecorded lines in order. There is no speech synthesis: a line without a
 * working recording is shown as a subtitle only. `speaking` follows the real audio (or an estimate
 * when silent) so the mouth animation and the microphone hold stay in sync. A new `play` or `stop`
 * invalidates everything still in flight, so nothing from an old scene can play late.
 */
export function useVoice({ muted }: { muted: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [current, setCurrent] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current++;
    if (audio.current) { const a = audio.current; a.onended = null; a.onerror = null; a.pause(); audio.current = null; }
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    setSpeaking(false);
    setCurrent(null);
  }, []);

  useEffect(() => stop, [stop]);

  // Leaving or hiding the page stops any voice.
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') stop(); };
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', hide); };
  }, [stop]);

  const play = useCallback((lines: Line[]) => {
    stop();
    const mine = token.current;
    const alive = () => token.current === mine;
    let worst: VoiceStatus = muted ? 'muted' : 'done';
    const note = (s: VoiceStatus) => { if (s === 'blocked' || s === 'failed' || (s === 'missing' && worst === 'done')) worst = s; };

    const finish = () => { if (!alive()) return; setSpeaking(false); setCurrent(null); setStatus(worst); };
    const silent = (line: Line, next: () => void) => {
      timer.current = window.setTimeout(() => { if (alive()) next(); }, estimatedDuration(line.text));
    };
    const step = (i: number) => {
      if (!alive()) return;
      if (i >= lines.length) { finish(); return; }
      const line = lines[i];
      const next = () => step(i + 1);
      setCurrent(line.id);
      setSpeaking(true);
      if (muted) { silent(line, next); return; }
      if (!line.clip) { note('missing'); setStatus('missing'); silent(line, next); return; }
      const a = new Audio(clipSrc(line.clip));
      a.preload = 'auto';
      audio.current = a;
      const failed = () => { if (!alive()) return; audio.current = null; note('failed'); setStatus('failed'); silent(line, next); };
      a.onended = () => { if (alive()) { audio.current = null; next(); } };
      a.onerror = failed;
      setStatus('playing');
      a.play().catch((e: unknown) => {
        if (!alive()) return;
        if ((e as { name?: string })?.name === 'NotAllowedError') {
          // Autoplay refused: stop here and let the person start it with a tap (Replay).
          a.onended = null; a.onerror = null; audio.current = null;
          worst = 'blocked'; setSpeaking(false); setCurrent(null); setStatus('blocked');
          return;
        }
        failed();
      });
    };
    setStatus(muted ? 'muted' : 'playing');
    step(0);
  }, [muted, stop]);

  return { speaking, status, current, play, stop };
}

/** Tiny original UI sounds (ring, connect, hang up), made with Web Audio. */
let ctx: AudioContext | null = null;
export function blip(kind: 'ring' | 'connect' | 'hangup', on: boolean): void {
  if (!on || typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const notes: Record<typeof kind, [number, number, number][]> = {
      ring: [[660, 0, 0.16], [880, 0.2, 0.16]],
      connect: [[523, 0, 0.08], [784, 0.09, 0.12]],
      hangup: [[440, 0, 0.1], [330, 0.11, 0.16]],
    };
    const t0 = ctx.currentTime;
    for (const [f, s, d] of notes[kind]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0.035, t0 + s); g.gain.exponentialRampToValueAtTime(0.0001, t0 + s + d);
      o.connect(g).connect(ctx.destination); o.start(t0 + s); o.stop(t0 + s + d + 0.02);
    }
  } catch { /* audio unavailable */ }
}
