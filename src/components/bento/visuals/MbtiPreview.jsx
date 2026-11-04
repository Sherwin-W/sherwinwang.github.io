import Sprite from '../../../mbti/pixel/Sprite';
import { palette, portrait } from '../../../mbti/pixel/portraits';
import { SCENES } from '../../../mbti/stage2/scenes';

// Decorative: one small pixel character from the app (original art, drawn in code) thinking, with a
// quiet thought bubble. Sized like the Blackjack table so the tiles line up; the tile text carries the meaning.
const WHO = SCENES[0].character.portrait;

export default function MbtiPreview() {
  return (
    <div className="mb-preview" aria-hidden="true">
      <div className="mb-preview__art">
        <svg className="mb-preview__bubble" viewBox="0 0 26 18" shapeRendering="crispEdges">
          <path className="mb-preview__fill" d="M2 1h22v1h1v9h-1v1H2v-1H1V2h1zM4 14h2v2H4zM1 16h1v1H1z" />
          <path className="mb-preview__line" d="M2 0h22v1H2zM24 1h1v1h-1zM25 2h1v9h-1zM24 11h1v1h-1zM2 12h22v1H2zM1 11h1v1H1zM0 2h1v9H0zM1 1h1v1H1zM3 13h4v1H3zM3 14h1v2H3zM6 14h1v2H6zM3 16h4v1H3zM0 15h3v1H0zM0 17h3v1H0zM0 16h1v1H0zM2 16h1v1H2z" />
          <rect className="mb-preview__dot" x="7" y="5" width="2" height="2" />
          <rect className="mb-preview__dot" x="12" y="5" width="2" height="2" />
          <rect className="mb-preview__dot" x="17" y="5" width="2" height="2" />
        </svg>
        <Sprite grid={portrait(WHO, 'thinking')} palette={palette(WHO)} className="mb-preview__face" />
      </div>
    </div>
  );
}
