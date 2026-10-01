# Status

Branch: `feature/playable-portfolio`. Overnight work continued from
`dd22ef4`; prior interaction checkpoint `924aba8` and batch-24 MLP work are
preserved. The selected active recognizer is now the small CNN at
`public/models/drawing-recognizer-cnn/`; the MLP remains available for
rollback. Overnight implementation, evaluation, screenshots, and handoff are
completed on this feature branch.

The drawing interaction stays Select-first, with Brush and an accessible
24-item object picker for creation. The 1,500 ms post-pointer-up recognizer is
local and lazy. Cancellation, stale-response invalidation, auto-transform,
Undo, suggestion fallback, glowing strokes, mobile picker layout, touch input
and reduced-motion behavior are covered. Recent completed fixes improved
spawn spacing, result wording, restrained ink glow, narrow-screen suggestion
placement, and a transition race that could clear a new stroke after an
earlier accepted transformation.

Six bounded recognition experiments completed. The selected CNN weighs
212,452 bytes; held-out metrics are 73.86%/88.95% overall top-1/top-3,
71.99%/87.96% for supported classes ranked with the UI's exact `Other`
filtering, and 85.17% unknown rejection over 7,200 negatives. The unchanged
validation-selected auto gate gives 95.35% precision and 40.88% supported
coverage on test. These Quick, Draw! scores do not reflect human sketches.
The twelve-stroke browser integration set gets 7/12 top-1, 10/12 top-3, and
four correct auto-transformations out of five (one Bicycle becomes
Butterfly). Dog/Frog/Duck are weak. Scores are not calibrated.

All 36 roadmap illustrations are prepared in `public/objects/roadmap/`,
matched to the catalog direction, but are intentionally not active catalog or
recognition labels. The 24 active labels remain fully wired. The six bounded
validation experiments, metrics, class table, and limitations are documented
in `MODEL_COMPARISON.md`, `RECOGNITION.md`, and `VALIDATION.md`.

Review triage (Claude files remain untouched): `01-current-experience.md`
finding “objects pile at center” resolved with deterministic dispersed spawn
placement; misleading raw percentage language resolved with `Best match`
wording and no score display; mobile overlay resolved by repositioning/scaling
ink above the compact picker and panels; weak glow strengthened; text-only
picker resolved with labeled thumbnails and category grouping. Its request to
start in Brush is obsolete because the newer explicit product direction
requires Select-first; hint copy now explains Brush. The listed cat, dog,
duck/frog, banana, bicycle and moon art defects were corrected and included in
the all-art visual review. Extra starter objects were deferred because the
specified first-load direction keeps one starter cat and most of the canvas
empty. `02-expanded-object-art-direction.md` is adopted for the 36 roadmap-only
assets; none are mislabeled recognition-supported. The review folder was
checked at this milestone and contained only those two completed files (no
drafts or new findings). The separate root Claude review artifact is untracked
and untouched.

Verification is complete: `npm run test` passed 20/20, `npm run lint` passed,
`npm run build` passed, and the corrected full Playwright run passed 15/15.
Independent source review found no concrete regression in model contracts,
cancellation, or mobile panel placement. Screenshots were updated by browser
tests and art review. Human sketch benchmark, physical mobile, network cold
loading, and scaling to 30 simultaneous objects remain unmeasured. A synthetic
single-point tap auto-created Banana; this is a known false-positive case.
Missing verified project diagrams/URLs and LinkedIn confirmation remain
tracked in `CONTENT_GAPS.md`.

No push, deploy or main merge has occurred. Continue only until 07:00
America/Los_Angeles on 2026-10-01, useful authorized work is complete, or
account usage is exhausted. The useful authorized implementation queue is
complete. The next evidence-dependent step is to collect an independent human
sketch set and decide whether automatic creation should remain enabled before
public release; do not tune against the held-out test split.
