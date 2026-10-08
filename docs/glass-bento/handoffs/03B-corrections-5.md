# Task 03B correction round 5 (test only, one line)

Follow `/AGENTS.md`. Edit only `tests/glass-bento.spec.js`. Do not change application code. Do not commit.

In `reduced transparency uses solid surfaces in both explicit themes`, the check `['', 'none'].includes(item.webkitBackdropFilter)` still fails because the Chromium used by Playwright does not expose `webkitBackdropFilter` on computed style at all: conductor measured it as `undefined` for every audited element (identity tile, quest panels, theme toggle, project panel, scrim), while the unprefixed `backdropFilter` is `'none'` and all backgrounds are opaque. Treat the webkit value as acceptable when it is `undefined`, `''`, or `'none'` (for example `[undefined, '', 'none'].includes(item.webkitBackdropFilter)`) in all three places it is used (portfolio, panel, Sketchbook). Keep every other assertion unchanged.

Report the exact edit and lint result. You cannot run Playwright.