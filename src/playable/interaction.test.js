import test from 'node:test';
import assert from 'node:assert/strict';
import { addObject, clampPoint, deleteObject, initialInteraction, MAX_OBJECTS, moveObject, transitionInteraction, trashContainsPoint } from './interaction.js';

const entry = { id: 'cat', label: 'Cat' };
const bounds = { width: 400, height: 300 };

test('mode transitions preserve explicit typing, drawing, dragging, and modal states', () => {
  let state = initialInteraction();
  state = transitionInteraction(state, { type: 'TYPE' });
  assert.equal(state.mode, 'typing');
  state = transitionInteraction(state, { type: 'DRAW' });
  assert.equal(state.mode, 'drawing');
  state = transitionInteraction(state, { type: 'DRAG_START', id: 'one' });
  assert.equal(state.mode, 'dragging');
  assert.equal(state.selectedId, 'one');
  state = transitionInteraction(state, { type: 'MODAL_OPEN' });
  assert.equal(state.mode, 'modal-open');
});

test('clamps points and keeps spawned objects within canvas bounds', () => {
  assert.deepEqual(clampPoint({ x: 0, y: 400 }, bounds), { x: 48, y: 252 });
  const result = addObject([], entry, { x: 4, y: 5 }, bounds, 'one');
  assert.equal(result.added, true);
  assert.deepEqual({ x: result.objects[0].x, y: result.objects[0].y }, { x: 48, y: 48 });
});

test('moves and deletes only the requested object', () => {
  const objects = [{ id: 'one', x: 50, y: 50 }, { id: 'two', x: 80, y: 80 }];
  assert.deepEqual(moveObject(objects, 'one', { x: 100, y: 110 }, bounds)[0], { id: 'one', x: 100, y: 110 });
  assert.deepEqual(deleteObject(objects, 'one'), [objects[1]]);
});

test('enforces the simultaneous object cap', () => {
  const objects = Array.from({ length: MAX_OBJECTS }, (_, i) => ({ id: String(i) }));
  const result = addObject(objects, entry, { x: 50, y: 50 }, bounds);
  assert.equal(result.added, false);
  assert.equal(result.objects.length, MAX_OBJECTS);
});

test('trash hit testing includes its edges and ignores missing target', () => {
  assert.equal(trashContainsPoint({ x: 10, y: 20 }, { left: 10, right: 20, top: 20, bottom: 30 }), true);
  assert.equal(trashContainsPoint({ x: 9, y: 20 }, { left: 10, right: 20, top: 20, bottom: 30 }), false);
  assert.equal(trashContainsPoint({ x: 10, y: 20 }, null), false);
});
