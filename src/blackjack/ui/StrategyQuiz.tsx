import { useMemo, useRef, useState } from 'react';
import { ACTION_LABEL, type Action, type Category } from '../engine/strategy';
import { availableActions, describeHand, explain, strategyQuestion, type StrategyQuestion } from '../engine/drills';
import { mulberry32, randomSeed } from '../engine/rng';
import { recordStrategy, pct } from '../engine/stats';
import type { Rules } from '../engine/rules';
import { upcardValue } from '../engine/cards';
import PlayingCard from './PlayingCard';
import type { ProgressApi } from './useProgress';

type Filter = 'all' | Category;

export default function StrategyQuiz({ rules, api }: { rules: Rules; api: ProgressApi }) {
  const [filter, setFilter] = useState<Filter>('all');
  const rng = useRef(mulberry32(randomSeed()));
  const make = (f: Filter) => strategyQuestion(rng.current, rules, f === 'all' ? ['hard', 'soft', 'pair'] : [f]);
  const [q, setQ] = useState<StrategyQuestion>(() => make('all'));
  const [answer, setAnswer] = useState<Action | null>(null);
  const [streak, setStreak] = useState(0);
  const actions = useMemo(() => availableActions(q), [q]);

  // A new table rule set changes the correct answers, so start a fresh question.
  const rulesKey = JSON.stringify(rules);
  const lastKey = useRef(rulesKey);
  if (lastKey.current !== rulesKey) { lastKey.current = rulesKey; setQ(make(filter)); setAnswer(null); }

  const choose = (a: Action) => {
    if (answer) return;
    const ok = a === q.decision.action;
    setAnswer(a);
    setStreak((s) => (ok ? s + 1 : 0));
    const up = q.upcard.rank === 'A' ? 'A' : String(upcardValue(q.upcard));
    api.update((p) => recordStrategy(p, q.category, `${describeHand(q)} vs ${up}`, ok));
  };
  const next = () => { setQ(make(filter)); setAnswer(null); };
  const changeFilter = (f: Filter) => { setFilter(f); setQ(make(f)); setAnswer(null); };
  const ok = answer === q.decision.action;
  const t = api.progress.strategy;

  return (
    <section className="bj-drill" aria-labelledby="bj-quiz-h">
      <h3 id="bj-quiz-h">Strategy quiz</h3>
      <div className="px-tabs px-tabs--sub" role="group" aria-label="Hand type">
        {(['all', 'hard', 'soft', 'pair'] as Filter[]).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => changeFilter(f)}>{f === 'all' ? 'All hands' : f[0].toUpperCase() + f.slice(1)}</button>)}
      </div>
      <div className="bj-quiz__table">
        <div><p className="bj-label">Dealer shows</p><div className="bj-hand"><PlayingCard card={q.upcard} /></div></div>
        <div><p className="bj-label">Your hand ({describeHand(q)})</p><div className="bj-hand">{q.player.map((x, i) => <PlayingCard key={i} card={x} />)}</div></div>
      </div>
      <div className="bj-actions" role="group" aria-label="Your decision">
        {actions.map((a) => <button key={a} type="button" className="px-btn" disabled={answer !== null} onClick={() => choose(a)}>{ACTION_LABEL[a]}</button>)}
      </div>
      <div className="bj-feedback" role="status" aria-live="polite">
        {answer && (
          <>
            <p className={ok ? 'bj-ok' : 'bj-bad'}>{ok ? 'Correct.' : `Not quite. Basic strategy says ${ACTION_LABEL[q.decision.action].toLowerCase()}.`}</p>
            <p>{explain(q)}</p>
            <button type="button" className="px-btn px-btn--primary" onClick={next} autoFocus>Next hand</button>
          </>
        )}
      </div>
      <p className="bj-stats">Streak {streak} · Hard {pct(t.hard)} · Soft {pct(t.soft)} · Pairs {pct(t.pair)}</p>
    </section>
  );
}
