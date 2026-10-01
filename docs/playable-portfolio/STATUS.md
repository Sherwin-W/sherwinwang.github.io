# Status

Revised interaction milestone based on preserved checkpoint `5bcf157` on
`feature/playable-portfolio`. Select is now the default and creation is Brush
or the accessible object picker. The former click-to-type/Type-toggle flow is
removed. The current 12-class model is still in use; no 24-class expansion is
integrated yet.

Implemented: 1,500 ms pointer-up debounce, lazy local recognition, validation-
selected score+margin auto-spawn, unsupported/uncertain suggestions, reversible
ink-to-object transition, stroke restoration without immediate re-recognition,
stale request invalidation, touch input, wand cursor, restrained glowing ink,
reduced motion, and portfolio-sheet cancellation. Model remains separate from
basic canvas interaction.

Validation-selected auto-spawn policy is winner supported, score >=0.91,
runner-up margin >=0.50; validation precision 95.41%, supported coverage
26.88%. Scores are not calibrated probabilities. The report and category
roadmap are in `autospawn-validation.json` and `CATALOG_ROADMAP.md`.

Current-12 interaction browser verification passed on desktop and at 390x844,
including multi-stroke debounce, a slow held pointer, accepted Sun creation,
undo/retry, uncertain house, manual choice, pending/timer cancellation, touch,
drag/delete, project-sheet cancellation, unmount, and reduced motion. The 24-
object model/art/catalog batch remains the next milestone; no labels beyond the
current 12 are currently recognized.

Claude's untracked review file remains untouched. No deployment occurred.
