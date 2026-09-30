# Validation

## Commands and results

- Baseline `npm run build`: passed (Vite 5.4.8; 380 modules; JS 283.63 kB / gzip 92.33 kB). Baseline `npm run lint`: 13 existing errors in app/components/pages.
- `npm run test`: 12 Node tests passed across matching, responsive object sizing and interaction contracts.
- `npm run test:browser`: 4 Playwright tests passed in Chromium. Desktop exercised typed alias spawn, drag-to-trash, project dialog, Escape and focus restoration. Mobile (390x844) exercised unknown-word retention, drawing, the 12-choice manual picker, choice-to-object replacement near the stroke, selection, keyboard movement/deletion, typed spawning, starter deletion persistence, reduced motion, picker/dock clearance, and no horizontal overflow. Pointer cancellation and outside release were also verified. Desktop scenario reported no page errors.
- `npm run build`: passed after review fixes (Vite 5.4.8; 384 modules; JS 299.26 kB / gzip 97.33 kB; CSS 15.41 kB / gzip 4.01 kB).
- `npm run lint`: 10 errors in existing `Navbar.jsx`, `NavigationButtons.jsx`, `Sidebar.jsx`, `About.jsx`, `Contact.jsx`, and `Projects.jsx`. Focused lint on changed application and test files passes.
- Screenshots: `screenshots/desktop.png` (1440x900, first-load starter cat) and `screenshots/mobile.png` (390x844, drawing picker open), captured by Playwright from the implemented page.

## Limits and outstanding checks

- Eight warm exact/alias submissions measured a 25.6 ms p95 from Enter keydown to the second animation frame after the object entered the DOM (Chromium desktop, 1440x900). This measures the local desktop browser path, not a broad device benchmark.
- Browser verification covers outside release, pointer cancellation, resize clamping and keyboard deletion. The 30-object code cap has unit coverage, but 30-object performance has not been measured.
- Missing object assets are not simulated in-browser. Drawing model recognition remains incomplete by design; Create opens manual catalog choices and does not report inferred words or confidence.
- Project architecture diagrams, verified project links, detailed technology facts, and a resume are unavailable in the repository content inspected. The old Contact LinkedIn href was a placeholder; a separate About handle is unverified. See `CONTENT_GAPS.md`. No fabricated architecture or URLs are shown.
