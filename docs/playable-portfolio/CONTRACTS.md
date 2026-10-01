# Integration contracts

The interaction milestone remains Select-first: creation is available through
Brush or the accessible object picker; the visible UI has no typing mode.
Only the lead edits shared contracts and integrates model/art/catalog batches.

Each `catalog.js` entry has a stable ID, visible label, recognition label,
aliases, local SVG and animation key. The `house plant` model output maps to
the Potted plant catalog item. Select clicks never create objects. Legacy
word resolution helpers remain tested for compatibility, not exposed as a
visitor interaction.

The canvas waits 1,500 ms after pointer-up before local recognition in a lazy
Web Worker. New strokes, Clear, Undo stroke, mode changes, opening a portfolio
sheet, and unmount invalidate scheduled or pending results. Creation is guarded
against duplicates. Accepted transformations keep source ink until object
insertion succeeds, then allow Undo transformation without immediately
retrying. Uncertain/unsupported results preserve ink and show three ranked
suggestions plus the picker. The recognizer receives clean stroke data, never
the glow or a screenshot.

The active model is `public/models/drawing-recognizer-cnn/` (212,452 bytes,
8/16-channel CNN with dense64 and 25 outputs). The prior 24-label MLP is
preserved in `public/models/drawing-recognizer-24-candidate/` for rollback and
comparison; the earlier 12-label checkpoint also remains available.

The validation-selected acceptance rule requires the winning supported score
to be >=0.75, its margin over the runner-up >=0.66, and its label to be in the
allowlist: Cat, Rabbit, Fish, Butterfly, Tree, Flower, Mushroom, Cactus, Sun,
Duck, Leaf, Potted plant, Apple, Banana, Pizza, Chair, Airplane, or Bicycle.
The allowlist requires at least 20 validation acceptances and at least 90%
per-label precision. Dog, Bird, Moon, Cow, Elephant, and Frog remain suggestion
and picker-only. Scores are uncalibrated softmax outputs, not confidence
probabilities. The threshold and per-label rule were chosen on validation,
not the held-out test set. CNN held-out auto-creation precision/coverage were
95.35% / 40.88%; the separate 12-example browser fixture set auto-created five
objects, four correctly and one incorrectly.

The 24 active catalog labels are wired through training, exported weights,
catalog, original illustrations and browser inference. The remaining 36
illustrations are roadmap-only under `public/objects/roadmap/`; they are not
registered or recognition-supported. Do not expand active recognition until
the 24-class quality and auto-creation reliability are preserved.
