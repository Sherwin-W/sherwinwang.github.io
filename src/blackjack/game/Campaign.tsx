import { useCallback, useEffect, useReducer, useState } from 'react';
import { describeRules, type Rules } from '../engine/rules';
import { randomSeed } from '../engine/rng';
import type { ProgressApi } from '../ui/useProgress';
import { campaignReducer, DIFFICULTY_KEY, initialCampaign } from './campaignState';
import RunScreen from './RunScreen';
import { ASSIST_THRESHOLDS, DEALER_PAID_FROM, DIFFICULTIES, type Difficulty, type Grade } from './run';
import type { Settings } from './useRun';

const SETTINGS_KEY = 'blackjack-settings-v1';
const BEST_KEY = 'blackjack-campaign-v1';
const ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D'];

const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadSettings(): Settings {
  const base: Settings = { sound: false, reduceMotion: prefersReduced(), reduceFlashing: prefersReduced(), aceTracking: false };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return base; }
}
function loadBest(): Partial<Record<Difficulty, Grade>> {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}'); } catch { return {}; }
}

/** `?seed=123` replays the same shoe (handy for practice and for tests). */
function seedFromUrl(): number | null {
  try {
    const s = new URLSearchParams(window.location.search).get('seed');
    return s !== null && /^\d{1,10}$/.test(s) ? Number(s) >>> 0 : null;
  } catch { return null; }
}
const nextSeed = () => seedFromUrl() ?? randomSeed();

interface Props { rules: Rules; api: ProgressApi; onOpenRules: () => void; onPlaying: (playing: boolean) => void }

export default function Campaign({ rules, api, onOpenRules, onPlaying }: Props) {
  const [state, dispatch] = useReducer(campaignReducer, undefined, initialCampaign);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [best, setBest] = useState(loadBest);
  const { selected, run } = state;

  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } }, [settings]);
  useEffect(() => { try { localStorage.setItem(DIFFICULTY_KEY, selected); } catch { /* ignore */ } }, [selected]);
  useEffect(() => { onPlaying(run !== null); }, [run, onPlaying]);

  const start = () => dispatch({ type: 'start', seed: nextSeed(), best: best[selected] ?? null });
  const switchTo = useCallback((d: Difficulty) => dispatch({ type: 'switch', difficulty: d, seed: nextSeed(), best: best[d] ?? null }), [best]);
  const again = useCallback(() => { if (run) switchTo(run.difficulty); }, [run, switchTo]);
  const abandon = useCallback(() => dispatch({ type: 'abandon' }), []);
  const complete = useCallback((d: Difficulty, g: Grade) => {
    setBest((b) => {
      const prev = b[d];
      const next = !prev || ORDER.indexOf(g) < ORDER.indexOf(prev) ? { ...b, [d]: g } : b;
      try { localStorage.setItem(BEST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  if (run) {
    return (
      <div className={`px-scope${settings.reduceMotion ? ' px-reduce-motion' : ''}`}>
        <RunScreen
          key={run.id}
          difficulty={run.difficulty}
          rules={rules}
          seed={run.seed}
          settings={settings}
          api={api}
          best={run.best}
          onComplete={complete}
          onAgain={again}
          onSwitch={switchTo}
          onBrief={abandon}
        />
      </div>
    );
  }

  const sel = DIFFICULTIES[selected];
  return (
    <div className={`px-scope${settings.reduceMotion ? ' px-reduce-motion' : ''}`}>
      <section className="px-brief" aria-labelledby="px-brief-h">
        <h2 id="px-brief-h" className="px-h px-h--lg">Mission briefing</h2>
        <p className="px-lead">Clear a full {rules.decks}-deck shoe ({rules.decks * 52} cards) with as few errors as possible. You are graded on decisions, count, true count and practice wagers. Winning hands is luck and is not scored.</p>

        <div className="px-units" role="radiogroup" aria-label="Difficulty">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((id, i) => {
            const d = DIFFICULTIES[id];
            return (
              <button key={id} type="button" role="radio" aria-checked={selected === id} className="px-unit" onClick={() => dispatch({ type: 'select', difficulty: id })}>
                <span className="px-unit__rank" aria-hidden="true">{'▮'.repeat(i + 1)}</span>
                <span className="px-unit__name">{d.name}</span>
                <span className="px-unit__focus">{d.focus}</span>
                <span className="px-unit__blurb">{d.blurb}</span>
                {best[id] && <span className="px-unit__best">Best grade {best[id]}</span>}
              </button>
            );
          })}
        </div>

        {sel.system ? (
          <p className="px-tiny">At {ASSIST_THRESHOLDS.counter} exposed cards the manual counter and the true-count calculator go offline; at {ASSIST_THRESHOLDS.aces} the ace tracker goes offline and the dealer starts charging coins for advice (1, then 2, 3…). You are warned before each change.</p>
        ) : (
          <p className="px-tiny">Recruit has no counting tools. Ask the Dealer stays free all shoe.</p>
        )}
        <p className="px-tiny px-dim">Golden cards: 25–50 cards in a six-deck shoe shimmer gold. A correct, unassisted decision involving one drops a bonus coin, once per card. Coins buy advice after {DEALER_PAID_FROM} cards; they are never money and reset every run.</p>

        <fieldset className="px-options">
          <legend className="px-h">Options</legend>
          <label><input type="checkbox" checked={settings.sound} onChange={(e) => set('sound', e.target.checked)} /> Sound effects</label>
          <label><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => set('reduceMotion', e.target.checked)} /> Reduce motion</label>
          <label><input type="checkbox" checked={settings.reduceFlashing} onChange={(e) => set('reduceFlashing', e.target.checked)} /> Reduce flashing</label>
          {/* Not available in Recruit (no counting there). This is a per-mode setting, unrelated to the in-run OFFLINE state. */}
          <label className={`px-opt${sel.system ? '' : ' is-unavailable'}`} aria-disabled={!sel.system || undefined}>
            <input type="checkbox" checked={!!sel.system && settings.aceTracking} disabled={!sel.system} aria-describedby="px-ace-note" onChange={(e) => set('aceTracking', e.target.checked)} />
            <span className="px-opt__text">
              Ace side count at checkpoints
              <span id="px-ace-note" className="px-opt__note">{sel.system ? 'Checkpoints also ask how many aces you have seen.' : 'Available in advanced modes (Operator, Grandmaster).'}</span>
            </span>
          </label>
        </fieldset>

        <p className="px-tiny">Table: {describeRules(rules)}. <button type="button" className="px-link" onClick={onOpenRules}>Change table rules</button></p>
        <p className="px-tiny px-dim">Endurance format: the shoe is dealt to the last card with no reshuffle, which real casinos do not do. Rounds stop once one might not finish; the remaining cards are revealed in a counting sprint.</p>
        <button type="button" className="px-btn px-btn--primary px-btn--big" onClick={start}>Deploy · {sel.name}</button>
      </section>
    </div>
  );
}
