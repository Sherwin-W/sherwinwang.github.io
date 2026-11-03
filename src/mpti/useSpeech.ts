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

/**
 * Browser speech-to-text. The app never records or keeps audio itself. Depending on the
 * browser (Chrome sends audio to a cloud service), the browser may process it remotely.
 * Finished phrases are passed to `onFinal`; the in-progress phrase is `interim`.
 */
export function useSpeech(onFinal: (text: string) => void) {
  const supported = typeof window !== 'undefined' && getCtor() !== null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<SpeechError>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onFinal);
  useEffect(() => { cb.current = onFinal; }, [onFinal]);

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) { setError('unavailable'); return; }
    setError(null);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else partial += res[0].transcript;
      }
      setInterim(partial);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('denied');
      else if (e.error === 'no-speech') setError('no-speech');
      else if (e.error !== 'aborted') setError('unavailable');
    };
    r.onend = () => { setListening(false); setInterim(''); rec.current = null; };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError('unavailable'); }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);
  return { supported, listening, interim, error, start, stop };
}

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
export function stopSpeaking(): void { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
