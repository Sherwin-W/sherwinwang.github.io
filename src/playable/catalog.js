const makeEntry = (id, label, aliases = [], animation = id) => ({
  id,
  label,
  aliases,
  asset: `/objects/${id}.svg`,
  width: 96,
  height: 96,
  animation,
});

export const catalog = [
  makeEntry('cat', 'Cat', ['kitten', 'kitty']),
  makeEntry('dog', 'Dog', ['puppy', 'pup']),
  makeEntry('rabbit', 'Rabbit', ['bunny', 'hare']),
  makeEntry('bird', 'Bird', ['chick', 'parrot']),
  makeEntry('fish', 'Fish', ['goldfish']),
  makeEntry('butterfly', 'Butterfly', ['moth']),
  makeEntry('tree', 'Tree', ['oak', 'pine']),
  makeEntry('flower', 'Flower', ['blossom', 'rose']),
  makeEntry('mushroom', 'Mushroom', ['toadstool']),
  makeEntry('cactus', 'Cactus', ['succulent']),
  makeEntry('sun', 'Sun', ['sunshine']),
  makeEntry('moon', 'Moon', ['luna']),
];

export const MAX_WORD_LENGTH = 48;

const normalize = (text) => text.trim().toLocaleLowerCase();

// A bounded Damerau-Levenshtein check for exactly one insertion, deletion,
// substitution, or adjacent transposition. Inputs are capped by the public API.
function isOneEditApart(left, right) {
  if (left === right || Math.abs(left.length - right.length) > 1) return false;

  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (
      leftIndex + 1 < left.length &&
      rightIndex + 1 < right.length &&
      left[leftIndex] === right[rightIndex + 1] &&
      left[leftIndex + 1] === right[rightIndex]
    ) {
      leftIndex += 2;
      rightIndex += 2;
      // A transposition is the only edit, so any trailing mismatch fails.
      return leftIndex === left.length && rightIndex === right.length;
    }

    if (left.length === right.length) {
      leftIndex += 1;
      rightIndex += 1;
    } else if (left.length > right.length) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }

  if (leftIndex < left.length || rightIndex < right.length) edits += 1;
  return edits === 1;
}

const getSearchableNames = () => catalog.map((entry) => ({
  entry,
  names: [entry.label, ...entry.aliases].map(normalize),
}));

/** Resolve a typed word without guessing when the catalog does not support it. */
export function resolveWord(text) {
  if (typeof text !== 'string') return { status: 'unknown', suggestions: [] };
  const word = normalize(text);
  if (!word || word.length > MAX_WORD_LENGTH) {
    return { status: 'unknown', suggestions: [] };
  }

  const searchableNames = getSearchableNames();
  const exactMatches = searchableNames
    .filter(({ names }) => names.includes(word))
    .map(({ entry }) => entry);
  if (exactMatches.length === 1) {
    return { status: 'match', entry: exactMatches[0], suggestions: [] };
  }
  if (exactMatches.length > 1) {
    return { status: 'ambiguous', suggestions: exactMatches };
  }

  const typoMatches = searchableNames
    .filter(({ names }) => names.some((name) => isOneEditApart(word, name)))
    .map(({ entry }) => entry);
  if (typoMatches.length === 1) {
    return { status: 'match', entry: typoMatches[0], suggestions: [] };
  }
  if (typoMatches.length > 1) {
    return { status: 'ambiguous', suggestions: typoMatches };
  }

  return { status: 'unknown', suggestions: [] };
}
