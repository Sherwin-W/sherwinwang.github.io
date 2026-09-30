# Playable portfolio: product and design brief

Owner: Sherwin Wang
Existing domain: sherwinwang.dev
Existing repository: inspect locally; do not assume remote or deployment settings.

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

Default mode: clicking empty canvas opens a small word input at that position.
Enter resolves the word and spawns a supported object at the same location.
Escape cancels. Clicking controls or dragging an object must not open an input.

Draw mode: pointer strokes appear immediately. Explicit "Create" submits the
drawing so multi-stroke objects do not get recognized prematurely.
Display the inferred word. High-confidence recognition may spawn automatically;
uncertain results offer up to three choices. Always allow typing instead.

An object can be dragged, selected, or deleted using an accessible alternative.
Dragging over the trash highlights it; release deletes the object.
Keep objects inside usable bounds after viewport resize.
Give new visitors one concise instruction, not a tutorial wall.

## Word resolution

Use a static catalog, not a network database.
Resolution order: normalize -> exact name -> alias -> conservative typo match.
Examples: Cat/cat, kitty/kitten -> cat, and a clear typo -> cat.
Do not force an unrelated word to the nearest object.
For unknown or ambiguous words show useful suggestions and preserve input.
Bound input length. Render user text as text, never executable HTML.

Initial catalog:
cat, dog, rabbit, bird, fish, butterfly, tree, flower, mushroom, cactus,
sun, moon.
Expand only after the initial set is cohesive and working.

Each entry has a stable ID, label, aliases, asset, dimensions, and animation key.
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
Use an explicit interaction state: idle, typing, drawing, dragging, modal-open.

Keep the typing path independent of recognition initialization.
Lazy-load drawing recognition, and move expensive work off the main thread
when practical. Handle worker errors, unavailable models, and cancellation.

Drawing recognition is an experimental workstream:
- Investigate an existing appropriately licensed browser model.
- Check class coverage, download size, input preprocessing, and runtime support.
- Evaluate held-out sketches; document errors and confidence behavior.
- If no suitable model is available, ship capture and manual choice honestly.
  Record automatic recognition as incomplete; do not fake a classifier.

## Performance targets, not claimed results

Measure and report browser/device and cold/warm conditions.
- Exact/alias word submission to visible spawn: p95 under 100 ms after readiness.
- Pointer movement: visually smooth around 60 fps on a normal laptop.
- Support 30 simultaneous objects without pronounced input lag.
- Drawing strokes remain immediate while recognition runs.
- Aim for warm recognition under 500 ms; report actual cold-load latency.
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
