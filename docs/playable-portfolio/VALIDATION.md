# Validation

## Commands and results

- Baseline `npm run build`: passed (Vite 5.4.8; 380 modules; JS 283.63 kB / gzip 92.33 kB). Baseline `npm run lint`: 13 existing errors in app/components/pages.
- `npm run test`: 11 Node tests passed across matching and interaction contracts.
- `npm run test:browser`: 4 Playwright tests passed in Chromium. Desktop exercised typed alias spawn, drag to trash, project dialog, Escape and focus restoration. Mobile (390x844) exercised unknown-word retention, multi-stroke draw/manual choice, asset load, no horizontal overflow, and reduced-motion preference. Another scenario verified pointer cancellation, release beyond viewport bounds, and keyboard Delete. Desktop scenario reported no page errors.
- `npm run build`: passed after implementation (Vite 5.4.8; 384 modules; JS 297.52 kB / gzip 96.79 kB; CSS 13.43 kB / gzip 3.66 kB).
- Final `npm run lint`: 10 errors in existing `Navbar.jsx`, `NavigationButtons.jsx`, `Sidebar.jsx`, `About.jsx`, and `Contact.jsx`. Focused lint on App, Home, playable modules and browser tests passes.
- Screenshots: `screenshots/desktop.png` (1440x900) and `screenshots/mobile.png` (390x844), captured by Playwright from the implemented page.

## Limits and outstanding checks

- Eight warm exact/alias submissions measured a 25.6 ms p95 from Enter keydown to the second animation frame after the object entered the DOM (Chromium desktop, 1440x900). This measures the local desktop browser path, not a broad device benchmark.
- Browser verification covers outside release, pointer cancellation, resize clamping and keyboard deletion. The 30-object code cap has unit coverage, but 30-object performance has not been measured.
- Missing object assets are not simulated in-browser. Drawing model recognition remains incomplete by design; Create opens manual catalog choices and does not report inferred words or confidence.
- Project architecture diagrams and verified project links are unavailable in the repository content inspected. Project sheets preserve the existing summaries and technologies only; no fabricated architecture is shown.
