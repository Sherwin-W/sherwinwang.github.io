# Task 03A: spacing audit and fix (layout gap/padding, growable tiles)

Follow `/AGENTS.md`. Read `/DESIGN.md`. Do not run npm install. Do not commit, push, or deploy. Preserve the approved design and the Quest Board composition (panel cascade, media proportions). No color changes. Not in scope: the theme toggle (task 03B).

## Measured problems (conductor audit in a real browser, viewports 1440, 820, 390, and 200%-zoom equivalents 720, 410, 195 CSS px wide)

- Description-to-tag-row gap is **0px** on Privacy, HTML Transformer, and Flutter at every viewport (owner's complaint: tags touch descriptions).
- Title-to-description gaps are tight: Quest 5px, Sketchbook 3px, Privacy 5px, Identity/HTML/Flutter 8px.
- Identity: gap between intro and chip row is 74px on desktop (content pinned apart), 84px at 195px; irregular.
- `grid-auto-rows: 140px` fixes row height, so HTML/Flutter cannot grow when text wraps.
- At 195px width: Identity and Sketchbook headings/paragraphs overflow horizontally (`scrollWidth > clientWidth`), and Sketchbook's content is only 7px from the tile edge.
- Text-to-edge distance is only 18px on Sketchbook and 20px on Quest.

## Required spacing system (tokens in `src/styles/tokens.css` or bento.css, used everywhere)

- `--space-title-body: 10px` (title to description; never below 8px).
- `--space-body-tags: 16px` (description to tag/chip row; never below 12px; this applies in both axes: if the tag sits beside the text on wide tiles, the column gap is at least 16px).
- `--space-block: 16px` (artwork to title, between any two content blocks).
- `--space-tag-gap: 8px` (chip/tag row gap and row-gap).
- `--tile-pad: 24px` desktop and tablet, `20px` below 640px; text must stay at least `--tile-pad` from every tile edge. Media/artwork insets (Quest wash, Privacy diagram, Sketchbook stage) may keep their current inset but never below 16px.

Implementation rules: use flex/grid `gap` and padding, not manual margins, `margin: auto` pushes, or absolute offsets, for text stacks. Remove margin/padding hacks (for example `margin: auto 0 0` and `padding: 20px 0 0` on tag lists). Tiles must grow with their content: change `grid-auto-rows: 140px` to `minmax(140px, auto)` (desktop) so wrapped text enlarges the row; use `min-height`, never fixed `height`, and remove any line-clamp, `text-overflow: ellipsis`, or `overflow: hidden` that hides text. Add `min-width: 0` on flex/grid children and `overflow-wrap: anywhere` (or `break-word` plus `hyphens: auto`) for tile headings and paragraphs so nothing overflows at 195px.

Per tile:
- Identity: a clean vertical stack with `gap` (name, intro, GitHub pill, chips) with the spacing tokens; no 74px dead space (let content be centered/top as before but with tokens; the tile keeps its 2-row height on desktop).
- Quest Board: intro text block spacing via tokens (title to description 10px); do not change media size, the panel cascade, or the caption position.
- Sketchbook: the title/summary overlay must never overlap the artwork objects at any viewport; reserve space for the text (for example the stage stays absolutely positioned and the text block sits in normal flow at the bottom with the stage's object area guaranteed above it via padding/min-height) and let the tile grow when the text wraps. Keep the paper stage and artwork look.
- Privacy: artwork, then `--space-block`, title, `--space-title-body`, description, `--space-body-tags`, tags.
- HTML Transformer, Flutter: wide row layout (text left, tag right) with `column-gap: 24px`; below 640px (or whenever the tag wraps) the tag stacks under the description with `--space-body-tags`. Tile grows with wrapped text.
- Expanded panels (`panel.css`, desktop and mobile bottom sheet): panel padding 32px desktop, 24px mobile; Close button to title 24px; title to summary 12px; summary to tags 16px; tags to artwork or details 24px; last element to panel bottom at least 24px (plus `env(safe-area-inset-bottom)` on mobile). Use `gap` on a flex column. Panel content never truncated; it scrolls inside the panel when taller than the viewport.

## Files you may edit

`src/styles/tokens.css`, `src/components/bento/bento.css`, `src/components/bento/panel.css`, `src/components/bento/visuals/visuals.css`, `src/components/bento/Tile.jsx`, `src/components/bento/ProjectPanel.jsx`, `src/pages/Home.css`, `tests/glass-bento.spec.js`. Not in scope: `src/playable/**`, `src/sketchbook/**`, `public/**`, data files (copy stays verbatim), package files.

## Tests (add to `tests/glass-bento.spec.js`; you cannot run Playwright, the conductor will)

A spacing test run at viewports 1440x900, 820x1100, 390x844, 720x450, 195x420 (these emulate default, tablet, mobile, and 200% zoom): for every `.bento-tile` assert (a) when a description paragraph and a tag list both exist, the tag list is at least 12px away from the paragraph (vertical gap if the tag list is below, or horizontal gap if beside); (b) no heading/paragraph has `scrollWidth > clientWidth + 1`; (c) text blocks are at least 20px from the tile edges (use getBoundingClientRect on `h1,h2,p` versus the tile); (d) `document.documentElement.scrollWidth <= clientWidth`; (e) no element with `text-overflow: ellipsis` or `-webkit-line-clamp` inside tiles. A second test opens the Privacy panel at 1440 and 390 and asserts title-to-summary at least 10px, summary-to-tags at least 12px, tags-to-artwork at least 16px, content at least 20px from the panel edges.

## Acceptance criteria

1. Every tile and panel meets the spacing system at all listed viewports, measured, not eyeballed.
2. HTML and Flutter tiles grow when text wraps (verify by reasoning plus the tests; no fixed heights).
3. No text truncation anywhere; no horizontal overflow at 195px.
4. Quest media composition and tile proportions on desktop unchanged apart from the text block spacing.
5. Dark and light unchanged otherwise; reduced-motion and reduced-transparency styles untouched.

## Required checks

`npm run lint`, `npm run test`, `npm run build`; report honestly (sandbox blocks must be reported, not worked around). List files changed.