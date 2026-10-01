# Playable portfolio: product and design brief

Owner: Sherwin Wang
Existing domain: sherwinwang.dev
Existing repository: inspect locally; do not assume remote or deployment settings.

## Revised interaction direction

This direction supersedes the original typing-first creation flow. Start in
Select mode; create objects by drawing in Brush mode or choosing from the
accessible catalog picker. Canvas clicks in Select mode do not create items.
Brush pointer-up starts a 1,500 ms automatic-recognition pause. See
`CONTRACTS.md` for cancellation, validation-gated auto-spawn, undo, and catalog
expansion rules.

## Outcome

Build a sleek, expressive indie-game landing page that demonstrates creativity
and still makes Sherwin's projects easy to understand.

Inspiration: Scribblenauts' word-to-object delight, Little Alchemy's approachable
discovery, and tactile 2010s websites. Use original artwork and visual identity.

## Art direction

A quiet physical sketchbook: warm off-white paper, subtle fibers, graphite text,
restrained colored accents, paper cutouts, small tactile shadows.
Preserve generous empty space. Objects are the expressive part of the page.

Use cohesive chibi silhouettes with consistent outlines, palette, and scale.
Avoid generic dashboard cards, neon gradients, excessive glass effects, and
emoji as finished object artwork. Placeholder art must be identified as such.
Use a readable text face; reserve handwriting for short accents.
Keep textures lightweight and subtle enough not to interfere with reading.

The cat is the reference asset: appealing silhouette, expressive face, little
spawn squash/stretch, occasional blink or tail movement. Reduced-motion mode
uses a static pose or minimal transition.

## Primary interaction

Start in Select mode; clicking empty canvas does nothing. Objects remain
draggable/deletable and the Projects/About/Contact/Resume links stay accessible.

Brush mode is the primary creation path. Pointer strokes appear immediately and
never trigger recognition while the pointer is held. Each pointer-up starts a
1,500 ms quiet timer; another stroke resets it. A validation-selected
score-plus-margin gate can automatically replace a reliable supported sketch
with its object at the drawing center. Keep the source ink until insertion
succeeds, show a short local ink-to-object transition, and offer Undo
transformation. Uncertain or unsupported input keeps its ink and offers three
ranked suggestions plus the accessible object picker. Softmax scores are not
calibrated probabilities. Clear, Undo stroke, mode changes, portfolio sheets,
and unmounting cancel pending creation/results.

The object picker is available independently of Brush, so drawing is optional.
Touch and pen use the same pointer-event path; the custom brush cursor is only
a desktop visual aid over the drawing surface.

An object can be dragged, selected, or deleted using an accessible alternative.
Dragging over the trash highlights it; release deletes the object.
Keep objects inside usable bounds after viewport resize.
Give new visitors one concise instruction, not a tutorial wall.

## Catalog naming compatibility

The former typed-word resolution helpers remain covered by tests for catalog naming compatibility; they are not exposed as a visible input or click-to-type interaction. Use a static catalog, not a network database.
Resolution order: normalize -> exact name -> alias -> conservative typo match.
Examples: Cat/cat, kitty/kitten -> cat, and a clear typo -> cat.
Do not force an unrelated word to the nearest object.

The original 12-object set remains the completed interaction verification milestone.
The integrated catalog now contains the evaluated 24-label batch. Review its
per-class quality before selecting the remaining roadmap candidates toward 60;
see `CATALOG_ROADMAP.md`. Do not describe a
label as recognition-supported until it appears in training, exported labels,
the catalog, original artwork, and browser inference.

Each entry has a stable ID, display label, model recognition label, aliases, asset, dimensions, and animation key.
Spawn uses prebuilt local art. No image-generation API in the visitor interaction.

## Portfolio

Keep Projects, About, Contact and any existing resume link easy to find.
Visitors must not need to discover a game command to access portfolio content.

Project controls open an illustrated sheet with title, short description,
real architecture diagram, technologies, verified links and close control.
Opening a sheet pauses background canvas input.
Use dialog semantics, keyboard focus containment, Escape to close, and return
focus to the opener. Long sheets scroll on small screens.

Reuse verified information from the repository.
Potential projects, only when supported by repository content:
Apple Silicon LLM inference, Food Pharmer Vision, personal job tracker.
Do not invent results, personal contributions, employment, or URLs.
Mark missing content in developer notes; avoid publishing invented copy.

## Technical direction

Preserve the existing framework and package manager.
Prefer the current React setup, DOM/SVG objects, CSS animation, and a drawing
canvas layer. Use Pointer Events and pointer capture for interaction.
Do not add a game engine, physics system, backend, or state framework by default.

Keep dragging responsive without rerendering the entire page on every event.
Separate object placement from sprite animation so transforms do not conflict.
Use explicit Select, Brush, drawing, dragging, picker, recognition, and modal
states; the UI contains no click-to-type creation path.

Keep basic canvas and picker use independent of model initialization. Lazy-load
the local recognizer in a worker; handle errors, unavailable weights and stale
responses. Choose auto-spawn gates with validation data, report precision and
coverage separately, and do not tune against the test split.

## Performance targets, not claimed results

Measure and report browser/device and local/network conditions.
- Pointer strokes remain responsive during slow uninterrupted gestures.
- Auto-recognition begins only after the 1,500 ms post-pointer-up pause.
- Report pointer-up-to-visible-object and worker-only time separately.
- Pointer movement: visually smooth around 60 fps on a normal laptop.
- Support 30 simultaneous objects without pronounced input lag.
- Drawing strokes remain immediate while recognition runs.
- Aim for initial compressed app payload under 1 MB excluding lazy ML assets.
Preload starter art or provide an immediate spawn silhouette while it loads.

## Accessibility and resilience

Visible focus, labeled controls, sufficient contrast, reduced motion.
Keyboard spawn/delete; visible touch input control; usable narrow layouts.
Prevent drawing gestures from accidentally scrolling only inside the draw area.
Preserve ordinary page scrolling elsewhere.
No audio by default. No drawing upload or telemetry by default.
No essential portfolio information hidden behind the game.

## Scope boundary

First session excludes object-combination recipes, physics, accounts,
multiplayer, arbitrary image generation, and an unlimited object catalog.
Combination mechanics may be added later; they were not requested for v1.
Do not redesign unrelated pages or replace the hosting setup without a need.
