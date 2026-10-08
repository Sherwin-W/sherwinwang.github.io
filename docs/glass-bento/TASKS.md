# Glass bento redesign: task queue

Branch: `feature/glass-bento-redesign` (from `feature/playable-portfolio` @ 003da83). One Codex task at a time, each accepted before the next. Direction lives in `/DESIGN.md`.

| # | Task | Status |
|---|---|---|
| 0 | Conductor setup, Codex connection check, DESIGN.md | Done |
| 1 | Design foundation and data-driven bento grid (static, no expansion) | Done; superseded visually by 01B |
| 1B | Visual revision from owner references (asymmetric media-led layout, selective glass) | Implemented and verified, awaiting user visual review (`handoffs/01B-visual-revision.md`, `01B-corrections-1..3.md`, `VISUAL_COMPARISON.md`; final screenshots in `screenshots/final/`) |
| 2A | Interactive tile system (hover/press/focus/shimmer), new-tab link tiles | Done, browser-verified |
| 2B | Sketchbook destination page (`/sketchbook/`, new tab, delayed loading feedback), browser tests repointed | Done, browser-verified, 22/22 Playwright |
| 2C | In-site expanding panel for Privacy, HTML Transformer, Flutter | Done, browser-verified; awaiting owner preview (`INTERACTIONS.md`, `handoffs/02*.md`) |
| 3 | (Dropped) embedded canvas; replaced by the new-tab Sketchbook page in 2B | Superseded |
| 3A | Spacing system (tokens, growable tiles, no truncation), consolidated tile CSS | Done, measured at 1440/820/720/390/195 |
| 3B | Light/dark toggle (system default, persisted, pre-paint, Sketchbook themed) | Done, browser-verified; 32/32 Playwright |
| 4 | Responsive, light mode, reduced-motion/transparency, Playwright tests | Folded into 2-3B |
| 5 | Claude review pass, copy audit, fixes | Planned |

Note: the owner's Windows has Transparency effects off, so Chromium reports `prefers-reduced-transparency: reduce` and the opaque fallback renders. Glass screenshots (`glass-*.png`) force `no-preference` via CDP; `fallback-*.png` show what that machine sees.

Deployment is out of scope until the user approves.

## Open questions for the user (not blocking task 1)

- Whether to keep legacy `/about`, `/projects`, `/contact` routes long-term.

Release is paused by the owner: no merge, push, or deploy until the interaction preview is approved.
