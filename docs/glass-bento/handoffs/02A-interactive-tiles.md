# Task 02A: interactive tile system and new-tab link tiles

Follow `/AGENTS.md`. Read `/DESIGN.md` (sections 4, 6, 7, 8) and `docs/glass-bento/INTERACTIONS.md` (authoritative for this task). Do not run npm install (framer-motion and @phosphor-icons/react are already installed). Do not commit, push, or deploy. Layout and colors do not change.

## Objective

Give interactive tiles restrained macOS-like hover, press, and keyboard-focus behavior, and turn Quest Board and Sketchbook into whole-tile native new-tab links. Static tiles stay static. Sketchbook's destination page is built in task 2B; here it only needs the correct `href`.

## Files you may edit or create

`src/data/projects.js`, `src/data/profile.js`, `src/components/bento/BentoGrid.jsx`, `src/components/bento/Tile.jsx`, `src/components/bento/bento.css`, `src/components/bento/visuals/visuals.css` (only if needed), `src/styles/tokens.css`, new `src/components/bento/motion.js` (shared spring/variant constants). Do not touch `src/playable/**`, `public/**`, `tests/**`, `package.json`, `vite.config.js`, `src/App*`, other pages.

## Data model (documented in the comment block at the top of `projects.js`)

Add optional fields: `href` (string), `newTab` (boolean), `expand` (boolean, used in task 2C; ignore for now). A tile is: a link tile if `href` is set; an expanding tile if `expand` is true (task 2C); otherwise static. Never both. Set: Quest Board `href: 'https://tracker.sherwinwang.dev'`, `newTab: true` (replaces its `links` entry); Sketchbook `href: import.meta.env.BASE_URL + 'sketchbook/'`, `newTab: true`. Do not set `expand` on anything yet. Remove the now-redundant separate pill link on Quest Board.

## Markup (valid HTML, exactly one click target per interactive tile)

Use the stretched-link pattern. Interactive tile = `motion.article` (position relative) whose heading contains the single anchor: `<h2><a class="bento-tile__link" href target="_blank" rel="noopener noreferrer">Title <ArrowUpRight aria-hidden /><span class="visually-hidden">(opens in a new tab)</span></a></h2>`, with `.bento-tile__link::after { content:''; position:absolute; inset:0; }` so the whole tile is clickable while the DOM contains one anchor and no nested interactive elements, and no heading inside a button. Native behavior (Ctrl/Cmd-click, middle-click, context menu, Enter) must work, so no `onClick` navigation, no `window.open`. Quest Board's "Open Quest Board" pill becomes a decorative non-interactive element (`span`, `aria-hidden`) styled like the existing primary pill, with an ArrowUpRight icon; keep its look. Sketchbook and Quest show a small ArrowUpRight indicator in the title (or tile corner) so new-tab behavior is visible. Use Phosphor `ArrowUpRight`, one weight family.

The Identity tile stays a static tile; its GitHub link stays a normal link (pill) but also gets the small ArrowUpRight and visually hidden "(opens in a new tab)" text since it uses `target="_blank"`. Static tiles have no pointer cursor, no lift, no shimmer.

## Motion (framer-motion; constants in `motion.js`)

- Rest/hover/press via variants on the interactive `motion.article`: hover (fine pointers only) `y: -3, scale: 1.015`; press `scale: 0.985, y: 0`; spring `{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }` (no visible overshoot or bounce); return to rest with the same spring so a press "compresses then settles".
- Keyboard: when the inner link matches `:focus-visible`, put the tile in the hover variant (use `onFocus`/`onBlur` handlers that check `event.target.matches(':focus-visible')`) and show a 2px `--accent` ring with 3px offset on the tile (`.bento-tile:has(.bento-tile__link:focus-visible)`), suppressing the link's own outline in that case so there is one ring.
- Shadow: tokens `--shadow-tile` and `--shadow-tile-hover` (one step stronger, same tint family, both themes). Transition `box-shadow` and `border-color` about 220ms ease-out. Never `transition: all`.
- Shimmer: one pass per hover, no loop. Pseudo-element `::before` inside the tile (tile keeps `overflow: hidden`), a soft diagonal gradient band (`--shimmer` token: about 7% white in dark, about 5% accent tint in light), animated with `transform: translateX(-120%) -> translateX(120%)` over about 0.9s ease-out, `animation-iteration-count: 1`, triggered by `:hover`. Gate it with `@media (hover: hover) and (prefers-reduced-motion: no-preference) and (not (prefers-reduced-transparency: reduce))`. It must not alter text legibility (low contrast, `pointer-events: none`, below text via z-order or very low opacity).
- Reduced motion (`useReducedMotion()` and the media query): no scale, lift, or shimmer; hover/focus change only shadow, border color, and ring. Entry stagger stays as is.
- Reduced transparency: tiles remain fully opaque; the shimmer is disabled there (see gate).
- Touch devices: no sticky hover scale after tap (use `@media (hover: hover)` for CSS hover and framer `whileHover` only for fine pointers, e.g. via `window.matchMedia('(hover: hover)')`).

## Preserved work

One `h1`, tokens scoped to `.home-page`, glass/opaque fallbacks, layout areas, media visuals, entry animation, legacy routes. Quest description verbatim. Do not change colors or layout.

## Acceptance criteria

1. Quest Board and Sketchbook tiles: one `<a target="_blank" rel="noopener noreferrer">` each covering the whole tile via the stretched pseudo-element; no nested interactive elements; accessible name includes the title and "(opens in a new tab)"; visible ArrowUpRight indicator.
2. Hover on those tiles: lift and scale about 1.015, stronger shadow, one shimmer pass; press compresses and settles; no looping animation anywhere.
3. Tab to a link tile: same lift plus a single accent ring; Enter activates it.
4. Static tiles (Identity, Privacy, HTML, Flutter for now) show no pointer cursor or hover effect. GitHub link behaves as a normal link.
5. Reduced motion and reduced transparency behave as specified; dark and light both look unchanged otherwise.
6. `projects.js` header comment documents `href`, `newTab`, `expand`.

## Required checks

`npm run lint`, `npm run test`, `npm run build`; report honestly. If a build or browser command is blocked by your sandbox (esbuild access denied), say so and do not work around it. Do not start servers.