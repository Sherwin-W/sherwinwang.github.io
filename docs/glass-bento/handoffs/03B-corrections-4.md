# Task 03B correction round 4 (test only, one line)

Follow `/AGENTS.md`. Edit only `tests/glass-bento.spec.js`. Do not change application code. Do not commit.

In `reduced transparency uses solid surfaces in both explicit themes`, the audit asserts `item.webkitBackdropFilter === 'none'`. In Chromium `getComputedStyle(el).webkitBackdropFilter` returns an empty string `''` (the unprefixed `backdropFilter` returns `'none'`). Conductor measured every audited element in both themes (identity tile, quest panels, theme toggle, project panel, scrim): `backdropFilter: 'none'`, `webkitBackdropFilter: ''`, all backgrounds opaque. Accept `''` or `'none'` for the webkit value (for example `['', 'none'].includes(item.webkitBackdropFilter)`), in both the portfolio and Sketchbook assertions. Also make the alpha parser handle the `color(srgb r g b)` and `color(srgb r g b / a)` formats that `color-mix()` produces (identity tile background computes to `color(srgb 0.103 0.130 0.193)`): treat a missing `/ a` as alpha 1 and parse `/ a` when present. Keep every assertion's intent.

Report the exact edit and the lint result. You cannot run Playwright.