# Task 01B: visual revision of the bento foundation

You are the implementer. Follow `/AGENTS.md`. The owner found the current static grid structurally fine but visually wrong: large text-only, near-equal cards and an oversized empty intro. Revise the visuals while keeping the data-driven structure.

## Step 0: look at the references (required)

Two images are attached to this invocation: `docs/glass-bento/references/reference-bento.png` (composition) and `docs/glass-bento/references/reference-coffee.png` (materials). Inspect both before coding. Begin your final report with a 4-line "What I saw" list (two observations per image, specific enough to prove you saw them). Do not copy their branding, text, or imagery. Then read `/DESIGN.md` (authoritative, updated for this task) and `docs/glass-bento/VISUAL_COMPARISON.md`.

## Objective

Rebuild the home grid as the 7-tile asymmetric layout in DESIGN.md section 4, with media-led tiles, selective glass over a color wash, and honest illustrations. Keep it calm: far less dense than the bento reference.

## Files you may edit or create

- Edit: `src/data/projects.js`, `src/data/profile.js`, `src/components/bento/BentoGrid.jsx`, `src/components/bento/Tile.jsx`, `src/components/bento/bento.css`, `src/styles/tokens.css`, `src/pages/Home.jsx`, `src/pages/Home.css`.
- Create: `src/components/bento/visuals/` containing `QuestPreview.jsx`, `SketchbookStage.jsx`, `PrivacyDiagram.jsx`, `index.js` (registry mapping a `visual` key to a component), and `visuals.css`.
- Read only: `src/playable/catalog.js` (to see which object ids are active; art is at `/objects/<id>.svg`), `public/objects/*`, `public/paper-fibers.svg`.
- Do not edit: `src/playable/**`, `public/**`, `tests/**`, `package.json`, lockfile, other pages, `src/App.jsx`, `src/App.css`. Do not run `npm install`.

## Preserved work

Everything functional from task 01 and 01 corrections: one `h1` (identity), non-interactive tiles (no button role, no hover lift) except real links, links open in a new tab with `rel="noopener noreferrer"`, tokens scoped to `.home-page` (no `:root` leaks, legacy `/about` `/projects` `/contact` unchanged and still cream), document background fix, reduced-motion, reduced-transparency and `@supports` fallbacks, Quest Board description verbatim ("A personal dashboard for tracking job applications, practicing LeetCode, and preparing for interviews."), Quest link `https://tracker.sherwinwang.dev`, GitHub `https://github.com/sherwin-w` as the only contact link. Data-driven: appending an object to `projects.js` must still add a tile with no JSX change.

## Design decisions (implement exactly; details in DESIGN.md)

1. **Tiles (desktop 12 cols, `grid-auto-rows: 140px`, gap 16px):** Identity c1-4 r1-2; Quest Board c5-12 r1-4; Sketchbook c1-4 r3-4; Privacy c1-5 r5-6; HTML Transformer c6-8 r5; Flutter c6-8 r6; Interests c9-12 r5-6. Seven tiles, no gaps. Remove the separate About and Contact tiles. Update tablet (6 col) and mobile (1 col) rules per DESIGN.md section 4; mobile order: Identity, Quest Board, Sketchbook, Privacy, HTML, Flutter, Interests. On tablet/mobile use `grid-auto-rows: auto` and fixed `aspect-ratio` on media areas so nothing shifts.
2. **Identity:** `h1` "Sherwin Wang" at the smaller size in DESIGN.md, one line of copy ("Computer science student focused on cybersecurity and AI."), GitHub pill link. This tile uses glass (blur) and the page needs a visible soft glow behind it (top-left) so the glass reads. No other text.
3. **Quest Board:** dominant tile. Text block at top-left (title, description, primary pill "Open Quest Board"). Media area fills the remaining space with the `--wash` backdrop (rounded 20px) and 3 floating glass panels at different offsets (generic labels "Applications", "Practice", "Interviews"; Phosphor icons `Briefcase`, `Code`, `ChatCircleDots`; skeleton lines/bars only). ABSOLUTELY no numbers, percentages, names, streaks, company names, or progress values anywhere in the illustration. Visible small caption "Illustration" inside the media corner. Panels may lift at most 6px on hover of the tile, disabled for reduced motion. If the data item has `image: { src, alt }`, render that image in the media area instead of the illustration (supports a future sanitized screenshot); no image exists today, so the illustration renders.
4. **Sketchbook:** paper-colored stage (`--paper`, optionally `/paper-fibers.svg` as a subtle background) inside the tile, composed of 6 to 7 active original objects from `/objects/<id>.svg` (choose from cat, sun, fish, flower, bird, butterfly, moon; confirm they are in `catalog.js`) at varied sizes and slight rotations, plus one dashed brush-stroke SVG path suggesting the drawing gesture. Title and one-line summary sit at the bottom over a soft gradient scrim for legibility. Objects are `aria-hidden`, `alt=""`, `loading="lazy"`, with `width`/`height`.
5. **Privacy Preserving Visualization Tool:** media area on top: abstract diagram (a scatter of dots, a soft noise band, a smoothed outline) built with SVG and tokens; caption "Illustration". Then title, one-line summary, and the existing tag. No claims about results.
6. **HTML Transformer and Flutter Event Planning App:** small text tiles: title, one-line summary, existing tag. No media. Summaries stay verbatim from `projects.js` today (they may be clamped to two lines in CSS).
7. **Interests tile:** title "Interests" and chips from `profile.interests`: Cybersecurity, Artificial intelligence, Web development, Mobile app development.
8. **Materials (DESIGN.md sections 2 and 6):** add `--surface`, updated `--glass`, `--text-dim`, `--wash`, `--paper` tokens exactly as specified (dark and light). Calm tiles use `--surface` + 1px edge + soft tinted shadow with NO backdrop-filter. Only the Identity tile and the Quest floating panels use `backdrop-filter: blur(20px) saturate(140%)`. Radius 28px tiles, 18px inner panels, pills for buttons/chips. Keep all fallbacks.
9. **Data shape:** `projects.js` entries gain `size` (`feature | wide | standard | compact`), `area`, and optional `visual` key or `image`. Tile resolves `visual` through the registry; unknown or missing renders a clean text tile. Add a short comment block at the top of `projects.js` documenting the fields.
10. **Typography:** per DESIGN.md section 3. Quest Board title is the largest type on the page. `text-wrap: balance` titles, `pretty` body. No em-dashes, no uppercase eyebrows, no status dots.
11. **Motion:** keep the entry stagger (reduced motion respected). No looping animation.

## Acceptance criteria

1. At 1440x900 the arrangement matches section 4 with no empty cells; Quest Board visibly dominates; Identity is compact and no longer the biggest tile.
2. Quest Board media shows the blue wash with three floating glass panels where blur is visibly perceptible; "Illustration" caption present; no fabricated figures.
3. Sketchbook shows real object artwork on a paper stage and no large blank region.
4. Privacy shows the diagram; HTML and Flutter are small text tiles.
5. At 390x844 one column in the specified order, no horizontal scroll, media areas keep their aspect ratios, at most 3 backdrop-filter elements exist in the DOM.
6. Dark and light both readable (AA); focus ring visible on the two links.
7. Exactly one `h1`; non-link tiles not focusable; legacy routes unchanged (body background still `rgb(244, 239, 228)` on `/contact`).
8. Appending a sample project object (verify, then remove it) adds a tile with no JSX change.
9. Only files in scope changed; nothing committed.

## Required checks

Run `npm run lint`, `npm run test`, `npm run build` and report honestly. Baseline: lint clean, 20/20 tests, build succeeds; if the build fails inside your sandbox with an esbuild/EPERM-style error, report it as a sandbox block and do not work around it. Do not start servers.