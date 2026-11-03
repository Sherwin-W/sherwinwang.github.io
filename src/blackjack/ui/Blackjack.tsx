import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_RULES, normalizeRules, type Rules } from '../engine/rules';
import { pct, suggestions } from '../engine/stats';
import Campaign from '../game/Campaign';
import { ExitLink, FullscreenButton } from '../game/ScreenControls';
import { FullscreenContext, useFullscreen } from '../game/useFullscreen';
import CountDrill from './CountDrill';
import Learn from './Learn';
import RulesPanel from './RulesPanel';
import StrategyQuiz from './StrategyQuiz';
import TrueCountDrill from './TrueCountDrill';
import { useProgress } from './useProgress';
import '@fontsource/silkscreen/400.css';
import '@fontsource/silkscreen/700.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import './blackjack.css';
import '../game/game.css';

type Tab = 'campaign' | 'training' | 'manual';
type Drill = 'quiz' | 'count' | 'truecount';
const RULES_KEY = 'blackjack-rules-v1';
const TABS: { id: Tab; name: string }[] = [{ id: 'campaign', name: 'Campaign' }, { id: 'training', name: 'Training' }, { id: 'manual', name: 'Manual' }];

function loadRules(): Rules {
  try { return normalizeRules(JSON.parse(localStorage.getItem(RULES_KEY) ?? '{}')); } catch { return DEFAULT_RULES; }
}

export default function Blackjack() {
  const [tab, setTab] = useState<Tab>('campaign');
  const [drill, setDrill] = useState<Drill>('quiz');
  const [rules, setRules] = useState<Rules>(loadRules);
  const [showRules, setShowRules] = useState(false);
  const [playing, setPlaying] = useState(false);
  const api = useProgress();
  const panel = useRef<HTMLDivElement>(null);
  // Fullscreen targets the whole app, so the HUD and every control stay reachable.
  const root = useRef<HTMLElement>(null);
  const fs = useFullscreen(root);

  useEffect(() => { try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch { /* ignore */ } }, [rules]);
  const onPlaying = useCallback((p: boolean) => setPlaying(p), []);

  const go = (t: 'practice' | 'play', d?: Drill) => { setTab(t === 'play' ? 'campaign' : 'training'); if (d) setDrill(d); window.scrollTo({ top: 0 }); panel.current?.focus(); };
  const p = api.progress;
  const tips = suggestions(p);
  const inRun = playing && tab === 'campaign';

  return (
    <FullscreenContext.Provider value={fs}>
    <main ref={root} className={`bj px-page${inRun ? ' is-playing' : ''}${fs.active ? ' is-fullscreen' : ''}`}>
      {!inRun && (
        <>
          <div className="bj__bar">
            <ExitLink />
            <FullscreenButton />
          </div>
          <header className="bj__head">
            <h1 className="px-title">Blackjack Trainer</h1>
            <p className="px-lead">A pixel command table for basic strategy, Hi-Lo and Wong Halves counting. Practice only: virtual units, no real money, nothing to win.</p>
          </header>
          <div className="bj__nav">
            <div className="px-tabs" role="tablist" aria-label="Mode">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" id={`bj-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="bj-panel" onClick={() => setTab(t.id)}>{t.name}</button>
              ))}
            </div>
            <button type="button" className="px-btn" aria-expanded={showRules} aria-controls="bj-rules" onClick={() => setShowRules((v) => !v)}>Table rules</button>
          </div>
          <div id="bj-rules" hidden={!showRules}>
            <RulesPanel rules={rules} onChange={(r) => setRules(normalizeRules(r))} />
          </div>
        </>
      )}

      <div id="bj-panel" role="tabpanel" aria-labelledby={`bj-tab-${tab}`} tabIndex={-1} ref={panel}>
        {tab === 'campaign' && <Campaign rules={rules} api={api} onPlaying={onPlaying} onOpenRules={() => setShowRules(true)} />}
        {tab === 'manual' && <Learn rules={rules} go={go} />}
        {tab === 'training' && (
          <div className="bj-training">
            <div className="px-tabs px-tabs--sub" role="group" aria-label="Drill">
              <button type="button" aria-pressed={drill === 'quiz'} onClick={() => setDrill('quiz')}>Strategy quiz</button>
              <button type="button" aria-pressed={drill === 'count'} onClick={() => setDrill('count')}>Hi-Lo counting</button>
              <button type="button" aria-pressed={drill === 'truecount'} onClick={() => setDrill('truecount')}>True count</button>
            </div>
            {drill === 'quiz' && <StrategyQuiz rules={rules} api={api} />}
            {drill === 'count' && <CountDrill api={api} />}
            {drill === 'truecount' && <TrueCountDrill api={api} />}
          </div>
        )}
      </div>

      {!inRun && (
        <aside className="bj-progress px-box" aria-label="Your progress">
          <h2 className="px-h">Service record</h2>
          <p>Strategy: hard {pct(p.strategy.hard)} · soft {pct(p.strategy.soft)} · pairs {pct(p.strategy.pair)} · Count checks {pct(p.runningCount)} · True count {pct(p.trueCount)} · Rounds {p.roundsPlayed}</p>
          {tips.length > 0 && <p>Next: {tips[0]}</p>}
          <p className="px-tiny">Saved only in this browser. <button type="button" className="px-link" onClick={api.reset}>Reset progress</button></p>
        </aside>
      )}
    </main>
    </FullscreenContext.Provider>
  );
}
