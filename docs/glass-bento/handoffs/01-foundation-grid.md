# Task 01: design foundation and data-driven bento grid

## Objective

Replace the home page's visual presentation with a static glass bento grid driven by a single data file, using the tokens and layout in `/DESIGN.md`. Tiles render and are not interactive yet (links excepted) and do not expand (task 2). The existing playable canvas is not mounted in this task; the Sketchbook tile is a plain tile with a placeholder "Opens in a later step" state that is not shown to users as copy (render it as a normal tile with its summary).

## Read first

`/AGENTS.md`, `/DESIGN.md`, `src/pages/Home.jsx`, `src/pages/Home.css`, `src/App.jsx`, `src/App.css`, `src/main.jsx`, `index.html`.

## Files you may edit or create

- Create: `src/data/projects.js`, `src/data/profile.js`, `src/components/bento/BentoGrid.jsx`, `src/components/bento/Tile.jsx`, `src/components/bento/bento.css`, `src/styles/tokens.css`
- Edit: `src/pages/Home.jsx`, `src/pages/Home.css` (replace content; keep default export `Home`), `index.html` (title/description/theme-color only; replace the em-dash in title and description with a hyphen), `src/pages/Contact.jsx` only if the build proves a change is required
- Do not edit: anything in `src/playable/`, `public/`, `tests/`, other pages, `src/App.jsx` routes, `docs/playable-portfolio/`.

## Preserved work

- `src/playable/*` and its tests untouched; `PlayCanvas` stays importable but is not rendered on Home in this task. Do not delete the dock/sheet code you remove without first confirming nothing else imports it (`git grep`). Legacy routes `/about`, `/projects`, `/contact` keep working with their current styling.
- Untracked review docs and the `.gitignore` edit stay as they are.

## Design decisions

- Tokens from DESIGN.md section 2 in `tokens.css`, dark default, light under `prefers-color-scheme: light`. Import tokens once from `Home` (or `main.jsx` if cleaner; say which).
- Grid exactly as DESIGN.md section 5: 12 columns, 8 tiles, three breakpoints (mobile single column, 6-col tablet, 12-col desktop). Spans come from `size` and an optional per-project `area` hint in the data, not hard-coded in JSX.
- `projects.js` entries (order matters for mobile): Quest Board (`size: feature`, `accent: true`, link `https://tracker.sherwinwang.dev`, summary: "A personal dashboard for tracking job applications, practicing LeetCode, and preparing for interviews." (owner-supplied; use verbatim, add nothing else about features)), Privacy Preserving Visualization Tool, HTML Transformer, Flutter Event Planning App (summaries copied verbatim from `Home.jsx`; tags from its `technology` values), Sketchbook (summary: "An interactive drawing canvas that turns sketches into small objects." which matches the existing feature). `profile.js` holds name, one-line intro ("Computer science student with interests in cybersecurity and artificial intelligence."), About text, and Contact (GitHub `https://github.com/sherwin-w` is the ONLY contact link; do not add or invent an email address or LinkedIn URL).
- Intro, About, and Contact tiles are built from `profile.js`, not from `projects.js`; projects and Sketchbook come from `projects.js`. Adding a project object must add a tile with no JSX change.
- Static-grid interactivity (expansion arrives in task 2): tiles awaiting expansion are NOT interactive. Render them as non-focusable `<article>` elements with no button role, no pointer cursor, no hover lift and no press effect, so they do not look like working buttons. Only real links get interactive styling and normal link behavior: Quest Board's "Open Quest Board" pill (`<a href="https://tracker.sherwinwang.dev" target="_blank" rel="noopener noreferrer">`) and the GitHub link in the Contact tile (`https://github.com/sherwin-w`, also new tab with `rel="noopener noreferrer"`). Structure Tile so task 2 can later add expansion without a rewrite. Visible focus ring on links.
- Entry animation: framer-motion fade/rise 12px, 40ms stagger, respecting `useReducedMotion`. No other motion yet beyond CSS hover/active/focus.
- Glass CSS per DESIGN.md sections 4 and 6, including `prefers-reduced-transparency` and `@supports not (backdrop-filter)` fallbacks.
- No em-dashes, no invented stats, no stock images, no decorative dots or uppercase eyebrows.

## Acceptance criteria

1. `/` shows 8 tiles in the specified desktop arrangement at 1440x900 with no empty cell and no horizontal scroll at 390x844.
2. Quest Board is the tallest tile, the only accent-tinted one, shows the owner-supplied description verbatim, and its link goes to `https://tracker.sherwinwang.dev` in a new tab. Non-link tiles are not focusable and show no button affordances. Glass is restrained and text stays highly readable (AA or better) in both themes.
3. Appending a sample object to `projects.js` (verify, then remove it) adds a tile without touching JSX.
4. Dark and light themes both render with readable text; focus ring visible on every tile and link.
5. Reduced motion disables the entry animation; reduced transparency yields opaque tiles.
6. `/about`, `/projects`, `/contact` still render.
7. Only the files in scope changed; `git status` still lists the untracked review docs.

## Dependencies (already installed by the conductor)

The sandbox cannot write the npm cache, so the conductor ran `npm install @fontsource-variable/geist @phosphor-icons/react emailjs-com@^3.2.0`. `package.json` and `package-lock.json` already contain them; do NOT run npm install and do not edit package files. This also fixes the pre-existing gap where `src/pages/Contact.jsx` imported `emailjs-com` but it was only resolvable from a parent directory outside the repo. Contact page code and behavior must stay unchanged: inspect its usage (`emailjs.sendForm` with placeholder `YOUR_*` IDs) and only confirm it still builds; make a code change only if the build proves one is needed, and report it.
## Required checks

Run and report results of: `npm run lint`, `npm run test`, `npm run build`. Baseline before your change (measured by the conductor): lint clean, 20/20 tests pass, build succeeds. Report any difference as new. Do not run Playwright browser tests; do not leave a dev server running. Do not commit.