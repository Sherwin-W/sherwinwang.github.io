import { memo, useId, type CSSProperties } from 'react';
import { cardName, type Card } from '../engine/cards';
import { CARD_H, CARD_W, CROWN, notchedRect, rankGlyph, SUIT_BIG, SUIT_SMALL, toPath, width } from './pixelArt';

/** Dealer cards use the dark deck, player cards the light deck. */
export type Deck = 'dark' | 'light';

interface Palette { edge: string; face: string; shade: string; ink: string; red: string; gold: string }
const PALETTES: Record<Deck, Palette> = {
  light: { edge: '#2b2540', face: '#f4ebd3', shade: '#d9c9a2', ink: '#1d1a2c', red: '#c42f3e', gold: '#b07d12' },
  dark: { edge: '#7c84e0', face: '#1c1f3b', shade: '#13152a', ink: '#ece8ff', red: '#ff6b7c', gold: '#f2c14e' },
};

interface Art { frame: string; face: string; shade: string; ink: string; red: string; gold: string }
const cache = new Map<string, Art>();

/** Builds (and caches) the paths for one card face. */
function faceArt(card: Card): Art {
  const key = card.rank + card.suit;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = rankGlyph(card.rank);
  const gw = width(g);
  const marks =
    toPath(g, 2, 2) + toPath(SUIT_SMALL[card.suit], 2, 10) +
    toPath(g, CARD_W - 2 - gw, CARD_H - 2 - 7, true) + toPath(SUIT_SMALL[card.suit], CARD_W - 7, CARD_H - 15, true);
  const face = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const big = toPath(SUIT_BIG[card.suit], 7, face ? 14 : 12);
  const art: Art = {
    frame: notchedRect(0, 0, CARD_W, CARD_H),
    face: notchedRect(1, 1, CARD_W - 2, CARD_H - 2),
    shade: `M2 ${CARD_H - 2}h${CARD_W - 4}v1h${-(CARD_W - 4)}zM${CARD_W - 2} 2h1v${CARD_H - 4}h-1z`,
    ink: '', red: '', gold: '',
  };
  const red = card.suit === 'H' || card.suit === 'D';
  if (red) art.red = marks + big; else art.ink = marks + big;
  if (face) art.gold = toPath(CROWN, 8, 8);
  if (card.rank === 'A') art.gold = 'M9 10h1v1h-1zM13 10h1v1h-1zM9 22h1v1h-1zM13 22h1v1h-1z';
  cache.set(key, art);
  return art;
}

function backArt(): string {
  let d = '';
  for (let y = 3; y < CARD_H - 3; y++) for (let x = 3; x < CARD_W - 3; x++) if ((x + y) % 2 === 0) d += `M${x} ${y}h1v1h-1z`;
  return d;
}
const BACK_CHECKS = backArt();
const BACK_EMBLEM = toPath(SUIT_BIG.D, 7, 12);

interface Props {
  card: Card | null;
  deck: Deck;
  className?: string;
  style?: CSSProperties;
  /** Extra text for the accessible name, such as a count tag. */
  note?: string;
}

/** Original pixel-art playing card. A null card is drawn face down. */
function PixelCard({ card, deck, className = '', style, note }: Props) {
  const p = PALETTES[deck];
  if (!card) {
    return (
      <svg className={`px-card px-card--back ${className}`} style={style} viewBox={`0 0 ${CARD_W} ${CARD_H}`} role="img" aria-label="Face-down card" shapeRendering="crispEdges">
        <path d={notchedRect(0, 0, CARD_W, CARD_H)} fill="#9aa2ff" />
        <path d={notchedRect(1, 1, CARD_W - 2, CARD_H - 2)} fill="#262a66" />
        <path d={BACK_CHECKS} fill="#363c8c" />
        <path d={BACK_EMBLEM} fill="#f2c14e" />
      </svg>
    );
  }
  const a = faceArt(card);
  const golden = card.gold !== undefined;
  const name = note ? `${cardName(card)}, ${note}` : cardName(card);
  return (
    <svg className={`px-card px-card--${deck}${golden ? ' is-golden' : ''} ${className}`} style={style} viewBox={`0 0 ${CARD_W} ${CARD_H}`} role="img" aria-label={golden ? `${name}, golden card` : name} shapeRendering="crispEdges">
      <path d={a.frame} fill={golden ? '#e9b52f' : p.edge} />
      <path d={a.face} fill={p.face} />
      <path d={a.shade} fill={p.shade} />
      {a.ink && <path d={a.ink} fill={p.ink} />}
      {a.red && <path d={a.red} fill={p.red} />}
      {a.gold && <path d={a.gold} fill={p.gold} />}
      {golden && <GoldLayer />}
    </svg>
  );
}

/**
 * Holographic gold over the normal artwork: a warm tint, a highlight band sweeping across the face,
 * and a few blinking sparkles. Drawn only on face-up cards (a face-down card has no `gold`).
 */
function GoldLayer() {
  const id = useId().replace(/:/g, '');
  return (
    <g className="px-gold" aria-hidden="true">
      <defs>
        <clipPath id={`c${id}`}><path d={notchedRect(1, 1, CARD_W - 2, CARD_H - 2)} /></clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff6cc" stopOpacity=".85" />
          <stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect x="0" y="0" width={CARD_W} height={CARD_H} fill="#f2c14e" fillOpacity=".24" />
        <g transform="skewX(-18)">
          <rect className="px-gold__shine" x="-10" y="-6" width="7" height={CARD_H + 12} fill={`url(#g${id})`} />
        </g>
      </g>
      <path d={`M1 1h1v1h-1zM${CARD_W - 2} 1h1v1h-1zM1 ${CARD_H - 2}h1v1h-1zM${CARD_W - 2} ${CARD_H - 2}h1v1h-1z`} fill="#fff6cc" />
      <rect className="px-gold__spark" x="17" y="4" width="1" height="1" fill="#fffbe6" />
      <rect className="px-gold__spark is-2" x="5" y="22" width="1" height="1" fill="#fffbe6" />
      <rect className="px-gold__spark is-3" x="12" y="27" width="1" height="1" fill="#fffbe6" />
    </g>
  );
}

export default memo(PixelCard);
