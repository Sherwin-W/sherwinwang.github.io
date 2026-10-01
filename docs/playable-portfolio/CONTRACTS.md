# Integration contracts

The active model milestone contains 24 supported labels. Interaction milestone
1 is preserved in local checkpoint `924aba8`; it starts in Select mode and
creates only through Brush or the accessible object picker. Only the lead edits
shared contracts and integrates model/artwork/catalog batches.

`catalog.js` entries provide a stable `id`, display `label`, optional distinct
`recognitionLabel`, aliases, local SVG asset, dimensions, and animation key. The
`house plant` model label maps to the `house-plant.svg` asset displayed as
Potted plant. Select clicks do not create objects. Legacy text resolution stays
covered by unit tests but is not a visible creation interaction.

The canvas waits 1,500 ms after pointer-up before automatic recognition. New
strokes, Clear, Undo stroke, mode changes, opening a portfolio sheet, and
unmounting cancel the timer and invalidate pending results. Recognition stays
lazy and local in a Worker. The Worker loads
`public/models/drawing-recognizer-24-candidate/manifest.json` and its 311,140
byte weights only when recognition is requested. The active manifest has 24
supported outputs plus `other`; the prior 12-label model remains in its own
folder for comparison and rollback.

Validation selected automatic creation when the 25-output winner is supported,
score >= 0.94, and margin over the runner-up >= 0.70. The separate unknown
threshold is 0.21. The selected rule achieved 95.39% validation precision and
16.68% supported coverage; on the untouched test split it achieved 95.26%
precision and 16.56% coverage. These are sampled-set results; model scores are
uncalibrated. Per-class low-quality categories are explicitly recorded in
`RECOGNITION.md` and `recognition-metrics-24-candidate.json`.

Automatic acceptance inserts at the drawing center. Ink stays until insertion
succeeds and then fades through a short local glow. Undo transformation removes
the object and restores original strokes without immediately retrying. When
uncertain or unsupported, the ink stays visible with three supported
suggestions and the picker. The model receives clean stroke arrays, never the
rendered glow or a screenshot.

Catalog expansion proceeds in evaluated batches. The first 24 are wired across
training, exported labels, catalog, original SVG artwork, and browser inference.
Do not continue toward 60 until the 24-class evidence is reviewed.
