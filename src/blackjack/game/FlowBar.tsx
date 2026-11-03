import { CAT_A, CAT_B, CAT_PALETTE, THUMBS_UP } from './pixelArt';
import PixelIcon from './PixelIcon';
import PixelSprite from './PixelSprite';
import { FLOW_TIERS, tierOf, type FlowTier } from './run';

interface Props { value: number; reward: { tier: FlowTier; id: number } | null }

/** A dancing pixel cat: two frames swapped by CSS, plus a bounce. Static under reduced motion. */
export function DancingCat({ flip = false }: { flip?: boolean }) {
  return (
    <span className={`px-cat${flip ? ' is-flip' : ''}`} aria-hidden="true">
      <PixelSprite sprite={CAT_A} palette={CAT_PALETTE} scale={3} className="px-cat__a" />
      <PixelSprite sprite={CAT_B} palette={CAT_PALETTE} scale={3} className="px-cat__b" />
    </span>
  );
}

/**
 * Horizontal momentum meter above the table. 25: thumbs-up. 50: Tron border + combo meter (below the bar).
 * 75+: "IN THE FLOW!" in shimmering rainbow type, a rainbow bar and two dancing cats.
 */
export default function FlowBar({ value, reward }: Props) {
  const tier = tierOf(value);
  const popped = reward && reward.tier === tier ? reward.id : 'steady';
  return (
    <div className={`px-flowbar tier-${tier}`}>
      <div className="px-flowbar__banner">
        {tier === 0 && <span className="px-flowbar__hint">Correct decisions, counts and wagers build flow</span>}
        {tier >= 1 && (
          <span key={`thumb-${tier >= 1 ? popped : ''}`} className={`px-flowbar__thumb${reward && reward.tier === 1 && tier === 1 ? ' is-pop' : ''}`}>
            <PixelIcon bitmap={THUMBS_UP} color="var(--px-gold)" scale={3} label="Thumbs up: flow 25% or more" />
          </span>
        )}
        {tier === 3 && (
          <span key={`flow-${popped}`} className="px-inflow">
            <DancingCat />
            <strong className="px-inflow__text" data-text="IN THE FLOW!">IN THE FLOW!</strong>
            <DancingCat flip />
          </span>
        )}
      </div>
      <div className="px-flowbar__row">
        <span className="px-flowbar__label" aria-hidden="true">FLOW</span>
        <div className="px-flowbar__track" role="meter" aria-label="Flow" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={`Flow ${value}%${tier === 3 ? ', in the flow' : ''}`}>
          <span className="px-flowbar__fill" style={{ width: `${value}%` }} />
          {FLOW_TIERS.map((t) => <span key={t} className={`px-flowbar__tick${value >= t ? ' is-passed' : ''}`} style={{ left: `${t}%` }} aria-hidden="true" />)}
        </div>
        <span className="px-flowbar__pct" aria-hidden="true">{value}%</span>
      </div>
    </div>
  );
}
