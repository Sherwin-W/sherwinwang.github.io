# Validation

## Current 12-object interaction milestone

- Preserved checkpoint: `5bcf157`. Interaction edits are being committed after this current-12 verification; no catalog/model expansion is integrated yet.
- `npm run test`: 15 Node tests passed, including committed-model Python/JavaScript parity for all 13 output scores across four fixed inputs (absolute tolerance `1e-5`).
- `npm run test:browser`: 9 Chromium Playwright tests passed. They cover Select-first behavior, no click-to-create, picker-driven objects, drag/trash/delete, portfolio sheet, touch pointer events, wand cursor hotspot, glowing core, reduced motion, a multi-stroke 1,500 ms debounce, a >1.5 s held pointer (no recognition until release), validation-gated Sun transformation, Undo and explicit retry, uncertain/unsupported suggestions plus picker, scheduled and in-flight cancellation, and model-load failure.
- Automatic Sun example at 390x844: pointer-up to visible spawned object **1,654 ms** (observed 1,500 ms debounce plus browser/model/UI work); worker request-to-result **22.1 ms**, inference **1.3 ms**, model payload **306,484 bytes**. Chromium desktop with a 390x844 viewport and local Vite server; this is not a physical-device benchmark. Captured to `screenshots/recognition-auto-mobile.png`.
- `python scripts/drawing-recognition/calibrate_autospawn.py`: validation-only rule selection on 14,400 validation rows (7,200 supported / 7,200 Other). The rule (supported winner, top score >=0.91, margin >=0.50) yields **95.41% validation precision** and **26.88% supported coverage**. Weak accepted-class precision/coverage includes Dog 60.0% / 5.0% and Bird 86.54% / 8.67%. No test labels were read for threshold selection; no fitting/retraining was performed for this rule.
- `npm run build`: Final build passed with worker as its own 2.91 kB chunk, app JS 304.44 kB / gzip 98.99 kB, CSS 17.16 kB / gzip 4.40 kB.
- Focused lint of changed React/JS/test files passes with no warnings. Full repository lint retains the previously documented 10 errors in unrelated legacy components.
- Screenshots: `screenshots/desktop.png` (1440x900, Select default), `screenshots/mobile.png` (390x844, accessible picker), and `screenshots/recognition-auto-mobile.png` (390x844, accepted Sun transformed with Undo available).

## Recognition/model evidence carried forward

- Held-out overall 13-label top-1/top-3: 76.31% / 91.63%. Supported-only raw 13-label: 65.51% / 86.85%. UI-filtered supported top-1/top-3 recall: 71.56% / 89.22%. Unknown rejection: 87.86% over eight named negative source categories. Per-class values and confusion data: `recognition-metrics.json` and `RECOGNITION.md`.
- Current model is still only 12 objects; the revised next-24 category plan is in `CATALOG_ROADMAP.md`. The next batch has not been added to the app, model, or artwork.
- Scores remain uncalibrated softmax values. Validation precision/coverage are empirical for sampled Quick, Draw! windows, not guarantees for freehand visitors.
- Missing project architecture diagrams and verified project links remain tracked in `CONTENT_GAPS.md`; no project architecture or URLs are fabricated.

