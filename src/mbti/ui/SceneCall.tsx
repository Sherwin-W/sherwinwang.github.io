import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, PhoneDisconnect, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import type { Action, State } from '../session';
import { SCENES, sceneById, type Scene } from '../stage2/scenes';
import { clipFor, type LinePart, type VoiceClip } from '../stage2/voiceLines';
import { blip, type Line, type useVoice } from '../stage2/voice';
import ResponseInput from './ResponseInput';
import SceneView from './SceneView';
import Window from './Window';

/** Plays an alternative version of the scene with its own clips, e.g. to audition a voice in context. */
export interface CallPreview { scene: Scene; clipFor: (part: LinePart) => VoiceClip | undefined }

interface Props {
  state: State;
  dispatch: (a: Action) => void;
  voice: ReturnType<typeof useVoice>;
  muted: boolean;
  onToggleMute: () => void;
  reduceMotion: boolean;
  preview?: CallPreview;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** The lines a character says at each step of the call, in order. */
export function linesFor(scene: Scene, step: 'line' | 'followUp' | 'outro', lookup: (part: LinePart) => VoiceClip | undefined = (part) => clipFor(scene.id, part)): Line[] {
  const parts: LinePart[] = step === 'line' ? (scene.greeting ? ['greeting', 'line'] : ['line']) : [step];
  return parts.filter((part) => scene[part]).map((part) => ({ id: `${scene.id}:${part}`, text: scene[part]!, clip: lookup(part) }));
}

/**
 * One scene as a retro video call. Every line is predefined and, where a licensed human recording
 * exists, played from it; the subtitle is always that recording's transcript. The person answers by
 * voice or text. Nothing is generated.
 */
export default function SceneCall({ state, dispatch, voice, muted, onToggleMute, reduceMotion, preview }: Props) {
  const scene = preview?.scene ?? sceneById(state.active!)!;
  const st = state.scenes[scene.id];
  const [phase, setPhase] = useState<'ringing' | 'live'>('ringing');
  const [seconds, setSeconds] = useState(0);
  const step: 'line' | 'followUp' | 'outro' = st.done ? (st.skipped ? 'line' : 'outro') : st.followedUp ? 'followUp' : 'line';
  const lines = useMemo(() => linesFor(scene, step, preview?.clipFor), [scene, step, preview]);
  const playRef = useRef(() => voice.play(lines));
  playRef.current = () => voice.play(lines);

  // Ring, then connect. Leaving the call stops its voice.
  useEffect(() => {
    blip('ring', !muted);
    const t = window.setTimeout(() => { setPhase('live'); blip('connect', !muted); }, reduceMotion ? 250 : 1100);
    return () => { window.clearTimeout(t); voice.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  // Play each new step once connected (a skipped scene says nothing more).
  useEffect(() => { if (phase === 'live' && !(st.done && st.skipped)) playRef.current(); }, [phase, step, st.done, st.skipped]);

  useEffect(() => {
    if (phase !== 'live') return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const leave = () => { voice.stop(); blip('hangup', !muted); dispatch({ type: 'closeScene' }); };
  const nextScene = preview ? undefined : SCENES.find((s) => s.id !== scene.id && !state.scenes[s.id]?.done);
  const goNext = () => { voice.stop(); dispatch({ type: 'closeScene' }); if (nextScene) dispatch({ type: 'openScene', id: nextScene.id }); };
  const recorded = lines.find((l) => l.clip)?.clip;

  return (
    <Window title={`call · ${scene.character.name.toLowerCase()}`} accent="coral" labelledBy="mb-call-h" className="mb-call">
      <div className="mb-call__top">
        <h2 id="mb-call-h" className="mb-h2">{scene.title}</h2>
        <span className="mb-call__meta">
          {phase === 'ringing' ? <span className="mb-call__ring">Calling {scene.character.name}…</span> : <span aria-label={`Call time ${mmss(seconds)}`}><span className="mb-live" aria-hidden="true" /> {mmss(seconds)}</span>}
        </span>
      </div>
      <div className="mb-call__grid">
        <div className={`mb-call__screen${phase === 'ringing' ? ' is-ringing' : ''}`}>
          <SceneView setting={scene.setting} spec={scene.character.portrait} expression={st.done ? 'happy' : scene.expression} speaking={voice.speaking} still={reduceMotion} name={scene.character.name} />
          <span className="mb-call__tag">{scene.character.name} · {scene.character.meta}</span>
          {voice.speaking && <span className="mb-call__speaking" aria-hidden="true">speaking</span>}
        </div>
        <div className="mb-call__side">
          <p className="mb-call__situation">{scene.situation}</p>
          {phase === 'live' && !(st.done && st.skipped) && lines.length > 0 && (
            <div className="mb-caption" role="status" aria-live="polite">
              {lines.map((l) => (
                <p key={l.id} className={voice.current === l.id ? 'is-now' : undefined}><strong>{scene.character.name}:</strong> {l.text}</p>
              ))}
            </div>
          )}
          <div className="mb-call__tools">
            {voice.status === 'blocked'
              ? <button type="button" className="mb-btn mb-btn--small mb-btn--primary" onClick={() => playRef.current()}><Play aria-hidden="true" weight="fill" /> Play voice</button>
              : <button type="button" className="mb-btn mb-btn--small" onClick={() => playRef.current()} disabled={phase !== 'live' || (st.done && st.skipped)}><ArrowCounterClockwise aria-hidden="true" /> Replay</button>}
            <button type="button" className="mb-btn mb-btn--small" aria-pressed={muted} onClick={onToggleMute}>{muted ? <SpeakerSlash aria-hidden="true" /> : <SpeakerHigh aria-hidden="true" />} {muted ? 'Voice off' : 'Voice on'}</button>
            <button type="button" className="mb-btn mb-btn--small mb-btn--danger" onClick={leave}><PhoneDisconnect aria-hidden="true" /> Leave</button>
          </div>
          <p className="mb-hint mb-call__voice" role="status">
            {voice.status === 'blocked' && 'Your browser needs a tap before it plays audio. Press Play voice.'}
            {voice.status === 'failed' && 'The recording did not load, so this line is shown as text.'}
            {voice.status === 'missing' && 'There is no recording for this line yet, so it is shown as text.'}
            {!['blocked', 'failed', 'missing'].includes(voice.status) && recorded && !muted && <>Voice: {recorded.speaker} ({recorded.license}).</>}
          </p>
        </div>
      </div>
      {phase === 'live' && !st.done && (
        <ResponseInput key={`${scene.id}-${step}`} voice={state.input === 'voice'} submitLabel="Send answer" onMicStart={voice.stop} characterSpeaking={voice.speaking}
          placeholder={`Answer ${scene.character.name}…`}
          onSubmit={(t) => { voice.stop(); dispatch({ type: 'sceneAnswer', text: t }); }}
          extra={<button type="button" className="mb-btn" onClick={() => { voice.stop(); dispatch({ type: 'skipScene' }); }}>Skip this scene</button>} />
      )}
      {st.done && (
        <div className="mb-actions mb-call__end">
          <p className="mb-hint">{st.skipped ? 'Skipped.' : 'Scene complete.'}</p>
          {nextScene && <button type="button" className="mb-btn mb-btn--primary" autoFocus onClick={goNext}>Next scene: {nextScene.title}</button>}
          <button type="button" className={`mb-btn${nextScene ? '' : ' mb-btn--primary'}`} autoFocus={!nextScene} onClick={() => { voice.stop(); dispatch({ type: 'closeScene' }); }}>All scenes</button>
        </div>
      )}
    </Window>
  );
}
