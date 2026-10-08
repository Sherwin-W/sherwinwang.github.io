# Task 03B: light/dark theme toggle, persisted, applied to the portfolio and the Sketchbook

Follow `/AGENTS.md`. Read `/DESIGN.md` (sections 2, 6, 7, 8). Do not run npm install (Phosphor `Sun` and `Moon` are in `@phosphor-icons/react`). Do not commit, push, or deploy. The approved layout, colors, Quest composition, spacing system (task 03A), and all interactions (task 02) must not change in the default state.

## Behavior

- A small, discoverable icon button (Phosphor `Moon` shown when the current theme is light, `Sun` when dark) at the top of the portfolio, outside the project tiles: a slim header row above the grid, right-aligned within the 1200px content width (or top-right of `.home-page`), about 12-16px above the first tile row. Do not move or resize any tile; the grid simply starts a little lower. Target size at least 44x44 CSS px (circular pill), glass-light styling consistent with the site (surface fill, 1px edge, soft shadow, same radius logic, accent focus ring), restrained hover (slight background change; use the same fine-pointer-only hover rule as tiles; no scale bounce needed).
- Accessible name states the action: `aria-label="Switch to light theme"` when dark, `"Switch to dark theme"` when light (also a matching `title`). It is a real `<button type="button">`, keyboard operable (Enter/Space), with a visible `:focus-visible` ring (2px `--accent`, 3px offset). The icon is `aria-hidden`.
- First visit (no stored choice): follow the system (`prefers-color-scheme`). After the user toggles: store `'light'` or `'dark'` in `localStorage` under the key `theme`, wrap storage access in try/catch (private mode, blocked storage), and keep working in memory if it fails. Do not store anything until the user toggles. Sync across tabs via the `storage` event (the Sketchbook opens in a new tab, so a change in one tab updates the other).
- Apply the saved theme before first paint: an inline, tiny, synchronous `<script>` in the `<head>` of BOTH `index.html` and `sketchbook/index.html` reads `localStorage.theme` and, if it is `light` or `dark`, sets `document.documentElement.dataset.theme` immediately and sets the `<meta name="theme-color">` content to the matching page color. If nothing is stored, set no `data-theme` (CSS media queries decide). Also add a tiny critical `<style>` in each head so `html` has the right background color before the stylesheet loads (dark `#0b0d12` / light `#e3e7ef` for the portfolio, via `html[data-theme]` and a `prefers-color-scheme` media query for the unset case; Sketchbook: paper `#f4efe4` light / dark paper below). Gate the portfolio's critical background to the home path only (`/` or `/index.html`) with a flag set by the inline script (for example `data-boot="home"`), so legacy routes (`/about`, `/projects`, `/contact`, which are cream) never flash dark. No flash of the wrong theme on reload for either page.
- The same module (`src/theme/theme.js`, shared by both entries, plus a small `ThemeToggle.jsx`) exposes: `getStoredTheme()`, `getEffectiveTheme()` (stored or system), `setTheme(theme)` (sets attribute, stores, updates theme-color meta, notifies listeners), and a `useTheme()` hook that tracks system changes while no choice is stored and the `storage` event.
- Smoothness: when the user toggles, add a class (for example `theme-transition`) on `<html>` for about 250ms that enables `transition: background-color, color, border-color, box-shadow` (about 250ms ease) on `.home-page`, `.bento-tile`, `.bento-link`, `.bento-chips li, .bento-tags li`, `.project-panel`, `.theme-toggle` only, then remove it. Never `transition: all`, never on every element, and it must not touch `transform`/`opacity` so tile hover/press/expand animations are unaffected (verify there is no transform transition added). Do not trigger this on initial load. Under `prefers-reduced-motion: reduce` there is no transition (instant swap).
- Reduced transparency: the opaque fallback tokens must also follow the chosen theme (see tokens below). Reduced motion: unchanged.

## Token restructure (`src/styles/tokens.css`, `src/components/bento/bento.css`, `panel.css`, `visuals.css`)

Currently dark tokens are the default on `.home-page` and light tokens live inside `@media (prefers-color-scheme: light)`; the reduced-transparency overrides are also split by that media query. Restructure so the explicit choice wins over the system:
- Dark tokens: default.
- Light tokens apply when `:root[data-theme="light"] .home-page` OR (`@media (prefers-color-scheme: light)` AND `:root:not([data-theme="dark"]) .home-page`).
- Same for the `color-scheme` property, the document-level background rules (`html:has(.home-page)`, `body:has(.home-page)`), the opaque reduced-transparency/`@supports` fallbacks (all four combinations: light/dark x glass/opaque), the `--wash`, `--shimmer`, panel and scrim colors, and `theme-color`.
- Keep the rest of the CSS reading tokens; do not duplicate component rules per theme where tokens suffice. Keep the stylesheet organized and commented (it was just consolidated in 03A; do not reintroduce layered contradictory overrides).

## Sketchbook dark theme (`src/sketchbook/sketchbook.css`, `sketchbook/index.html`, `src/sketchbook/main.jsx`/`Sketchbook.jsx`)

The Sketchbook must honor the same theme. Its colors come from the playable CSS, which you must NOT edit (`src/playable/**`): `PlayCanvas.css` defines `--paper:#f4efe4; --paper-raised:#fbf8f1; --graphite:#2b2a28; --graphite-soft:#6b675f; --line:#3a3631; --clay; --focus` on `.play-canvas` and hardcodes `.draw-stroke-core { stroke:#2b2a28 }`, `.draw-stroke-glow { stroke:#43af91 }`, toolbar/picker borders such as `#d7cdbc`, and so on. Override from `src/sketchbook/sketchbook.css` with selectors that win on specificity (for example `:root[data-theme="dark"] .play-canvas { ... }` and the media-query variant for the unset case) to give a calm dark paper palette: page and canvas `--paper` about `#1a1917`, raised surfaces `--paper-raised` about `#262421`, text/ink `--graphite` about `#ece7dc`, soft text about `#a39d90`, `--line` about `#cfc8b8`, ink core stroke `#ece7dc`, keep the green glow. Find every hardcoded light color in `PlayCanvas.css` (toolbar, picker, recognition panel, buttons, trash icon, focus states, brush cursor) and override it in dark so no light-on-light or dark-on-dark text/controls remain. The paper fibers texture is not used. Light remains exactly as today. The existing object artwork keeps its sticker outlines on dark. The Loading screen and the `index.html` boot shell also follow the theme (text and background colors). Place a `ThemeToggle` (same component) at the top-right of the Sketchbook page, not overlapping the canvas controls, header, or the "Back to portfolio" link, also min 44px target.

## Files you may edit or create

`index.html`, `sketchbook/index.html`, `src/theme/theme.js`, `src/components/ThemeToggle.jsx` (+ `theme-toggle.css`), `src/pages/Home.jsx`, `src/pages/Home.css`, `src/styles/tokens.css`, `src/components/bento/*.css`, `src/components/bento/BentoGrid.jsx` (only if required), `src/sketchbook/*`, `tests/glass-bento.spec.js`. Not in scope: `src/playable/**`, `public/**`, data files, package files, legacy pages (`src/pages/About|Contact|Projects*`, `src/App*`).

## Tests (add to `tests/glass-bento.spec.js`; you cannot run Playwright, the conductor will)

- With `colorScheme: 'dark'` and no storage the portfolio is dark; with `colorScheme: 'light'` it is light (check a token or computed background); no `data-theme` attribute is set and nothing is written to `localStorage`.
- The toggle has the correct accessible name for each state, is at least 44x44, is reachable by keyboard, Enter toggles it, and the name flips; after toggling `localStorage.theme` is set and `document.documentElement.dataset.theme` matches.
- Persistence: after toggling to light under a dark system, reload: still light, and `data-theme="light"` is present before React renders (use `page.route` to delay the `main.jsx` module by 800ms and assert `html` already has `data-theme="light"` and the computed `html` background is the light color while the app has not mounted).
- Cross-page: after choosing light on `/`, open `/sketchbook/` (new page in the same context): `data-theme="light"`; choose dark: Sketchbook computed `--paper`/page background is dark and a drawn ink stroke core uses a light stroke; toggling on one page updates an open second page via the `storage` event.
- Reduced motion: toggling applies the theme with no `transition-duration` set on tiles (computed `transition-property` does not include `transform`).
- Reduced transparency (CDP `prefers-reduced-transparency: reduce`) plus both themes: no translucent backgrounds on tiles/panels (the existing audit pattern).
- Legacy `/contact` stays cream regardless of the stored theme (computed body background `rgb(244, 239, 228)`).

## Acceptance criteria

1. Toggle present, labeled, focus-visible, 44px+, keyboard operable on both pages.
2. System default on first visit; explicit choice persists across reloads and across the two pages and tabs.
3. No flash of the wrong theme on reload (attribute and background set before the app mounts) on both pages.
4. Smooth 250ms color transition on toggle only; tile transforms unaffected; reduced motion = instant.
5. Dark and light both polished across all tiles, panels, Sketchbook UI; reduced-transparency fallbacks opaque in both themes.
6. No layout shift of tiles other than the grid starting lower by the header row; spacing system intact.

## Required checks

`npm run lint`, `npm run test`, `npm run build`; report honestly (sandbox blocks must be reported, not worked around). List files changed.