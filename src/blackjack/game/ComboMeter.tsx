import { FIRE_FRAMES, FIRE_PALETTE } from './pixelArt';
import PixelNumber from './PixelNumber';
import PixelSprite from './PixelSprite';
import { COMBO_UNLOCK, fireStage, type Combo } from './run';

/** The four flame frames stacked; CSS shows them in an irregular order so the flicker never looks looped. */
export function PixelFire({ className = '' }: { className?: string }) {
  return (
    <span className={`px-fire ${className}`} aria-hidden="true">
      {FIRE_FRAMES.map((f, i) => <PixelSprite key={i} sprite={f} palette={FIRE_PALETTE} scale={3} className={`px-fire__f px-fire__f${i}`} />)}
    </span>
  );
}

interface Props { combo: Combo; broken: number; max: boolean }

/**
 * Fighting-game combo meter under the flow bar. Locked below 50% flow; from there each consecutive
 * correct decision adds 1× (no cap). Fire grows 1×–5×, OVERDRIVE (shake, sparks) from 10×,
 * rainbow type at 100% flow. A mistake extinguishes it. The row keeps a fixed height so nothing jumps.
 */
export default function ComboMeter({ combo, broken, max }: Props) {
  const stage = fireStage(combo.count);
  const overdrive = stage === 6;
  return (
    <div className={`px-combo${combo.active ? ' is-active' : ''}${overdrive ? ' is-overdrive' : ''}${max && combo.active ? ' is-max' : ''}`} data-stage={stage} data-count={combo.count}>
      {!combo.active ? (
        <span className="px-combo__locked">Multiplier unlocks at {COMBO_UNLOCK}% flow</span>
      ) : (
        <>
          <span className="px-combo__label">Multiplier</span>
          <PixelNumber key={combo.count} className="px-combo__num" text={`${combo.count}×`} label={`multiplier ${combo.count} times`} rainbow={max} />
          <span className="px-combo__firebox">
            {stage > 0 && <PixelFire className={`is-stage-${stage}`} />}
            {stage === 0 && broken > 0 && <PixelFire key={broken} className="is-out" />}
            {stage >= 3 && <span className="px-embers" aria-hidden="true">{Array.from({ length: overdrive ? 6 : stage - 2 }, (_, i) => <i key={i} />)}</span>}
          </span>
          {overdrive && <span className="px-combo__od">Combo overdrive</span>}
        </>
      )}
    </div>
  );
}
