# Integration contracts

The current supported-model milestone contains 12 objects. Only the lead edits
shared contracts and integrates worker/art/model changes. The preserved working
checkpoint is `5bcf157`; do not amend or rewrite it.

`catalog.js` exports `catalog` entries (`id`, `label`, `aliases`, `asset`,
`width`, `height`, `animation`) and `resolveWord` for legacy matching tests.
The visible creation path is now Brush or the accessible object picker; typed
spawn and its Type control are removed. Select is the initial mode and keeps
objects draggable and portfolio links available. Assets are original SVGs at
`/objects/{id}.svg`.

The canvas owns one stroke revision at a time. Pointer-up starts a 1,500 ms
quiet timer; a new pointer-down cancels it and invalidates any old result.
Recognition never runs while the pointer is down. Clear, Undo stroke, mode
changes, the `portfolio:sheet-open` event, and unmount cancel scheduled or
pending recognition. Recognition stays lazy and local in the Web Worker.

The worker returns ranked labels, `other`/blank/error state, measured inference
time, and `autoSpawnAccepted`. The current auto-spawn rule requires the top of
all 13 labels to be supported, score >= 0.91, and margin over the runner-up >=
0.50. This rule was selected on validation rows for >=95% empirical precision;
scores remain uncalibrated. Only a successful object insertion consumes the
sketch. Uncertain results retain ink and show three suggestions plus the object
picker. A successful transformation is reversible once; Undo removes its
spawned object, restores the source strokes, and suppresses recognition until
the drawing changes or the visitor explicitly retries.

Recognition preprocessing consumes the clean pointer stroke arrays, never a
screenshot or the decorative glow. SVG core and glow share the same points.
Decorative transitions use CSS, with reduced-motion behavior. Pointer events
support mouse, pen, and touch.

Catalog expansion proceeds in batches: finish/evaluate 24 wired objects before
continuing toward 60. A label is recognized as supported only when training,
exported manifest, catalog, original artwork, and browser inference all contain
it. Training and inference remain lazy/independent of basic Select/Brush UI.
