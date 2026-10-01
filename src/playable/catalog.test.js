import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { catalog, MAX_WORD_LENGTH, resolveWord } from './catalog.js';

test('catalog has 24 local 96px assets with stable metadata', () => {
  assert.equal(catalog.length, 24);
  const manifest = JSON.parse(readFileSync('public/models/drawing-recognizer-24-candidate/manifest.json', 'utf8'));
  assert.deepEqual(catalog.map(({ recognitionLabel }) => recognitionLabel), manifest.supportedLabels);
  for (const entry of catalog) {
    assert.match(entry.asset, new RegExp(`^/objects/${entry.id}\\.svg$`));
    assert.equal(existsSync(`public${entry.asset}`), true, `${entry.id} has local artwork`);
    assert.equal(entry.width, 96);
    assert.equal(entry.height, 96);
    assert.ok(entry.animation);
    assert.ok(Array.isArray(entry.aliases));
  }
});

test('all 24 labels map uniquely to model outputs and house plant has a display alias', () => {
  assert.equal(new Set(catalog.map(({ recognitionLabel }) => recognitionLabel)).size, 24);
  assert.equal(catalog.find(({ id }) => id === 'house-plant').recognitionLabel, 'house plant');
  assert.equal(resolveWord('house plant').entry.id, 'house-plant');
  assert.equal(catalog.find(({ id }) => id === 'airplane').recognitionLabel, 'airplane');
});

test('exact names resolve case-insensitively', () => {
  assert.equal(resolveWord('Cat').entry.id, 'cat');
  assert.equal(resolveWord('  MOON ').entry.id, 'moon');
});

test('aliases resolve to their canonical entry', () => {
  assert.equal(resolveWord('kitty').entry.id, 'cat');
  assert.equal(resolveWord('bunny').entry.id, 'rabbit');
});

test('a single clear typo, including adjacent transposition, resolves', () => {
  assert.equal(resolveWord('catt').entry.id, 'cat');
  assert.equal(resolveWord('cta').entry.id, 'cat');
});

test('ambiguous one-edit matches offer choices without selecting one', () => {
  const dog = catalog.find(({ id }) => id === 'dog');
  dog.aliases.push('cot');
  try {
    const result = resolveWord('cpt');
    assert.equal(result.status, 'ambiguous');
    assert.deepEqual(result.suggestions.map(({ id }) => id), ['cat', 'dog']);
    assert.equal('entry' in result, false);
  } finally {
    dog.aliases.pop();
  }
});

test('unrelated, empty, non-string, and overlong words stay unresolved', () => {
  assert.deepEqual(resolveWord('spaceship'), { status: 'unknown', suggestions: [] });
  assert.deepEqual(resolveWord(''), { status: 'unknown', suggestions: [] });
  assert.deepEqual(resolveWord('a'.repeat(MAX_WORD_LENGTH + 1)), {
    status: 'unknown', suggestions: [],
  });
  assert.deepEqual(resolveWord(null), { status: 'unknown', suggestions: [] });
});
