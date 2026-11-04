# Mini-apps plan (branch `feature/mini-apps`)

Specs live outside the repo: `../SPOTIFY_README.md`, `../MPTI_README.md`, `../BLACKJACK_CARD_COUNTING_README.md`.

## Decisions

- **Roles (owner decision, 2026-11-02):** Claude writes the code on this branch; Codex reviews. This overrides the conductor role in CLAUDE.md for this branch only.
- **TypeScript for new code.** Existing `.jsx` is untouched. `tsc --noEmit` covers `src/**/*.ts(x)` and `server/**/*.ts`. Vitest (+ jsdom, Testing Library) runs TS unit tests; the existing `node --test` playable tests still run first in `npm test`.
- **Static site stays on GitHub Pages.** Anything needing secrets lives in `server/`, a separate Vercel project (Root Directory = `server`), the same platform Quest Board uses (Vercel Hobby + Supabase). CORS is limited to sherwinwang.dev.
- **Tiles:** Spotify is an inline tile. MBTI (formerly MPTI) and Blackjack are additional Vite entries (`/mbti/`, with `/mpti/` redirecting, and `/blackjack/`), opened from tiles like Sketchbook.

## Phases

1. Spotify Last Played: done.
2. MPTI: done, later replaced by phase 5.
3. Blackjack Trainer: done (see BLACKJACK.md), awaiting review.
4. Blackjack RTS redesign (2026-11-02): pixel-art HUD, Recruit / Operator (Hi-Lo) / Grandmaster (Wong Halves), assistance removal at 100/150/200 exposed cards, flow meter and cosmetic rewards, endurance full-shoe mode, insurance; fixes Codex Blackjack findings 9-13. See BLACKJACK.md and BLACKJACK_REDESIGN.md. Awaiting review.
5. MBTI-inspired test (2026-11-03): free, client-side, two stages (spoken or typed questions, then six pixel-art video-call scenes with predefined lines and browser voices), deterministic evidence-based reading. Paid AI and TTS removed. See MBTI.md and MBTI_REVIEW_HANDOFF.md. Awaiting review.

Each phase ends with lint, typecheck, unit tests, Playwright and a production build, then a pause for Codex review.
