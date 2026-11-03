import PixelCard from '../../../blackjack/game/PixelCard';

// Decorative: the game's own pixel cards (original art, drawn in code) on a small pixel table.
// Dark dealer cards with a face-down hole card, light player cards, one golden. The tile text carries the meaning.
const DEALER = [{ rank: 'K', suit: 'S' }, null];
const PLAYER = [{ rank: 'A', suit: 'H' }, { rank: '10', suit: 'C', gold: 0 }];

export default function BlackjackPreview() {
  return (
    <div className="bj-preview" aria-hidden="true">
      <div className="bj-preview__table">
        <div className="bj-preview__hand bj-preview__hand--dealer">
          {DEALER.map((c, i) => <PixelCard key={i} card={c} deck="dark" />)}
        </div>
        <div className="bj-preview__hand bj-preview__hand--player">
          {PLAYER.map((c, i) => <PixelCard key={i} card={c} deck="light" />)}
        </div>
      </div>
    </div>
  );
}
