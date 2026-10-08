# Task 02B: Sketchbook destination page (new tab) and delayed loading feedback

Follow `/AGENTS.md`. Read `/DESIGN.md` section 7 and `docs/glass-bento/INTERACTIONS.md` (authoritative). Do not run npm install. Do not commit, push, or deploy. Sketchbook is a NEW-TAB destination in this site's own build, not an embedded canvas. The home tile link (`/sketchbook/`, `target="_blank"`) already exists from task 02A.

Reference only (do not import): `docs/glass-bento/legacy/Home.playable.jsx.txt` and `Home.playable.css.txt` are the previous playable home page (markup, hint text, dock, styles). Reuse its styles and structure for the canvas page, minus the Projects/About/Contact/Resume sheet dialog.

## Objective

A standalone static page at `/sketchbook/` that mounts the existing `PlayCanvas` with its paper look, loads smoothly, works when opened directly, and works on GitHub Pages (static hosting, no server rewrites).

## Files you may edit or create

- Create: `sketchbook/index.html` (project-root folder, a second Vite HTML entry), `src/sketchbook/main.jsx`, `src/sketchbook/Sketchbook.jsx`, `src/sketchbook/sketchbook.css`, `src/sketchbook/Loading.jsx`.
- Edit: `vite.config.js` (multi-page `build.rollupOptions.input` with `main` = `index.html` and `sketchbook` = `sketchbook/index.html`; keep `base: '/'` and the react plugin), `tests/*.spec.js` (see tests), `docs/glass-bento/INTERACTIONS.md` only if a documented fact turns out wrong.
- Read only / do not edit: `src/playable/**` (import `PlayCanvas` and its CSS from there; no changes to recognizer, model, worker, or its tests), `public/**`, `src/App*`, `src/pages/**`, `src/components/bento/**`, package files.

## Page behavior

1. `sketchbook/index.html`: `<title>Sketchbook - Sherwin Wang</title>`, description meta, `theme-color` `#f4efe4`, viewport meta, body background paper (`#f4efe4`) so there is no dark/white flash, `<div id="root">` containing a static, CSS-only loading shell (below), and `<script type="module" src="/src/sketchbook/main.jsx">` (verify the built path works under `base: '/'`).
2. `main.jsx` imports the existing global styles that PlayCanvas expects (the paper tokens and resets in `src/App.css` are what the old home relied on; import it here) and renders `Sketchbook` in `StrictMode`. Do not import the portfolio's `Home`, `tokens.css`, or bento code, so the two bundles stay separate.
3. `Sketchbook.jsx`: renders immediately (outside Suspense) the page frame: header (title "Sketchbook", the one-line hint from the old page), a "Back to portfolio" plain link (`href` = `import.meta.env.BASE_URL`, same tab), and the dock element with `id="play-dock-controls"` (PlayCanvas portals its controls into it; the host must exist before PlayCanvas mounts). Then `const PlayCanvas = lazy(() => import('../playable/PlayCanvas'))` inside `<Suspense fallback={<Loading />}>`.
4. Loading feedback, only in this tab, with NO artificial delay:
   - Layer 1, CSS-only (in `index.html`, inside `#root`): a small spinner block that is `opacity: 0` and fades in via `animation: ... 200ms ease-out 300ms forwards`, so it only becomes visible if the page is still booting after about 300ms. React replaces it when it mounts.
   - Layer 2, React: `Loading.jsx` is the Suspense fallback with the same look and the same 300ms delayed reveal (CSS `animation-delay`, no timers needed). If the lazy canvas resolves before 300ms the user never sees it.
   - Look: small and charming, using existing art: `/objects/cat.svg` (about 56px) rocking gently (rotate about +/-4 degrees, about 1.4s ease-in-out) above the text "Opening sketchbook…" in the page's body font, `role="status"`, `aria-live="polite"`. Under `prefers-reduced-motion: reduce` the cat is static. No spinner ring needed; keep it calm.
   - When the canvas is ready it fades in over about 250ms (CSS opacity animation on the wrapper) and the loading element is removed. Nothing waits on a timer.
5. Visual/UX parity with the old playable home for everything canvas-related: Select mode default, Brush, Objects picker, trash, hint text, mobile layout. The portfolio-sheet buttons (Projects/About/Contact/Resume) are replaced by the single "Back to portfolio" link.
6. GitHub Pages: static hosting only. `npm run build` must emit `dist/sketchbook/index.html` and correctly hashed assets so `https://<host>/sketchbook/` loads when opened directly or refreshed. `public/404.html` stays as is.

## Tests (you may edit and create files in `tests/`)

Existing browser specs (`playable.spec.js`, `drawing-recognition.spec.js`, `artwork.spec.js`) navigate to `/` and assert the old playable home; the home page no longer hosts the canvas, so 13 of 15 currently fail (baseline measured before this task). Point them at `/sketchbook/`, drop assertions about the removed portfolio sheet/dock links, keep every assertion about drawing, recognition, picker, trash, mobile, and reduced motion. Add `tests/glass-bento.spec.js` covering:
- Home: Quest Board and Sketchbook tiles are links with `target="_blank"` and `rel` containing `noopener`; Tab order visits GitHub, Quest, Sketchbook once each (no extra stops).
- Clicking the Sketchbook tile opens a NEW page (`context.waitForEvent('page')`) whose URL path is `/sketchbook/` and shows the canvas; the original page stays on `/`.
- Direct load of `/sketchbook/` works.
- Loading feedback: with the lazy chunk request delayed about 1000ms using `page.route`, "Opening sketchbook…" becomes visible and then the canvas appears and the status text is removed; with no delay, the status text is never visible (assert it never becomes visible, e.g. `expect(locator).toHaveCount(0)` after ready and a short observation window).
- Reduced motion: the cat has no animation (computed `animation-name: none`).
You cannot run Playwright in your sandbox; write the tests carefully and say they were not run. The conductor will run them.

## Acceptance criteria

1. `/sketchbook/` renders the full playable experience with the paper look and works on direct load; the home tab is unchanged when the tile is clicked.
2. The delayed loading feedback follows the rules above (none when fast, charming status when slow, then fade into the canvas), is announced politely, and respects reduced motion.
3. Bundles are separate: the home bundle does not contain PlayCanvas; the sketchbook bundle does not contain the bento code.
4. `dist/sketchbook/index.html` exists after build.
5. Tests updated and added as described. Recognizer/model/worker/playable unit tests untouched.

## Required checks

`npm run lint`, `npm run test`, `npm run build`; report honestly (sandbox blocks must be reported, not worked around). List the files you changed and how many existing browser tests you edited.