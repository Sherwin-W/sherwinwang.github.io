# Tasks

- P0 checkpoint: preserved existing work; revised interaction checkpoint
  `924aba8` is committed on `feature/playable-portfolio`.
- I1 current-12 interaction: complete and verified before catalog expansion.
  Select-first, Brush, accessible picker, pause/cancellation, auto-transform,
  Undo/retry, cursor, glow, touch and reduced motion are in the checkpoint.
- M1 validation-gated creation: complete. The 24-label model uses a 0.94 score
  / 0.70 margin threshold selected on validation; validation precision/coverage
  95.39% / 16.68%, test 95.26% / 16.56%.
- C1 batch 24: integrated and evaluated. Twelve additional exact labels,
  original art, adjusted Other classes, 24 model outputs, JavaScript parity,
  held-out metrics, and browser-preprocessing fixtures are present.
- I2 verification: complete after the 24-class integration; unit, browser,
  build, lint, desktop/mobile screenshot, and model-parity checks are recorded
  in `VALIDATION.md`.
- C2 expansion from 24 toward 60: intentionally not started. Review class
  quality and choose the next batch before changing the model again.

Claude's untracked review file is excluded from the checkpoint and must remain
untouched. Do not push or deploy.
