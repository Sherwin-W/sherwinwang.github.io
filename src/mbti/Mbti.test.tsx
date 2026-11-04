import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Mbti from './Mbti';
import { SCENES, sceneById } from './stage2/scenes';
import { VOICE_CLIPS } from './stage2/voiceLines';

const SCENE_ANSWER = "I can't wait, let's go at 8 and meet everyone. I would focus on the practical facts and a clear plan, and on how everyone feels.";
const ANSWER = 'I love big parties and I talk to everyone. I always make a plan and a list. I care about how everyone feels. I like concrete facts.';

class FakeRecognition {
  static last: FakeRecognition | null = null;
  continuous = false; interimResults = false; lang = '';
  onresult: ((e: unknown) => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  constructor() { FakeRecognition.last = this; }
}

/** Records every clip the app plays; tests end or fail them. */
class FakeAudio {
  static all: FakeAudio[] = [];
  static mode: 'ok' | 'reject' | 'blocked' = 'ok';
  src: string; preload = ''; paused = false; onended: (() => void) | null = null; onerror: (() => void) | null = null;
  pause = vi.fn(() => { this.paused = true; });
  constructor(src: string) { this.src = src; FakeAudio.all.push(this); }
  play() {
    if (FakeAudio.mode === 'reject') return Promise.reject(Object.assign(new Error('decode'), { name: 'NotSupportedError' }));
    if (FakeAudio.mode === 'blocked') return Promise.reject(Object.assign(new Error('gesture'), { name: 'NotAllowedError' }));
    return Promise.resolve();
  }
}
const played = () => FakeAudio.all.map((a) => a.src);
const endCurrent = () => act(async () => { FakeAudio.all.at(-1)!.onended?.(); });

beforeEach(() => {
  FakeAudio.all = []; FakeAudio.mode = 'ok';
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn() });
  // Reduced motion keeps the ring short.
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal('scrollTo', vi.fn());
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); FakeRecognition.last = null; });

const answerBox = () => screen.getByLabelText('Your answer');
function type(text: string, button: string) {
  fireEvent.change(answerBox(), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: button }));
}
function toScenes() {
  fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
  for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish questions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open the scenes' }));
}
async function openScene(id: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${sceneById(id)!.title}:`) }));
  await waitFor(() => expect(document.querySelector('.mb-caption')).not.toBeNull(), { timeout: 2000 });
}
async function playScene(title: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${title}:`) }));
  await waitFor(() => expect(document.querySelector('.mb-caption')).not.toBeNull(), { timeout: 2000 });
  type(SCENE_ANSWER, 'Send answer');
  if (screen.queryByLabelText('Your answer')) type(SCENE_ANSWER, 'Send answer');
  await screen.findByText('Scene complete.');
  fireEvent.click(screen.getByRole('button', { name: 'All scenes' }));
}

describe('MBTI-inspired test', () => {
  it('runs both stages by typing and shows a reading with real quotes', async () => {
    render(<Mbti />);
    expect(screen.getByRole('heading', { name: 'MBTI-Inspired Personality Test' })).toBeTruthy();
    expect(screen.getByText(/Not affiliated with or endorsed by The Myers-Briggs Company/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Type instead' }));
    expect(screen.getByText(/Stage 1 of 2/)).toBeTruthy();
    // Stage 1 is text: no narration plays.
    expect(FakeAudio.all).toHaveLength(0);
    for (let i = 0; i < 14 && !screen.queryByRole('button', { name: 'Open the scenes' }); i++) type(ANSWER, 'Next');
    fireEvent.click(screen.getByRole('button', { name: 'Open the scenes' }));
    expect(screen.getByRole('heading', { name: 'Pick a scene' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'See my reading' }) as HTMLButtonElement).disabled).toBe(true);

    for (const s of SCENES.slice(0, 4)) await playScene(s.title);
    expect(played()).toContain('/voices/party-line.m4a');
    const see = screen.getByRole('button', { name: 'See my reading' }) as HTMLButtonElement;
    expect(see.disabled).toBe(false);
    fireEvent.click(see);

    const type4 = screen.getByRole('heading', { name: /Suggested type/ });
    expect(type4.textContent).toBe('ESFJ');
    expect(document.querySelector('.mb-quotes q')?.textContent).toMatch(/I love big parties|I always make a plan|I care about|I like concrete|can't wait|practical facts/);
    expect(screen.getAllByText(/Scene: /).length).toBeGreaterThan(0);

    const ei = screen.getByRole('group', { name: /Extraversion or Introversion/ });
    fireEvent.click(within(ei).getByRole('button', { name: 'I' }));
    expect(screen.getByRole('heading', { name: /Suggested type/ }).textContent).toBe('ISFJ');
    expect(screen.getByText(/Includes your own adjustments/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start over (deletes this session)' }));
    expect(screen.getByRole('button', { name: 'Type instead' })).toBeTruthy();
  }, 20000);

  it('plays the character’s line from a recording, subtitled with its exact words', async () => {
    render(<Mbti />);
    toScenes();
    await openScene('party');
    expect(played()).toEqual(['/voices/party-line.m4a']);
    const caption = document.querySelector('.mb-caption')!;
    expect(caption.textContent).toBe('Lena: What are you doing tonight?');
    expect(caption.querySelector('.is-now')?.textContent).toContain('What are you doing tonight?');
    expect(screen.getByText(/Voice: Common Voice contributor 1b1ac398 \(CC0\)/)).toBeTruthy();
    await endCurrent();

    // Replay starts the same recording again; muting plays nothing, but the subtitles stay.
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(played().at(-1)).toBe('/voices/party-line.m4a');
    fireEvent.click(screen.getByRole('button', { name: 'Voice on' }));
    const count = FakeAudio.all.length;
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(FakeAudio.all).toHaveLength(count);
    expect(document.querySelector('.mb-caption')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByRole('heading', { name: 'Pick a scene' })).toBeTruthy();
  });

  it('plays the recorded follow-up after a thin answer, and the sign-off at the end', async () => {
    render(<Mbti />);
    toScenes();
    await openScene('weekend');
    type('Hm, sure.', 'Send answer');
    await waitFor(() => expect(played().at(-1)).toBe('/voices/weekend-followUp.m4a'));
    expect(document.querySelector('.mb-caption')!.textContent).toBe('Sam: How do you mean?');
    type("Yes, let's lock in Tuesday and book a table for everyone.", 'Send answer');
    await waitFor(() => expect(played().at(-1)).toBe('/voices/weekend-outro.m4a'));
    expect(document.querySelector('.mb-caption')!.textContent).toBe('Sam: See you later!');
  });

  it('ends quietly when a character has no recorded sign-off', async () => {
    render(<Mbti />);
    toScenes();
    await openScene('walters-leap');
    type('Yes, I have savings and I planned the whole itinerary.', 'Send answer');
    await screen.findByText('Scene complete.');
    expect(document.querySelector('.mb-caption')).toBeNull();
    expect(played()).toEqual(['/voices/walters-leap-line.m4a']);
  });

  it('switching characters stops the previous voice and plays the next one’s own recording', async () => {
    render(<Mbti />);
    toScenes();
    await openScene('party');
    const lena = FakeAudio.all.at(-1)!;
    fireEvent.click(screen.getByRole('button', { name: 'Skip this scene' }));
    expect(lena.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Next scene:/ }));
    await waitFor(() => expect(played().at(-1)).toBe(`/voices/${SCENES[1].id}-${SCENES[1].greeting ? 'greeting' : 'line'}.m4a`), { timeout: 2000 });
  });

  it('shows a line with no recording as text only, and says so', async () => {
    render(<Mbti />);
    toScenes();
    await openScene('destiny');
    type('Sure.', 'Send answer');
    await waitFor(() => expect(document.querySelector('.mb-caption')!.textContent).toContain('Why do you see it that way?'));
    expect(screen.getByText(/no recording for this line yet/)).toBeTruthy();
  });

  it('falls back to text when a recording will not load', async () => {
    FakeAudio.mode = 'reject';
    render(<Mbti />);
    toScenes();
    await openScene('interview');
    await screen.findByText(/recording did not load, so this line is shown as text/);
    expect(document.querySelector('.mb-caption')!.textContent).toContain('Have you ever had any experience?');
  });

  it('offers a play button when the browser blocks autoplay', async () => {
    FakeAudio.mode = 'blocked';
    render(<Mbti />);
    toScenes();
    await openScene('interview');
    const play = await screen.findByRole('button', { name: 'Play voice' });
    FakeAudio.mode = 'ok';
    fireEvent.click(play);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Play voice' })).toBeNull());
    expect(played().at(-1)).toBe('/voices/interview-line.m4a');
  });

  it('never records the character: replaying stops the microphone, and speaking stops the character', async () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    render(<Mbti />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer out loud' }));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open the scenes' }));
    await openScene('two-programs');
    const jordan = FakeAudio.all.at(-1)!;
    // Pressing Speak while Jordan talks stops his voice first.
    fireEvent.click(screen.getByRole('button', { name: 'Speak' }));
    expect(jordan.pause).toHaveBeenCalled();
    const rec = FakeRecognition.last!;
    expect(rec.start).toHaveBeenCalled();
    // Replaying while listening stops the microphone, so his line is never transcribed.
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(rec.stop).toHaveBeenCalled();
  });

  it('lists every recording with a play button and its licence', () => {
    render(<Mbti />);
    const credits = screen.getByText('Voices and credits').closest('details')!;
    const buttons = within(credits).getAllByRole('button', { name: /^Play / });
    expect(buttons).toHaveLength(VOICE_CLIPS.length);
    fireEvent.click(buttons[0]);
    expect(played()).toEqual([VOICE_CLIPS.find((c) => c.sceneId === SCENES[0].id && c.part === (SCENES[0].greeting ? 'greeting' : 'line'))!.file]);
    expect(within(credits).getAllByText(/CC0/).length).toBeGreaterThan(0);
    expect(within(credits).getAllByText(/No recording yet/).length).toBeGreaterThan(0);
    expect(within(credits).getAllByText(/LibriTTS-R by Y. Koizumi/).length).toBe(3);
  });

  it('keeps typing available when the microphone is blocked', () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    render(<Mbti />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer out loud' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speak' }));
    expect(screen.getByText(/Recording\. Your browser turns speech into text/)).toBeTruthy();
    act(() => FakeRecognition.last!.onerror!({ error: 'not-allowed' }));
    act(() => FakeRecognition.last!.onend?.());
    expect(screen.getByText(/Microphone access was blocked/)).toBeTruthy();
    type(ANSWER, 'Next');
    expect(screen.getByText(/Question 2/)).toBeTruthy();
  });

  it('cancels listening when moving to the next question, so late words never carry over', () => {
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    render(<Mbti />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer out loud' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speak' }));
    const rec = FakeRecognition.last!;
    const late = rec.onresult!;
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(rec.abort).toHaveBeenCalled();
    act(() => late({ resultIndex: 0, results: [Object.assign([{ transcript: 'late words' }], { isFinal: true })] }));
    expect((answerBox() as HTMLTextAreaElement).value).toBe('');
  });
});
