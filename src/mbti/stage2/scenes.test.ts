import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCENES } from './scenes';
import { clipFor, VOICE_CLIPS, type LinePart } from './voiceLines';

const PUBLIC = join(__dirname, '../../../public');
const PARTS: LinePart[] = ['greeting', 'line', 'followUp', 'outro'];

describe('scenes', () => {
  it('has 5–7 scenes with distinct ids, settings and characters', () => {
    expect(SCENES.length).toBeGreaterThanOrEqual(5);
    expect(SCENES.length).toBeLessThanOrEqual(7);
    expect(new Set(SCENES.map((s) => s.id)).size).toBe(SCENES.length);
    expect(new Set(SCENES.map((s) => s.setting)).size).toBe(SCENES.length);
    expect(new Set(SCENES.map((s) => s.character.name)).size).toBe(SCENES.length);
  });

  it('every scene’s rubric covers both poles of each dimension it explores', () => {
    const pairs = { EI: ['E', 'I'], SN: ['S', 'N'], TF: ['T', 'F'], JP: ['J', 'P'] } as const;
    for (const s of SCENES) for (const d of s.dimensions) for (const p of pairs[d]) expect(s.rubric.some((c) => c.pole === p), `${s.id} ${p}`).toBe(true);
  });

  it('never scores agreement, belief or identity in the different-view scene', () => {
    const s = SCENES.find((x) => x.id === 'destiny')!;
    for (const c of s.rubric) expect(c.pattern.source).not.toMatch(/agree|faith|god|relig|believe|church|politic|destiny|fate/i);
  });
});

describe('voice catalog', () => {
  it('every scene’s main question is a human recording', () => {
    for (const s of SCENES) expect(clipFor(s.id, 'line'), s.id).toBeDefined();
  });

  it('subtitles are exactly the recordings’ transcripts', () => {
    for (const c of VOICE_CLIPS) {
      const s = SCENES.find((x) => x.id === c.sceneId);
      expect(s, c.file).toBeDefined();
      expect(s![c.part], `${c.sceneId}:${c.part}`).toBe(c.transcript);
    }
  });

  it('each character keeps one voice across all their lines', () => {
    for (const s of SCENES) {
      const speakers = new Set(VOICE_CLIPS.filter((c) => c.sceneId === s.id).map((c) => c.speaker));
      expect(speakers.size, s.id).toBeLessThanOrEqual(1);
    }
  });

  it('no two characters share a speaker', () => {
    const owner = new Map<string, string>();
    for (const c of VOICE_CLIPS) {
      expect(owner.get(c.speaker) ?? c.characterId, c.speaker).toBe(c.characterId);
      owner.set(c.speaker, c.characterId);
    }
  });

  it('every clip names its source and an allowed licence, and the file exists, is small and non-empty', () => {
    for (const c of VOICE_CLIPS) {
      expect(c.speaker && c.source && c.sourceUrl, c.file).toBeTruthy();
      expect(['CC0', 'Public domain', 'CC BY 4.0', 'CC BY 3.0']).toContain(c.license);
      if (c.license.startsWith('CC BY')) expect(c.attribution, c.file).toBeTruthy();
      expect(c.file).toMatch(/^\/voices\/[a-z-]+-(greeting|line|followUp|outro)\.m4a$/);
      const path = join(PUBLIC, c.file);
      expect(existsSync(path), path).toBe(true);
      const size = statSync(path).size;
      expect(size).toBeGreaterThan(4000);
      expect(size).toBeLessThan(80_000);
      // An MP4/M4A container ("ftyp" box) so every browser can decode it.
      expect(readFileSync(path).subarray(4, 8).toString('latin1')).toBe('ftyp');
      expect(c.durationMs).toBeGreaterThan(300);
      expect(c.durationMs).toBeLessThan(6000);
    }
  });

  it('lists only lines that exist and one clip per scene part', () => {
    const keys = VOICE_CLIPS.map((c) => `${c.sceneId}:${c.part}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of SCENES) for (const p of PARTS) if (!s[p]) expect(clipFor(s.id, p), `${s.id}:${p}`).toBeUndefined();
  });

  it('there are no unused voice files', async () => {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(join(PUBLIC, 'voices')).map((f) => `/voices/${f}`).sort();
    expect(files).toEqual(VOICE_CLIPS.map((c) => c.file).sort());
  });
});
