import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { speechErrorText, useSpeech } from './useSpeech';

type Handler = ((e: unknown) => void) | null;
class FakeRecognition {
  static last: FakeRecognition | null = null;
  continuous = false; interimResults = false; lang = '';
  onresult: Handler = null; onerror: Handler = null; onend: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  constructor() { FakeRecognition.last = this; }
  say(text: string, isFinal = true) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] }); }
}

beforeEach(() => { vi.stubGlobal('SpeechRecognition', FakeRecognition); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); FakeRecognition.last = null; });

describe('useSpeech', () => {
  it('delivers final results and shows interim ones', () => {
    const heard: string[] = [];
    const { result } = renderHook(() => useSpeech((t) => heard.push(t)));
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => FakeRecognition.last!.say('I like', false));
    expect(result.current.interim).toBe('I like');
    act(() => FakeRecognition.last!.say('I like plans'));
    expect(heard).toEqual(['I like plans']);
  });

  it('drops results that arrive after cancel, so nothing leaks into the next question', () => {
    const heard: string[] = [];
    const { result } = renderHook(() => useSpeech((t) => heard.push(t)));
    act(() => result.current.start());
    const old = FakeRecognition.last!;
    const late = old.onresult!;
    act(() => result.current.cancel());
    act(() => late({ resultIndex: 0, results: [Object.assign([{ transcript: 'late words' }], { isFinal: true })] }));
    expect(heard).toEqual([]);
    expect(old.abort).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('drops results from an earlier session after a restart', () => {
    const heard: string[] = [];
    const { result } = renderHook(() => useSpeech((t) => heard.push(t)));
    act(() => result.current.start());
    const first = FakeRecognition.last!;
    const late = first.onresult;
    act(() => result.current.start());
    act(() => late?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'old' }], { isFinal: true })] }));
    act(() => FakeRecognition.last!.say('new'));
    expect(heard).toEqual(['new']);
  });

  it('reports a blocked microphone in plain words', () => {
    const { result } = renderHook(() => useSpeech(() => {}));
    act(() => result.current.start());
    act(() => FakeRecognition.last!.onerror!({ error: 'not-allowed' }));
    expect(result.current.error).toBe('denied');
    expect(speechErrorText('denied')).toMatch(/blocked.*type instead/i);
  });

  it('is unsupported without the API', () => {
    vi.unstubAllGlobals();
    const { result } = renderHook(() => useSpeech(() => {}));
    expect(result.current.supported).toBe(false);
  });
});
