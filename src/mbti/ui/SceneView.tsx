import Sprite from '../pixel/Sprite';
import { scene, SCENE_PALETTES, type SceneId } from '../pixel/scenes';
import type { Expression, PortraitSpec } from '../pixel/portraits';
import Portrait from './Portrait';

interface Props { setting: SceneId; spec: PortraitSpec; expression: Expression; speaking: boolean; still?: boolean; name: string }

/** The "video" in a call: the scene behind the character, both drawn as pixel art. */
export default function SceneView({ setting, spec, expression, speaking, still, name }: Props) {
  return (
    <div className={`mb-video${speaking ? ' is-speaking' : ''}`}>
      <Sprite grid={scene(setting)} palette={SCENE_PALETTES[setting]} className="mb-video__bg" />
      <div className="mb-video__person">
        <Portrait spec={spec} expression={expression} speaking={speaking} still={still} label={`${name}${speaking ? ', speaking' : ''}`} />
      </div>
    </div>
  );
}
