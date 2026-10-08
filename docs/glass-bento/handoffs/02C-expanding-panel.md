# Task 02C: in-site expanding panel for Privacy, HTML Transformer, Flutter

Follow `/AGENTS.md`. Read `/DESIGN.md` sections 4, 6, 7, 8 and `docs/glass-bento/INTERACTIONS.md` (authoritative). Do not run npm install. Do not commit, push, or deploy. Layout and colors do not change. Do not touch `src/playable/**`, `src/sketchbook/**`, `public/**`, `vite.config.js`, package files, other pages.

## Objective

Three tiles (Privacy Preserving Visualization Tool, HTML Transformer, Flutter Event Planning App) get `expand: true` in `projects.js`. Activating one animates the tile into a centered detail panel; closing returns it to its grid slot. The panel contains ONLY existing content: title, existing summary, existing tags, optional `details` strings and `links` if present in the data (none exist today), and for Privacy the same abstract illustration rendered larger with its "Illustration" caption. No new claims, no invented copy.

## Files you may edit or create

`src/data/projects.js` (set `expand: true` on those three; keep header comment accurate), `src/components/bento/Tile.jsx`, `src/components/bento/BentoGrid.jsx`, `src/components/bento/bento.css`, `src/components/bento/motion.js`, new `src/components/bento/ProjectPanel.jsx` and `panel.css`, `src/components/bento/visuals/*` (only to allow rendering the Privacy illustration at a larger size), `src/styles/tokens.css`, `src/pages/Home.jsx` / `Home.css` if needed, `tests/glass-bento.spec.js` (add tests).

## Interaction (exactly one click target per tile, valid HTML)

- Expanding tile: `motion.article` with ONE `<button type="button" class="bento-tile__trigger" aria-haspopup="dialog" aria-expanded=...>` that holds only the title text (plus a small decorative `ArrowsOutSimple` or `CaretRight` Phosphor icon, `aria-hidden`), placed inside the heading (`<h2><button>...</button></h2>` is valid), stretched over the tile with `::after { position:absolute; inset:0 }`. No headings inside buttons. Tile gets the same hover/press/keyboard-focus system as link tiles (reuse the single-state `animate` approach and shimmer; the article must NOT get a `tabindex`; tab order is one stop per interactive tile).
- Because only one tab stop exists per tile, arrow icon semantics: link tiles keep ArrowUpRight (external); expanding tiles use a different icon so they do not imply a new tab.
- Open: shared-element transition from the tile (`layoutId` on the tile surface and the panel surface), spring `{ stiffness: 260, damping: 30 }`, content fades in slightly after. Scrim fades in. The source tile must not flicker or leave a hole in the grid while the panel is open (keep its slot size).
- Close: Close button (pill, Phosphor `X`, visible text "Close"), `Escape`, and scrim click. The panel animates back to the exact slot; focus returns to the originating trigger button.
- Dialog semantics: `role="dialog" aria-modal="true" aria-labelledby=<title id>`; on open move focus to the Close button (or the dialog heading); trap Tab/Shift+Tab inside; make the rest of the page `inert` (or `aria-hidden`) while open.
- Scroll lock while open without layout shift (compensate scrollbar width with padding or `scrollbar-gutter`); restore on close; make sure repeated open/close does not leak styles.
- Only one panel at a time. Opening via keyboard (Enter/Space) and pointer both work.
- Mobile (< 640px): the panel becomes a bottom sheet (`100dvh` max, 20px top radius) that still animates from the tile; content scrolls inside the panel.
- Reduced motion (`useReducedMotion` plus media query): no scale or layout animation; fade only (about 150ms). Reduced transparency: panel and scrim are fully opaque (scrim a solid dark color, no blur, no alpha backgrounds). Normal mode: scrim `rgba` with `backdrop-filter: blur(8px)` is allowed but must be inside the same `prefers-reduced-transparency: no-preference` guard; panel uses `--surface` with the existing soft shadow and 28px radius.
- Panel layout: title (largest), summary paragraph, tags row, optional illustration (Privacy), optional `details` list, optional `links` as normal `target="_blank"` links with the ArrowUpRight indicator. Max width 720px. If a field is absent, nothing renders for it (no placeholder text).

## Tests (add to `tests/glass-bento.spec.js`; you cannot run Playwright, the conductor will)

- Clicking a trigger opens `role=dialog` with the matching title; Escape closes and focus returns to the trigger; scrim click closes; Close button closes; Tab stays inside the dialog; `document.body` scroll is locked while open and restored after.
- Keyboard: Enter on a focused trigger opens it.
- Tab order on home: GitHub, Quest, Sketchbook, Privacy, HTML, Flutter (single stop each).
- Panel contains only the tile's existing summary text.
- Reduced motion emulation: opening still works and no transform animation is running on the panel (assert via computed style or `getAnimations()`).

## Acceptance criteria

1. The three tiles expand and close smoothly from/to their grid slots with the spring above; hover/press/focus match the link tiles.
2. Escape, Close button, and scrim close; focus returns; Tab is trapped; scroll locked and restored.
3. No `tabindex` on articles; one tab stop per interactive tile; valid heading/button markup.
4. Reduced motion = fade only; reduced transparency = opaque panel and opaque scrim.
5. Mobile bottom sheet works at 390x844 without horizontal overflow.
6. Only existing content appears in panels.

## Required checks

`npm run lint`, `npm run test`, `npm run build`; report honestly (sandbox blocks must be reported, not worked around). List files changed.