import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Microphone, Stop } from '@phosphor-icons/react';
import { cleanTranscript } from '../analysis';
import { speechErrorText, useSpeech } from '../useSpeech';

interface Props {
  voice: boolean;
  submitLabel: string;
  onSubmit: (text: string) => void;
  onMicStart?: () => void;
  placeholder?: string;
  extra?: ReactNode;
  autoFocus?: boolean;
  /** True while a character's recording plays: listening stops so their voice is never transcribed. */
  characterSpeaking?: boolean;
}

/**
 * The answer box: a microphone toggle with a clear recording indicator, plus a text box that is always
 * there. Mount it with a `key` per question: unmounting cancels recognition, so a late transcript can
 * never reach the next question.
 */
export default function ResponseInput({ voice, submitLabel, onSubmit, onMicStart, placeholder, extra, autoFocus, characterSpeaking = false }: Props) {
  const [draft, setDraft] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  const onFinal = useCallback((t: string) => setDraft((d) => cleanTranscript(d ? `${d} ${t}` : t)), []);
  const speech = useSpeech(onFinal);

  useEffect(() => { if (autoFocus && !voice) box.current?.focus({ preventScroll: true }); }, [autoFocus, voice]);

  // A replayed line must not end up in the person's answer.
  const { listening, stop: stopListening } = speech;
  useEffect(() => { if (characterSpeaking && listening) stopListening(); }, [characterSpeaking, listening, stopListening]);

  const send = () => {
    const text = cleanTranscript(draft);
    if (!text) return;
    speech.cancel();
    setDraft('');
    onSubmit(text);
  };
  const toggleMic = () => {
    if (speech.listening) { speech.stop(); return; }
    onMicStart?.();
    speech.start();
  };

  return (
    <div className="mb-answer">
      <div className="mb-answer__row">
        {speech.supported && (
          <button type="button" className={`mb-mic${speech.listening ? ' is-live' : ''}${voice ? ' is-primary' : ''}`} aria-pressed={speech.listening} onClick={toggleMic}>
            {speech.listening ? <Stop aria-hidden="true" weight="fill" /> : <Microphone aria-hidden="true" weight="fill" />}
            <span>{speech.listening ? 'Stop' : 'Speak'}</span>
          </button>
        )}
        <div className="mb-answer__field">
          <label className="visually-hidden" htmlFor="mb-answer-box">Your answer</label>
          <textarea id="mb-answer-box" ref={box} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
            placeholder={speech.listening ? 'Listening… your words appear here and can be edited.' : placeholder ?? 'Type your answer, or press Speak.'} />
          {speech.interim && <p className="mb-answer__interim" aria-hidden="true">{speech.interim}</p>}
        </div>
      </div>
      <p className="mb-answer__status" role="status">
        {speech.listening && <><span className="mb-rec" aria-hidden="true" /> Recording. Your browser turns speech into text; nothing is saved.</>}
        {!speech.listening && speechErrorText(speech.error)}
        {!speech.supported && voice && 'Voice input is not supported in this browser, so please type.'}
      </p>
      <div className="mb-actions">
        <button type="button" className="mb-btn mb-btn--primary" onClick={send} disabled={!draft.trim()}>{submitLabel}</button>
        {extra}
      </div>
    </div>
  );
}
