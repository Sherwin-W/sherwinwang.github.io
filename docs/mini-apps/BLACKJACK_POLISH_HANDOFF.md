# Codex review handoff: Blackjack gameplay polish & progression

Branch `feature/mini-apps`, uncommitted working tree (nothing committed, pushed or deployed). Review the working tree including untracked files; do not modify files, commit or install dependencies. Previous handoff for the RTS redesign: `BLACKJACK_REVIEW_HANDOFF.md`. Current spec: `BLACKJACK.md`.

## What changed

1. **Difficulty switching.** `game/campaignState.ts` reducer is the single source of truth; the selection is persisted; a run snapshots its difficulty; run ids are monotonic; an in-run mode switcher (confirm when the run has started) starts a fresh run. Root cause found: the selection lived in `Campaign` component state, so visiting Training/Manual and returning reset it to Recruit; the run also read the live selection instead of a snapshot.
2. **Per-run isolation.** Coins are no longer persisted (`blackjack-coins-v1` removed). Everything run-specific lives in `useRun`, remounted per run id.
3. **Flow bar** (`FlowBar.tsx`): horizontal, above the table, % shown; 25 thumbs-up, 50 neon (unchanged), 75+ "IN THE FLOW!" rainbow text, rainbow bar, two dancing cats (original sprites).
4. **Assistance thresholds**: counter + calculator at 100, aces at 150 (`run.ts`). Offline tools stay visible but blurred/dimmed/inert (`Offline.tsx`).
5. **Ask the Dealer** (`DealerCard.tsx`, `DealerDialog.tsx`): advice from `decide()`/`explain()`; free before 150 (and always in Recruit); then 1, 2, 3… coins via the pure `revealHint` ledger.
6. **Golden cards**: `engine/shoe.ts` marks 25–50 (six decks) cards with `gold` from a separate seeded stream; `PixelCard` renders the overlay; `settleGolden` pays one coin per card at its first decision if correct and unadvised.
7. Coins never expire now, pop with a starburst, and are collected once.

## Files

New: `game/campaignState.ts` (+ test), `game/FlowBar.tsx`, `game/Offline.tsx`, `game/DealerCard.tsx`, `game/DealerDialog.tsx`, `game/PixelSprite.tsx`, `game/Progression.test.tsx`, this file.
Removed: `game/FlowMeter.tsx`, `game/StrategyDialog.tsx`.
Changed: `engine/cards.ts` (`gold?`), `engine/shoe.ts`, `engine/endurance.test.ts`, `game/run.ts` (+ test), `game/useRun.ts`, `game/RunScreen.tsx`, `game/Campaign.tsx`, `game/CountPanel.tsx`, `game/ResourcePanel.tsx`, `game/PixelCard.tsx`, `game/Coins.tsx`, `game/RunReport.tsx`, `game/pixelArt.ts`, `game/game.css`, `game/RunScreen.test.tsx`, `tests/blackjack.spec.js`, `docs/mini-apps/BLACKJACK.md`, `BLACKJACK_REDESIGN.md`.

## Please verify in particular

1. **Hidden information.** Golden status rides on the card object; confirm nothing renders or serializes the hole card (or its `gold`) before reveal: `publicView` nulls it; `PixelCard` with `null` draws a plain back. Advice uses `g.dealer[0]` only.
2. **Shuffle unchanged.** `markGolden` uses `deriveSeed(seed ^ 0x601d, shuffles + 7919)`, independent of the shuffle stream; the test compares against a plain Fisher–Yates. Could the copied card objects (`{ ...card, gold }`) break any identity-based logic?
3. **Coin integrity.** `takeCoins` removes before banking; `revealHint` is applied to refs synchronously. Try double clicks, `C` spam, pointer-enter + click, StrictMode double invocation.
4. **Hint charging.** Decision key `p:${round}:${active}:${cards}:${hands}` / `i:${round}`. Is any distinct decision mapped to the same key (so a second decision would get free advice), or one decision to two keys (double charge)?
5. **Golden rule.** First decision settles each golden card; dealer upcard participates in every decision of its round, so it settles at the round's first decision. Insurance counts as a decision. Advised decisions settle without paying.
6. **Assisted decisions** do not raise flow or drop coins but are still graded. Is that a sensible anti-farming rule given free advice before 150?
7. **Mode switching.** All six transitions, the confirm/cancel path, and that nothing from the previous run (counter, coins, flow, notices, warnings, golden history) leaks.
8. **Offline panels**: `inert` set via effect; buttons also `disabled`; keyboard counter keys gated by `assist.counter`. Check screen-reader exposure.
9. **Reduced motion**: rainbow, shine, cats, dealer bob, gold shimmer and coin burst become static (both the OS setting and the in-game option).
10. **Mobile**: flow banner and bar at 390px, dealer card placement, Collect button overlapping content.

## Checks

```
npm run lint && npm run typecheck && npm test && npm run build && npm run test:browser
git checkout docs/playable-portfolio   # browser tests rewrite these evidence files
```

Last run: lint and typecheck clean; 222 Vitest tests + the node playable suite pass; build ok; Playwright 55/56 plus the 2 viewport variants of the flow test; the single failure is the known home-page iframe tab-order flake (your finding 15), unrelated. `/blackjack/?seed=57` replays a shoe.

## Not done / limits

- The exact reported click sequence for the switching bug was not reproduced; the stale-state cause above was found and fixed, and all transitions are tested.
- Recruit's dealer is free all shoe (it is the basic-strategy school); paid advice applies to Operator/Grandmaster. This is a judgment call, documented.
- Golden-card count for 4 and 8 decks is scaled (17–33, 33–67); only the six-deck range was specified.
- No real-device or screen-reader pass.
