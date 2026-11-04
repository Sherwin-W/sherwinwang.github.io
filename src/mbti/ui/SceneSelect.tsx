import { CheckCircle } from '@phosphor-icons/react';
import Sprite from '../pixel/Sprite';
import { scene, SCENE_PALETTES } from '../pixel/scenes';
import { canSeeResults, scenesDone, type Action, type State } from '../session';
import { MIN_SCENES, SCENES } from '../stage2/scenes';
import Portrait from './Portrait';
import Window from './Window';

interface Props { state: State; dispatch: (a: Action) => void }

/** The scene picker: little windows into each situation. */
export default function SceneSelect({ state, dispatch }: Props) {
  const done = scenesDone(state);
  return (
    <Window title="stage 2 · scenes" accent="mint" labelledBy="mb-sel-h" className="mb-select">
      <p className="mb-eyebrow">Stage 2 of 2 · {done} of {SCENES.length} scenes</p>
      <h2 id="mb-sel-h" className="mb-h2">Pick a scene</h2>
      <ul className="mb-cards">
        {SCENES.map((s) => {
          const st = state.scenes[s.id];
          const finished = st?.done;
          return (
            <li key={s.id}>
              <button type="button" className={`mb-card${finished ? ' is-done' : ''}`} onClick={() => dispatch({ type: 'openScene', id: s.id })} aria-label={`${s.title}: ${s.situation}${finished ? ' Done.' : ''}`}>
                <span className="mb-card__view" aria-hidden="true">
                  <Sprite grid={scene(s.setting)} palette={SCENE_PALETTES[s.setting]} className="mb-card__bg" />
                  <span className="mb-card__face"><Portrait spec={s.character.portrait} expression={s.expression} speaking={false} still /></span>
                  {finished && <span className="mb-card__done"><CheckCircle weight="fill" /></span>}
                </span>
                <span className="mb-card__title">{s.title}</span>
                <span className="mb-card__who">{s.character.name} · {s.character.meta}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mb-actions">
        <button type="button" className="mb-btn mb-btn--primary" disabled={!canSeeResults(state)} onClick={() => dispatch({ type: 'results' })}>See my reading</button>
        {!canSeeResults(state) && <p className="mb-hint">{MIN_SCENES - done} more {MIN_SCENES - done === 1 ? 'scene' : 'scenes'} to unlock your reading. All {SCENES.length} give the steadiest result.</p>}
      </div>
    </Window>
  );
}
