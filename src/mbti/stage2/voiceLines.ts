/**
 * The voice catalog: every recorded line a character says, with its exact transcript, source and
 * licence. Subtitles are always the transcript of the clip, never a paraphrase. To replace a voice,
 * change the entries for that character; the scenes and the engine do not change.
 *
 * Only human recordings with a licence that allows this use are listed (CC0, public domain, CC BY
 * with attribution). Files live in /public/voices/ and are trimmed, loudness-normalised mono AAC.
 * A line with no entry here is shown as text only; nothing is synthesised.
 */
import { CLIPS } from './voiceCatalog';

export type LinePart = 'greeting' | 'line' | 'followUp' | 'outro';
export type License = 'CC0' | 'Public domain' | 'CC BY 4.0' | 'CC BY 3.0';

export interface VoiceClip {
  sceneId: string;
  characterId: string;
  part: LinePart;
  /** Path under the site root, e.g. /voices/lena-line.m4a (prefixed with the base URL at runtime). */
  file: string;
  /** Exactly what is said in the recording; used as the subtitle. */
  transcript: string;
  /** Who recorded it, as the source credits them. */
  speaker: string;
  /** Collection the clip comes from and the original file name there. */
  source: string;
  sourceUrl: string;
  license: License;
  attribution?: string;
  durationMs: number;
  notes?: string;
}

export const VOICE_CLIPS: readonly VoiceClip[] = CLIPS;

const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');
export const clipSrc = (clip: VoiceClip) => `${base}${clip.file}`;

export function clipFor(sceneId: string, part: LinePart): VoiceClip | undefined {
  return VOICE_CLIPS.find((c) => c.sceneId === sceneId && c.part === part);
}
