import { useEffect, useState } from 'react';
import Sprite from '../pixel/Sprite';
import { palette, portrait, type Expression, type Mouth, type PortraitSpec } from '../pixel/portraits';

interface Props { spec: PortraitSpec; expression: Expression; speaking: boolean; still?: boolean; className?: string; label?: string }

/** A character face: mouth frames while speaking, an occasional blink. `still` turns both off. */
export default function Portrait({ spec, expression, speaking, still = false, className, label }: Props) {
  const [mouth, setMouth] = useState<Mouth>('rest');
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (!speaking || still) { setMouth('rest'); return; }
    const frames: Mouth[] = ['open', 'mid', 'rest', 'open', 'mid', 'open', 'rest'];
    let i = 0;
    let t: number;
    const tick = () => { setMouth(frames[i++ % frames.length]); t = window.setTimeout(tick, 90 + ((i * 37) % 90)); };
    tick();
    return () => window.clearTimeout(t);
  }, [speaking, still]);

  useEffect(() => {
    if (still) return;
    let t: number;
    const loop = () => { t = window.setTimeout(() => { setBlink(true); t = window.setTimeout(() => { setBlink(false); loop(); }, 130); }, 2600 + ((Date.now() / 7) % 2400)); };
    loop();
    return () => window.clearTimeout(t);
  }, [still]);

  return <Sprite grid={portrait(spec, expression, mouth, blink)} palette={palette(spec)} className={className} label={label} />;
}
