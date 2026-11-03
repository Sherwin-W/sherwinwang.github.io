# Codex review handoff: Blackjack RTS redesign

Branch `feature/mini-apps`, uncommitted working tree. Nothing committed, pushed or deployed. Review the working tree including untracked files; do not modify files, commit or install dependencies.

## Scope

Redesign of `/blackjack/` into an RTS-styled pixel skill game, on top of the existing engine. Spec: the owner's "Blackjack Trainer — RTS-Inspired Game Redesign" brief; resulting spec in `docs/mini-apps/BLACKJACK.md`, design proposal in `docs/mini-apps/BLACKJACK_REDESIGN.md`. It also addresses your earlier Blackjack findings 9–13.

## Files

New:
- `src/blackjack/engine/systems.ts` (+ `systems.test.ts`), `src/blackjack/engine/endurance.test.ts`
- `src/blackjack/game/`: `run.ts` (+ `run.test.ts`), `useRun.ts`, `RunScreen.tsx` (+ `RunScreen.test.tsx`), `Campaign.tsx`, `Battlefield.tsx`, `CountPanel.tsx`, `ResourcePanel.tsx`, `FlowMeter.tsx`, `Coins.tsx`, `StrategyDialog.tsx`, `RunReport.tsx`, `PixelCard.tsx`, `PixelIcon.tsx`, `pixelArt.ts`, `sound.ts`, `game.css`
- `docs/mini-apps/BLACKJACK_REDESIGN.md`, this file

Changed:
- `src/blackjack/engine/game.ts` (tally, insurance phase, endurance, `roundIsSafe`, `burn`, `shoeFinished`), `rules.ts` (`insurance`)
- `src/blackjack/engine/engine.test.ts`, `strategy.test.ts` (helpers default `insurance: false` so old fixtures keep their meaning)
- `src/blackjack/ui/Blackjack.tsx` (Campaign / Training / Manual), `PlayingCard.tsx` (pixel card + tag), `StrategyChart.tsx` (hard 17 row), `Learn.tsx` (text fixes), `blackjack.css`, `main.tsx` (no legacy `App.css`); drill components only had class renames
- `tests/blackjack.spec.js` (rewritten), `package.json` / lock (`@fontsource/silkscreen`, `@fontsource/pixelify-sans`, both OFL), `docs/mini-apps/BLACKJACK.md`, `PLAN.md`

Removed: `src/blackjack/ui/PlayTable.tsx`, `SessionSummary.tsx` (replaced by the campaign; they were untracked branch files).

## Please verify in particular

1. **Safe-round bound** (`game.ts` `ROUND_POINT_BOUND = 146`, `roundIsSafe`). Argument: per hand hard total ≤ 20 before its last draw, so ≤ 30 after; ≤ 4 hands; dealer ≤ 26. Is any path missed (split aces with re-split, doubling after split, a 21 that keeps drawing, dealer drawing when all player hands are dead)? The property test in `endurance.test.ts` plays random legal actions on 3,000 low-card shoes.
2. **Exposure counting**: every face-up card tallied exactly once; the hole card only on reveal, including the insurance phase and the peek; burned sprint cards counted; ace side count never added to Hi-Lo / Wong.
3. **Wong Halves**: tag table and the doubled-integer representation through the counter, parsing (`parseCount2`), checkpoint grading and the true-count calculator (`trueCountFor(rc2, remaining)`).
4. **Assistance removal**: thresholds use `cardsExposed` (not cards dealt); warnings once per tool; the counter/calculator never read the objective count (`CountPanel` uses the player's counter or typed value; `useRun.calc` only receives player numbers).
5. **Information leaks**: `publicView` has no count/tally/undealt cards; the objective count appears only after the player commits a checkpoint answer. Note that the safe-round check decides when rounds stop; I argue this uses only public information because all dealt cards are exposed at a bet.
6. **Grading policy**: decisions vs basic strategy only (no index plays); insurance graded as decline; true count graded from the player's own entered running count; wager graded at the objective count against the illustrative schedule. Is that a defensible separation?
7. **Insurance settlement**: `net` = hands + `insuranceNet`; even money when the player has a natural is treated as ordinary insurance.
8. **Keyboard and focus** (`RunScreen.tsx` handler): inert in inputs, while the dialog is open, and on the report (your finding 11); focus after a control disappears; `Enter` fallback.
9. **Mobile** (finding 10): cards at 2× with overlap at 4+ cards; the browser test checks every card's box at 390px after four hits with seed 57.
10. **StrictMode safety** in `useRun` (coins and bank use refs, no side effects inside state updaters).
11. **Licensing**: confirm no third-party art or audio is in the repo (the Fageltomten sprites were deliberately not used).

## Checks

```
npm run lint && npm run typecheck && npm test && npm run build && npm run test:browser
git checkout docs/playable-portfolio   # browser tests rewrite these evidence files
```

My last run: lint and typecheck clean; 197 Vitest tests plus the node playable suite pass; build ok; Playwright 52/53, the failure being the known iframe tab-order flake (your finding 15; it passes 3/3 in isolation). Handy manual repro: `/blackjack/?seed=57` replays the same shoe.

## Known limits / not done

- Your findings 1–8 and 14–16 (Spotify, MPTI, Vercel packaging, tab-order flake) are untouched by this work.
- No real-device mobile test; no screen-reader pass beyond role/label checks.
- Light theme verified on the briefing, HUD and Manual; not every screen in every theme.
