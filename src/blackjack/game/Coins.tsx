import { COIN } from './pixelArt';
import PixelIcon from './PixelIcon';
import type { CoinDrop } from './useRun';

interface Props { coins: CoinDrop[]; onCollect: (id: number) => void; onCollectAll: () => void }

/**
 * Cosmetic coins: flow drops at 75%+ and golden-card bonuses. Each pops out with a pixel starburst
 * near the interaction point and stays until collected: click, tap, mouse hover, the C key or the
 * Collect button. A coin is removed before it is banked, so it can never count twice.
 * Not money; no effect on rules or wagers.
 */
export default function Coins({ coins, onCollect, onCollectAll }: Props) {
  if (coins.length === 0) return null;
  const gold = coins.filter((c) => c.kind === 'gold').length;
  return (
    <>
      <div className="px-coins" aria-hidden="true">
        {coins.map((c) => (
          <button
            key={c.id}
            type="button"
            tabIndex={-1}
            className={`px-coin is-${c.kind}`}
            style={{ left: c.x, top: c.y }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') onCollect(c.id); }}
            onClick={() => onCollect(c.id)}
          >
            <span className="px-coin__burst" />
            <PixelIcon bitmap={COIN} color={c.kind === 'gold' ? '#ffe27a' : 'var(--px-gold)'} outline="#3a2400" scale={3} />
          </button>
        ))}
      </div>
      <button type="button" className="px-btn px-btn--coin" onClick={onCollectAll} aria-keyshortcuts="C">
        Collect {coins.length} {coins.length === 1 ? 'coin' : 'coins'}{gold ? ` (${gold} golden)` : ''} <kbd>C</kbd>
      </button>
    </>
  );
}
