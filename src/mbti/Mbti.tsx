import { useEffect, useReducer, useState } from 'react';
import { ArrowLeft, ArrowCounterClockwise, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { SHORT_NAME } from './brand';
import { initialState, reducer } from './session';
import { useVoice } from './stage2/voice';
import Intro from './ui/Intro';
import Results from './ui/Results';
import SceneCall from './ui/SceneCall';
import SceneSelect from './ui/SceneSelect';
import Stage1 from './ui/Stage1';
import Transition from './ui/Transition';
import '@fontsource/vt323/400.css';
import './mbti.css';

const speechSupported = () => typeof window !== 'undefined' && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
const prefersReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Mbti() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [muted, setMuted] = useState(false);
  const [reduceMotion] = useState(prefersReduced);
  const voice = useVoice({ muted });

  // Leaving a screen stops any voice that is still playing.
  const stopVoice = voice.stop;
  useEffect(() => { stopVoice(); }, [state.phase, stopVoice]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [state.phase, state.active]);

  const reset = () => { voice.stop(); dispatch({ type: 'reset' }); };
  const inSession = state.phase !== 'intro';

  return (
    <div className={`mb${reduceMotion ? ' mb--still' : ''}`}>
      <header className="mb-menubar">
        <a className="mb-menubar__item" href="/"><ArrowLeft aria-hidden="true" /> Exit to Portfolio</a>
        <span className="mb-menubar__name" aria-hidden="true">{SHORT_NAME}</span>
        <span className="mb-menubar__right">
          <button type="button" className="mb-menubar__item" aria-pressed={muted} onClick={() => { setMuted((m) => !m); voice.stop(); }}>
            {muted ? <SpeakerSlash aria-hidden="true" /> : <SpeakerHigh aria-hidden="true" />} {muted ? 'Voices off' : 'Voices on'}
          </button>
          {inSession && <button type="button" className="mb-menubar__item" onClick={reset}><ArrowCounterClockwise aria-hidden="true" /> Reset</button>}
        </span>
      </header>
      <main className="mb-desk" key={state.phase + (state.active ?? '')}>
        {state.phase === 'intro' && <Intro speechSupported={speechSupported()} onStart={(v) => dispatch({ type: 'start', input: v ? 'voice' : 'text' })} />}
        {state.phase === 'stage1' && <Stage1 state={state} dispatch={dispatch} />}
        {state.phase === 'transition' && <Transition onContinue={() => dispatch({ type: 'toScenes' })} />}
        {state.phase === 'scenes' && <SceneSelect state={state} dispatch={dispatch} />}
        {state.phase === 'scene' && state.active && <SceneCall state={state} dispatch={dispatch} voice={voice} muted={muted} onToggleMute={() => { setMuted((m) => !m); voice.stop(); }} reduceMotion={reduceMotion} />}
        {state.phase === 'results' && <Results state={state} onRestart={reset} />}
      </main>
    </div>
  );
}
