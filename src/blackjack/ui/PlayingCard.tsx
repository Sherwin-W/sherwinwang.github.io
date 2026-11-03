import { hiLoCategory, hiLoValue, type Card } from '../engine/cards';
import PixelCard, { type Deck } from '../game/PixelCard';

/** How much counting help to draw on a card. */
export type Assist = 'value' | 'color' | 'none';

const SHAPE = { low: '▲', neutral: '●', high: '▼' } as const;
const WORD = { low: 'counts plus one', neutral: 'counts zero', high: 'counts minus one' } as const;

interface Props { card: Card | null; assist?: Assist; small?: boolean; deck?: Deck }

/** A pixel card with an optional Hi-Lo tag underneath (shape and color, plus the value when guided). */
export default function PlayingCard({ card, assist = 'none', small = false, deck = 'light' }: Props) {
  if (!card) return <span className={`bj-pcard${small ? ' is-small' : ''}`}><PixelCard card={null} deck={deck} /></span>;
  const cat = hiLoCategory(card.rank);
  const v = hiLoValue(card.rank);
  return (
    <span className={`bj-pcard${small ? ' is-small' : ''}${assist !== 'none' ? ` is-${cat}` : ''}`}>
      <PixelCard card={card} deck={deck} note={assist === 'none' ? undefined : WORD[cat]} />
      {assist !== 'none' && (
        <span className="bj-pcard__tag" aria-hidden="true">{SHAPE[cat]}{assist === 'value' && ` ${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`}</span>
      )}
    </span>
  );
}
