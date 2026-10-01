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
score/margin rule is >=0.94 / >=0.70 plus a validation-selected predicted-label gate: at least 20 accepted validation examples and >=90% per-label precision. Dog, Rabbit, Bird, Cow, Duck, Elephant, Frog, and Sun stay suggestion/picker-only. The final rule has 96.15% validation precision / 15.57% supported coverage and 95.72% / 15.35% held-out test. Supported-only raw top-1/top-3 are 58.25% / 78.40%; matching the UI's
Other-filtered ranking gives 60.96% / 80.26%. Unknown rejection is a separate
73.42% over eight named negative categories. Scores remain uncalibrated.

The model is weak on Dog, Rabbit, Bird, Cow, Duck, Elephant, and Frog. Sun's validation auto-accept precision missed the per-label gate. These categories remain available as suggestions and in the picker, not automatic creation. In the independent 12-drawing browser preprocessing
set, UI-filtered top-1/top-3 were 5/12 and 8/12, with one auto-created object.
These fixed synthetic examples are not a human drawing benchmark. Full
per-class, confusion, browser, and timing results are linked from
`VALIDATION.md` and `RECOGNITION.md`.

The 24-object stage is complete; the remaining 36 candidates are only a
roadmap. Do not add them until these results are reviewed. Missing project
architecture diagrams, verified project links, and LinkedIn-profile
confirmation remain tracked in `CONTENT_GAPS.md`. Claude's review file remains
untracked and untouched. No push or deployment occurred.

Overnight continuation began from checkpoint `51f33c7`. `RUNBOOK.md` now
authorizes work until 07:00 America/Los_Angeles on 2026-10-01 (or useful
backlog completion / usage exhaustion) and allows six bounded validation
experiments. The current full lint baseline has ten errors in seven legacy
React components; these are queued for minimal cleanup. Next: validate model
alternatives using train/validation only, audit the browser interaction, and
prepare the remaining 36 asset-only objects without changing active labels.
At milestone boundaries, check `claude-reviews/`, ignore drafts, and triage
completed reviews in this status file. Current Claude review directory had
no completed files at the first check; the existing root Claude review result
remains untracked and untouched.
