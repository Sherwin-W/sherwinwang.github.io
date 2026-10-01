# Tasks

- P0 checkpoint: preserved prior work in `51f33c7`, overnight authorization
  in `dd22ef4`, and the Select-first interaction checkpoint `924aba8`.
- I1 interaction: complete. Select-first, Brush, object picker, delayed local
  recognition, cancellation, reversible auto-transformation, ranked fallback,
  cursor, glow, touch and reduced motion are implemented.
- I2 review fixes: complete. Dispersed manual object placement, clearer
  uncalibrated suggestion copy, compact picker/panel placement, stronger
  readable ink, thumbnails/grouping, art revisions and transition-race fix
  are covered by browser/unit checks. Review triage is in `STATUS.md`.
- M1 recognition gate: current selected CNN rule uses score >=0.75, margin
  >=0.66, and the validation-selected 18-label allowlist. Test auto precision
  / supported coverage: 95.35% / 40.88%. Dog, Bird, Moon, Cow, Elephant and
  Frog remain suggestion/picker-only.
- M2 model investigation: six bounded validation experiments and one
  held-out CNN test pass complete. Python/JavaScript parity is covered for
  all outputs. Comparison and exact metric denominators are in
  `MODEL_COMPARISON.md`.
- C1 active batch 24: complete. Labels, original art, Quick Draw training,
  exported CNN, catalog, browser inference, class metrics and fixtures are
  linked end-to-end.
- C2 remaining 36: original artwork and metadata are complete in a separate
  roadmap-only directory. Do not mark these recognition-supported or add them
  to the active catalog/model before a separately evaluated expansion.
- I3 final verification: complete. Node tests 20/20, lint, build, Python/JS
  parity, artwork/browser checks and full Playwright 15/15 passed. The starter
  cat drag/delete/session persistence is explicitly covered.
- H1 morning handoff: `MORNING_REPORT.md` complete; checkpoint locally on the
  feature branch.

Do not push, deploy or merge to main. Leave Claude's untracked reviews and
drafts untouched; inspect completed reviews at milestone boundaries.
