import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, MAX_WORD_LENGTH, resolveWord } from './catalog.js';

test('catalog has twelve local 96px assets with stable metadata', () => {
  assert.equal(catalog.length, 12);
  for (const entry of catalog) {
    assert.match(entry.asset, new RegExp(`^/objects/${entry.id}\\.svg$`));
    assert.equal(entry.width, 96);
    assert.equal(entry.height, 96);
    assert.ok(entry.animation);
    assert.ok(Array.isArray(entry.aliases));
  }
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
