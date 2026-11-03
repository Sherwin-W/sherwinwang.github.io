import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Microphone, SpeakerHigh, Stop } from '@phosphor-icons/react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { buildProfile, isFinished, MAX_QUESTIONS, minutesLeft, needsFollowUp, nextScenario } from './engine';
import ResultsView from './ResultsView';
import { speak, stopSpeaking, useSpeech } from './useSpeech';
import type { Answer, Scenario } from './types';
import '../styles/tokens.css';
import '../components/bento/bento.css';
import '../pages/Home.css';
import './mpti.css';

type Stage = 'welcome' | 'asking' | 'results';

export default function Mpti() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [draft, setDraft] = useState('');
  const [followedUp, setFollowedUp] = useState(false);
  const [carried, setCarried] = useState('');
  const [voiceOn, setVoiceOn] = useState(true);
  const area = useRef<HTMLTextAreaElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const onFinal = useCallback((t: string) => setDraft((d) => (d ? `${d} ${t}` : t)), []);
  const speech = useSpeech(onFinal);

  const prompt = scenario ? (followedUp ? scenario.followUp : scenario.prompt) : '';

  useEffect(() => { if (stage === 'asking') heading.current?.focus(); }, [stage, prompt]);

  const begin = (voice: boolean) => {
    setVoiceOn(voice);
    setAnswers([]); setDraft(''); setCarried(''); setFollowedUp(false);
    setScenario(nextScenario([]));
    setStage('asking');
  };

  const advance = (next: Answer[]) => {
    speech.stop(); stopSpeaking();
    setAnswers(next); setDraft(''); setCarried(''); setFollowedUp(false);
    const upcoming = isFinished(next) ? null : nextScenario(next);
    if (!upcoming) { setScenario(null); setStage('results'); } else setScenario(upcoming);
  };

  const submit = () => {
    if (!scenario) return;
    speech.stop();
    const text = [carried, draft].filter(Boolean).join(' ').trim();
    if (!followedUp && needsFollowUp(scenario, text)) {
      setCarried(text); setDraft(''); setFollowedUp(true);
      return;
    }
    advance([...answers, { scenarioId: scenario.id, text, skipped: false }]);
  };

  const skip = () => scenario && advance([...answers, { scenarioId: scenario.id, text: '', skipped: true }]);

  const reset = () => { speech.stop(); stopSpeaking(); setStage('welcome'); setAnswers([]); setScenario(null); setDraft(''); setCarried(''); setFollowedUp(false); };

  useEffect(() => { if (stage === 'asking' && voiceOn && prompt) speak(prompt); return stopSpeaking; }, [stage, voiceOn, prompt]);

  const errorText = speech.error === 'denied' ? 'Microphone access was blocked. You can type your answer instead, or allow the microphone in your browser settings.'
    : speech.error === 'no-speech' ? 'I did not catch anything. Try again, or type your answer.'
    : speech.error === 'unavailable' ? 'Speech recognition is not available right now. Please type your answer.' : '';

  return (
    <main className="home-page mpti">
      <div className="mpti__bar">
        <a className="mpti__back" href="/"><ArrowLeft aria-hidden="true" /> Portfolio</a>
        <ThemeToggle />
      </div>
      <div className="mpti__panel bento-tile">
        {stage === 'welcome' && (
          <>
            <h1 className="mpti__title">MPTI</h1>
            <p className="mpti__lede">A short conversation about how you approach everyday situations, then an MBTI-inspired reading with the evidence behind it.</p>
            <ul className="mpti__facts">
              <li>About 3 to 5 minutes, up to {MAX_QUESTIONS} questions. You can skip any of them.</li>
              <li>Exploratory and for fun. Not a validated test, not an official MBTI® assessment, and not for hiring or health decisions.</li>
              <li>Your answers stay in this tab. Nothing is sent to my server, stored, or saved after you leave.</li>
              <li>If you use the microphone, <strong>your browser</strong> turns speech into text. In Chrome and Edge that can send audio to the browser vendor’s speech service. This site never records or keeps audio. Typing avoids it entirely.</li>
              <li>The reading is based on the words you use, not on how your voice sounds.</li>
            </ul>
            <div className="mpti__actions">
              <button type="button" className="bento-link bento-link--primary" onClick={() => begin(true)} disabled={!speech.supported} title={speech.supported ? undefined : 'Speech recognition is not supported in this browser'}>
                <Microphone aria-hidden="true" /> Talk it through
              </button>
              <button type="button" className="bento-link" onClick={() => begin(false)}>Type instead</button>
            </div>
            {!speech.supported && <p className="mpti__hint">Voice input is not supported in this browser, so typing is the way to go here.</p>}
          </>
        )}

        {stage === 'asking' && scenario && (
          <>
            <p className="mpti__eyebrow" aria-live="polite">Question {answers.length + 1} of up to {MAX_QUESTIONS} · about {minutesLeft(answers)} min left</p>
            <progress className="mpti__progress" max={MAX_QUESTIONS} value={answers.length} aria-label="Progress" />
            <h2 className="mpti__prompt" tabIndex={-1} ref={heading}>{prompt}</h2>
            {followedUp && <p className="mpti__hint">A quick follow-up. Your earlier answer is kept.</p>}
            <div className="mpti__tools">
              <button type="button" className="bento-link" onClick={() => speak(prompt)}><SpeakerHigh aria-hidden="true" /> Read aloud</button>
              {speech.supported && (
                <button type="button" className={`bento-link${speech.listening ? ' is-live' : ''}`} aria-pressed={speech.listening} onClick={speech.listening ? speech.stop : speech.start}>
                  {speech.listening ? <><Stop aria-hidden="true" /> Stop listening</> : <><Microphone aria-hidden="true" /> Answer by voice</>}
                </button>
              )}
            </div>
            <label className="visually-hidden" htmlFor="mpti-answer">Your answer</label>
            <textarea id="mpti-answer" ref={area} className="mpti__answer" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={speech.listening ? 'Listening… your words appear here. You can edit them before continuing.' : 'Type your answer, or use the microphone. You can edit the transcript.'} />
            {speech.interim && <p className="mpti__interim" aria-hidden="true">{speech.interim}</p>}
            <p className="mpti__hint" role="status">{speech.listening ? 'Microphone is on.' : ''}{errorText}</p>
            <div className="mpti__actions">
              <button type="button" className="bento-link bento-link--primary" onClick={submit} disabled={!draft.trim()}>Continue</button>
              <button type="button" className="bento-link" onClick={skip}>Skip this question</button>
              {answers.filter((a) => !a.skipped).length > 0 && <button type="button" className="bento-link" onClick={() => advance(answers)}>See my results now</button>}
            </div>
          </>
        )}

        {stage === 'results' && <ResultsView profile={buildProfile(answers)} onRestart={reset} onDelete={reset} />}
      </div>
    </main>
  );
}
