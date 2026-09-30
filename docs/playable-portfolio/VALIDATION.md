# Validation

## Commands and results

- Baseline `npm run build`: passed (Vite 5.4.8; 380 modules; JS 283.63 kB / gzip 92.33 kB). Baseline `npm run lint`: 13 existing errors in app/components/pages.
- `npm run test`: 14 Node tests passed, including drawing rasterization and model inference.
- `npm run test:browser`: 6 Playwright tests passed in Chromium. Existing desktop/mobile canvas checks remain covered. Recognition tests verified typed spawning does not request the model, lazy model fetch, blank input, independently pointer-drawn sun ranking first, manual acceptance and spawn, an unsupported house, scribble rejection messaging, cancel/clear/new-stroke stale-result suppression, model-load failure, and the 12-choice fallback. Viewport 390x844; screenshot `screenshots/recognition-mobile.png` shows the ranked result and available controls.
- `python scripts/drawing-recognition/train.py`: passed on CPU in 3.52 seconds using a deterministic, bounded sample (31,200 train / 14,400 validation / 14,400 test; 47,040,000 source bytes read). Held-out test top-1 76.31%, top-3 91.63%; all 12 class metrics and full confusion matrix in `recognition-metrics.json`. The split uses disjoint row windows from the same Quick, Draw! source population, not independent people/datasets.
- `npm run build`: passed after recognition integration (Vite 5.4.8; worker is a separate 2.63 kB chunk; application JS 304.13 kB / gzip 98.96 kB; CSS 16.94 kB / gzip 4.17 kB).
- `npm run lint`: 10 errors in existing `Navbar.jsx`, `NavigationButtons.jsx`, `Sidebar.jsx`, `About.jsx`, `Contact.jsx`, and `Projects.jsx`. Focused lint on changed application and test files passes with no warnings.
- Screenshots: `screenshots/desktop.png` (1440x900, first-load starter cat), `screenshots/mobile.png` (390x844, drawing picker open), and `screenshots/recognition-mobile.png` (390x844, ranked recognition result with controls visible), captured by Playwright from the implemented page.

## Limits and outstanding checks

- Eight warm exact/alias submissions measured 21.4 ms p95 from Enter keydown to the second animation frame after the object entered the DOM (Chromium desktop, 1440x900). This measures the local desktop browser path, not a broad device benchmark. Latest local browser recognition run fetched 306,484 model bytes; cold initialization plus first result took 22.5 ms, worker inference 0.9 ms, and warm inference 0.2 ms. These are local Chromium timings, not mobile guarantees.
- Browser verification covers outside release, pointer cancellation, resize clamping and keyboard deletion. The 30-object code cap has unit coverage, but 30-object performance has not been measured.
- Recognition is experimental: per-class held-out top-1 ranges from 49.3% to 76.5%. The `other` rejection output has been measured on only eight named negative categories; arbitrary unsupported drawings can still be mislabeled. Displayed scores are uncalibrated model outputs. Browser-drawn examples are integration checks, not a human-drawn benchmark. See `RECOGNITION.md`.
- Project architecture diagrams, verified project links, detailed technology facts, and a resume are unavailable in the repository content inspected. The old Contact LinkedIn href was a placeholder; a separate About handle is unverified. See `CONTENT_GAPS.md`. No fabricated architecture or URLs are shown.
