import { useEffect, useRef, useState } from 'react';
import { Play, Stop } from '@phosphor-icons/react';
import { SCENES } from '../stage2/scenes';
import { clipSrc, VOICE_CLIPS, type VoiceClip } from '../stage2/voiceLines';

const PART_ORDER = { greeting: 0, line: 1, followUp: 2, outro: 3 } as const;

/**
 * Every character's recorded lines with a play button, the exact transcript, the source and the
 * licence, so anyone can listen to each voice and check the credits. Lines without a recording are
 * listed as text only.
 */
export default function VoiceCredits() {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const stop = () => { audio.current?.pause(); audio.current = null; setPlaying(null); };
  useEffect(() => () => { audio.current?.pause(); }, []);

  const play = (clip: VoiceClip) => {
    if (playing === clip.file) { stop(); return; }
    stop();
    const a = new Audio(clipSrc(clip));
    audio.current = a;
    a.onended = () => setPlaying((p) => (p === clip.file ? null : p));
    a.onerror = () => setPlaying(null);
    setPlaying(clip.file);
    a.play().catch(() => setPlaying(null));
  };

  return (
    <details className="mb-stats mb-credits">
      <summary>Voices and credits</summary>
      <p>Every recorded line below is a real person’s recording, released under CC0 (public domain dedication) or CC BY 4.0 (credited below). Nothing is synthesised. The characters are fictional; the speakers are not them.</p>
      <ul>
        {SCENES.map((s) => {
          const clips = VOICE_CLIPS.filter((c) => c.sceneId === s.id).sort((a, b) => PART_ORDER[a.part] - PART_ORDER[b.part]);
          const textOnly = (['greeting', 'line', 'followUp', 'outro'] as const).filter((p) => s[p] && !clips.some((c) => c.part === p));
          return (
            <li key={s.id}>
              <strong>{s.character.name}</strong> <span>({s.title})</span>
              <ul>
                {clips.map((c) => (
                  <li key={c.file}>
                    <button type="button" className="mb-credits__play" aria-label={`${playing === c.file ? 'Stop' : 'Play'} ${s.character.name}: ${c.transcript}`} onClick={() => play(c)}>
                      {playing === c.file ? <Stop aria-hidden="true" weight="fill" /> : <Play aria-hidden="true" weight="fill" />}
                    </button>
                    <span>“{c.transcript}”</span>
                    <small>{c.speaker} · <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer">{c.source}</a> · {c.license}{c.attribution && <> · {c.attribution}</>}</small>
                  </li>
                ))}
                {textOnly.map((p) => <li key={p}><span className="mb-credits__none" aria-hidden="true">—</span><span>“{s[p]}”</span><small>No recording yet: shown as text only.</small></li>)}
              </ul>
            </li>
          );
        })}
      </ul>
      <p>Common Voice clips: Mozilla Common Voice Corpus 17.0, CC0. Volunteers chose to release these recordings to the public domain; their age and gender are self-reported to the dataset. LibriTTS-R clips: Y. Koizumi et al. (2023), CC BY 4.0, cut from public-domain LibriVox audiobook readings; each reader is credited above. All clips were trimmed and loudness-matched; nothing was spliced or pitch-shifted.</p>
    </details>
  );
}
