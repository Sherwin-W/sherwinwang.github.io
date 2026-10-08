# Task 03B correction round 3 (test only)

Follow `/AGENTS.md`. Edit only `tests/glass-bento.spec.js`. Do not change application code. Do not commit.

Test `reduced transparency uses solid surfaces in both explicit themes` times out on `await page.locator('.home-page .theme-toggle').hover()`. Cause: the test first opens the Privacy panel (`aria-modal` dialog, page behind it is `inert` and covered by the scrim), then tries to hover the toggle behind it, so Playwright correctly cannot hover it. The product is fine (the conductor's DOM audit with reduced transparency found zero translucent backgrounds and zero backdrop-filters for both themes on the home page, with the panel open, and on the Sketchbook page).

Fix the order, keeping every assertion: on `/`, hover the `.theme-toggle` BEFORE opening the panel and audit `.bento-tile--identity`, `.quest-panel`, `.theme-toggle` (hovered) first; then open the Privacy panel, wait for animations to finish (`Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})))`), audit `.project-panel` and the scrim element (`.project-panel__scrim` or whatever the scrim class is, check ProjectPanel.jsx) for alpha 1 and no backdrop-filter, then close it. Keep the Sketchbook section (toggle hover then audit toggle and dock buttons, focus ring check).

Report the exact edit and lint result. You cannot run Playwright.