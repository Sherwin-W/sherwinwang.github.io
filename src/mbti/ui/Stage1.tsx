import { useEffect, useRef } from 'react';
import { MAX_QUESTIONS } from '../engine';
import { SCENARIOS } from '../scenarios';
import { canFinishStage1, type Action, type State } from '../session';
import ResponseInput from './ResponseInput';
import Window from './Window';

interface Props { state: State; dispatch: (a: Action) => void }

/** Stage 1 questions are shown as text: no recordings of them exist, and they are not synthesised. */
export default function Stage1({ state, dispatch }: Props) {
  const q = SCENARIOS.find((s) => s.id === state.question);
  const heading = useRef<HTMLHeadingElement>(null);
  const prompt = q ? (state.followedUp ? q.followUp : q.prompt) : '';
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [prompt]);
  if (!q) return null;
  const n = state.answers.length + 1;
  return (
    <Window title={`stage 1 · questions`} accent="violet" labelledBy="mb-q" className="mb-stage1">
      <p className="mb-eyebrow">Stage 1 of 2 · Question {n} of up to {MAX_QUESTIONS}</p>
      <ol className="mb-steps" aria-label="Progress">
        {Array.from({ length: MAX_QUESTIONS }, (_, i) => <li key={i} className={i < state.answers.length ? 'is-done' : i === state.answers.length ? 'is-now' : ''}><span className="visually-hidden">{i < state.answers.length ? 'answered' : i === state.answers.length ? 'current' : 'not yet'}</span></li>)}
      </ol>
      <h2 id="mb-q" className="mb-question" tabIndex={-1} ref={heading}>{prompt}</h2>
      {state.followedUp && <p className="mb-hint">A quick follow-up. Your earlier answer is kept.</p>}
      <ResponseInput key={`${q.id}-${state.followedUp}`} voice={state.input === 'voice'} submitLabel="Next" autoFocus
        onSubmit={(text) => dispatch({ type: 'answer', text })}
        extra={<>
          <button type="button" className="mb-btn" onClick={() => dispatch({ type: 'skip' })}>Skip</button>
          {canFinishStage1(state) && <button type="button" className="mb-btn mb-btn--ghost" onClick={() => dispatch({ type: 'finishStage1' })}>Finish questions</button>}
        </>} />
    </Window>
  );
}
