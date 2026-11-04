import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionEvent { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => Recognition;

function getCtor(): Ctor | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechError = 'denied' | 'no-speech' | 'unavailable' | null;

interface Options {
  /** Keep listening across pauses (questionnaire) or stop after one utterance (calls). */
  continuous?: boolean;
  /** Called when a listening session ends, with everything it heard. */
  onDone?: (text: string) => void;
}

/**
 * Browser speech-to-text. The app never records or keeps audio. Depending on the browser (Chrome
 * sends audio to a cloud service), the browser may process it remotely; the intro screen says so.
 * Every session has a generation number: results that arrive after `cancel()`, a new `start()` or
 * unmount are dropped, so a late transcript can never leak into the next question.
 */
export function useSpeech(onFinal: (text: string) => void, { continuous = true, onDone }: Options = {}) {
  const supported = typeof window !== 'undefined' && getCtor() !== null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<SpeechError>(null);
  const rec = useRef<Recognition | null>(null);
  const gen = useRef(0);
  const heard = useRef('');
  const cb = useRef(onFinal);
  const done = useRef(onDone);
  useEffect(() => { cb.current = onFinal; done.current = onDone; }, [onFinal, onDone]);

  /** Stops listening; anything already said is still delivered. */
  const stop = useCallback(() => { rec.current?.stop(); }, []);

  /** Stops and throws away anything still in flight. */
  const cancel = useCallback(() => {
    gen.current++;
    const r = rec.current;
    rec.current = null;
    if (r) { r.onresult = null; r.onend = null; r.onerror = null; try { r.abort(); } catch { /* already stopped */ } }
    setListening(false); setInterim('');
  }, []);

  const start = useCallback(() => {
    const C = getCtor();
    if (!C) { setError('unavailable'); return; }
    cancel();
    const mine = ++gen.current;
    setError(null);
    heard.current = '';
    const r = new C();
    r.continuous = continuous;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      if (gen.current !== mine) return;
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) { const t = res[0].transcript.trim(); heard.current = heard.current ? `${heard.current} ${t}` : t; cb.current(t); }
        else partial += res[0].transcript;
      }
      setInterim(partial);
    };
    r.onerror = (e) => {
      if (gen.current !== mine) return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('denied');
      else if (e.error === 'no-speech') setError('no-speech');
      else if (e.error !== 'aborted') setError('unavailable');
    };
    r.onend = () => {
      if (gen.current !== mine) return;
      setListening(false); setInterim(''); rec.current = null;
      done.current?.(heard.current);
    };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError('unavailable'); }
  }, [cancel, continuous]);

  useEffect(() => () => cancel(), [cancel]);
  return { supported, listening, interim, error, start, stop, cancel };
}

export const speechErrorText = (e: SpeechError): string =>
  e === 'denied' ? 'Microphone access was blocked. You can type instead, or allow the microphone in your browser settings.'
    : e === 'no-speech' ? 'I did not catch anything. Try again, or type.'
    : e === 'unavailable' ? 'Speech recognition is not available right now. Please type.' : '';
