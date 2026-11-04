import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { estimatedDuration, useVoice, type Line } from './voice';
import { clipFor } from './voiceLines';

/** A stand-in for HTMLAudioElement whose behaviour each test chooses. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  static mode: 'ok' | 'reject' | 'blocked' | 'error' = 'ok';
  src: string; preload = ''; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  pause = vi.fn();
  constructor(src: string) { this.src = src; FakeAudio.instances.push(this); }
  play() {
    if (FakeAudio.mode === 'reject') return Promise.reject(Object.assign(new Error('decode'), { name: 'NotSupportedError' }));
    if (FakeAudio.mode === 'blocked') return Promise.reject(Object.assign(new Error('gesture'), { name: 'NotAllowedError' }));
    if (FakeAudio.mode === 'error') setTimeout(() => this.onerror?.(), 0);
    return Promise.resolve();
  }
  end() { this.onended?.(); }
}

// Two recorded lines from one voice, played back to back.
const greeting = { id: 'weekend:line', text: 'Can we plan on doing it on Tuesday?', clip: clipFor('weekend', 'line') } satisfies Line;
const line = { id: 'weekend:followUp', text: 'How do you mean?', clip: clipFor('weekend', 'followUp') } satisfies Line;
const textOnly: Line = { id: 'destiny:followUp', text: 'Why do you see it that way?' };

beforeEach(() => { vi.useFakeTimers(); FakeAudio.instances = []; FakeAudio.mode = 'ok'; vi.stubGlobal('Audio', FakeAudio); vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('useVoice', () => {
  it('plays the human recordings in order and never uses speech synthesis', async () => {
    const { result } = renderHook(() => useVoice({ muted: false }));
    await act(async () => { result.current.play([greeting, line]); });
    expect(FakeAudio.instances.map((a) => a.src)).toEqual(['/voices/weekend-line.m4a']);
    expect(result.current.current).toBe('weekend:line');
    expect(result.current.speaking).toBe(true);
    await act(async () => { FakeAudio.instances[0].end(); });
    expect(FakeAudio.instances[1].src).toBe('/voices/weekend-followUp.m4a');
    expect(result.current.current).toBe('weekend:followUp');
    await act(async () => { FakeAudio.instances[1].end(); });
    expect(result.current.speaking).toBe(false);
    expect(result.current.status).toBe('done');
    expect((globalThis as unknown as { speechSynthesis: { speak: ReturnType<typeof vi.fn> } }).speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('shows a line with no recording as text only, then carries on', async () => {
    const { result } = renderHook(() => useVoice({ muted: false }));
    await act(async () => { result.current.play([textOnly]); });
    expect(FakeAudio.instances).toHaveLength(0);
    expect(result.current.speaking).toBe(true);
    act(() => { vi.advanceTimersByTime(estimatedDuration(textOnly.text) + 10); });
    expect(result.current.speaking).toBe(false);
    expect(result.current.status).toBe('missing');
  });

  it('falls back to text when a recording fails to play or load', async () => {
    FakeAudio.mode = 'reject';
    const { result } = renderHook(() => useVoice({ muted: false }));
    await act(async () => { result.current.play([line]); });
    expect(result.current.status).toBe('failed');
    act(() => { vi.advanceTimersByTime(estimatedDuration(line.text) + 10); });
    expect(result.current.status).toBe('failed');
    expect(result.current.speaking).toBe(false);

    FakeAudio.mode = 'error';
    await act(async () => { result.current.play([line]); });
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(result.current.status).toBe('failed');
  });

  it('reports blocked autoplay so the call can offer a play button', async () => {
    FakeAudio.mode = 'blocked';
    const { result } = renderHook(() => useVoice({ muted: false }));
    await act(async () => { result.current.play([greeting, line]); });
    expect(result.current.status).toBe('blocked');
    expect(result.current.speaking).toBe(false);
    expect(FakeAudio.instances).toHaveLength(1);
    // A tap (replay) tries again.
    FakeAudio.mode = 'ok';
    await act(async () => { result.current.play([greeting, line]); });
    expect(result.current.status).toBe('playing');
  });

  it('stays silent when muted but still animates for about the length of the line', async () => {
    const { result } = renderHook(() => useVoice({ muted: true }));
    await act(async () => { result.current.play([line]); });
    expect(FakeAudio.instances).toHaveLength(0);
    expect(result.current.status).toBe('muted');
    expect(result.current.speaking).toBe(true);
    act(() => { vi.advanceTimersByTime(estimatedDuration(line.text) + 10); });
    expect(result.current.speaking).toBe(false);
  });

  it('stop pauses the audio and drops anything from the old sequence', async () => {
    const { result } = renderHook(() => useVoice({ muted: false }));
    await act(async () => { result.current.play([greeting, line]); });
    const first = FakeAudio.instances[0];
    act(() => result.current.stop());
    expect(first.pause).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
    await act(async () => { first.end(); });
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('replay restarts the same lines from the beginning', async () => {
    const { result } = renderHook(() => useVoice({ muted: false }));
    await act(async () => { result.current.play([greeting, line]); });
    await act(async () => { result.current.play([greeting, line]); });
    expect(FakeAudio.instances.map((a) => a.src)).toEqual(['/voices/weekend-line.m4a', '/voices/weekend-line.m4a']);
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
  });

  it('stops when the page is hidden', async () => {
    const { result } = renderHook(() => useVoice({ muted: false }));
    await act(async () => { result.current.play([line]); });
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
    expect(result.current.speaking).toBe(false);
  });
});
