# Status

Branch `feature/playable-portfolio` now contains the revised drawing-first
interaction and evaluated batch-24 catalog. The interaction checkpoint is
`924aba8`; the 24-object integration is complete and evaluated on this branch.
Select is the initial mode. Visitors create objects by drawing with Brush or
using the accessible object picker. Click-to-type and the Type toggle are
removed from the visitor UI.

The canvas waits 1,500 ms after pointer-up before recognition and invalidates
scheduled or in-flight results on new strokes, clearing, undo, mode changes,
portfolio sheets, and unmount. Accepted results replace ink at the drawing
center with a reversible transition. Uncertain results retain the sketch and
show three suggestions plus the picker. Brush glow and cursor respect reduced
motion and touch input.

The active 24-output browser model is 311,140 bytes. Its validation-selected
score/margin rule is >=0.94 / >=0.70, with 95.39% validation precision and
16.68% supported coverage; fixed-rule held-out precision/coverage are 95.26% /
16.56%. Supported-only raw top-1/top-3 are 58.25% / 78.40%; matching the UI's
Other-filtered ranking gives 60.96% / 80.26%. Unknown rejection is a separate
73.42% over eight named negative categories. Scores remain uncalibrated.

The model is weak on Dog, Bird, Elephant, Frog, and Duck, especially for
automatic acceptance. In the independent 12-drawing browser preprocessing
set, UI-filtered top-1/top-3 were 5/12 and 7/12, with one auto-created object.
These fixed synthetic examples are not a human drawing benchmark. Full
per-class, confusion, browser, and timing results are linked from
`VALIDATION.md` and `RECOGNITION.md`.

The 24-object stage is complete; the remaining 36 candidates are only a
roadmap. Do not add them until these results are reviewed. Missing project
architecture diagrams, verified project links, and LinkedIn-profile
confirmation remain tracked in `CONTENT_GAPS.md`. Claude's review file remains
untracked and untouched. No push or deployment occurred.
