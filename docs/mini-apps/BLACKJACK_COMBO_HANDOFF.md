# Codex review handoff: combo multiplier, Tron power-up, 100% easter egg

Branch `feature/mini-apps`, uncommitted working tree (nothing committed, pushed or deployed). Review the working tree including untracked files; do not modify files, commit or install dependencies. Spec: `BLACKJACK.md` (Flow and rewards, Combo multiplier). Earlier handoffs: `BLACKJACK_REVIEW_HANDOFF.md`, `BLACKJACK_POLISH_HANDOFF.md`.

## Changes

1. Spelling: "practise/practising/Memorise/favoured/centre" → American in `ui/Learn.tsx`, `engine/stats.ts`, `engine/drills.ts`, `game/Battlefield.tsx`. (`docs/mini-apps/SETUP.md` "Behaviour notes" is the Spotify doc and was left alone.)
2. "Neon online" removed. Combo multiplier: pure `stepCombo`, `fireStage`, `milestoneFor`, `isPlayDecision` in `game/run.ts`; state in `useRun.ts` (`comboRef`, `combo`, `comboBroken`, `milestone`, `reached100`); UI `game/ComboMeter.tsx` with `PixelFire` (frames in `pixelArt.ts`).
3. Tron border: `game/TronBorder.tsx`, an SVG measured to the table in real pixels (dash animation with `pathLength=1`, equal-length halves meet at top center). Remounted by `key` on a milestone; persistent rail while flow ≥ 50%; rainbow replay on the first 100% of a run; iridescent rail (`is-max`) while at 100%.
4. Duplicate-callback guard: `act` ignores an action whose decision key differs from the decision currently rendered (`decisionKey(view)`), and `deal`/`insure`/`next`/`reveal` also check the engine phase in the ref.
5. CSS in `game/game.css` (old box-shadow neon animation removed); reduced-motion fallbacks for every new effect.

## Files

New: `game/ComboMeter.tsx`, `game/TronBorder.tsx`, `game/combo.test.ts`, `ui/Learn.test.tsx`, this file.
Changed: `game/run.ts`, `game/useRun.ts`, `game/RunScreen.tsx`, `game/FlowBar.tsx`, `game/pixelArt.ts`, `game/game.css`, `game/Battlefield.tsx`, `game/Progression.test.tsx`, `ui/Learn.tsx`, `engine/stats.ts`, `engine/drills.ts`, `tests/blackjack.spec.js`, `docs/mini-apps/BLACKJACK.md`.

## Please verify

1. **Combo semantics**: only play decisions (incl. insurance) step it; count/wager events only affect flow (and the < 50% reset). The unlocking play is 1×. Is this the right reading of "consecutive correct decisions" given the example "85% flow with 12×"?
2. **Exactly-once**: the `decisionKey(view)` guard relies on `view` being the last rendered state while the window keydown listener is re-registered every render. Try rapid double clicks, key repeat (holding H), and `act()`-batched duplicate events. Could the guard ever block a legitimate first action (e.g. after a split, when the active hand changes)?
3. **Milestones**: 'power' on every upward crossing of 50; 'rainbow' only on the first 100 of a run (`reached100` ref). `TronBorder` is keyed by milestone id; confirm it is not remounted by ordinary decisions or by flow changes between 50 and 99.
4. **State after a rainbow milestone**: the trail is rainbow only on the mount that played it; the rail follows `max` (flow ≥ 100). The "Perfect flow!" banner stays in the DOM (faded out) until the next milestone; check it never blocks input (pointer-events none) and isn't re-announced.
5. **Performance**: animations use opacity/transform/stroke-dashoffset/filter (hue-rotate on the SVG at 100%). Check paint cost with the fire (4 stacked SVGs), embers, cats and rainbow running together, especially on mobile.
6. **Reduced motion** (OS and in-game): rail lit with no traveling light, fire on a still frame, no shake/embers, banner fade only.
7. **Layout stability**: the combo row is fixed-height (52px desktop, 46px phone); the banner row above the bar likewise. Check 320–390px widths.
8. **Regression**: coins, golden cards, dealer pricing, counting, assistance thresholds and engine behavior unchanged.

## Checks

```
npm run lint && npm run typecheck && npm test && npm run build && npm run test:browser
git checkout docs/playable-portfolio   # browser tests rewrite these evidence files
```

Last run: lint and typecheck clean; 237 Vitest tests (+2 new spelling tests since) and the node playable suite pass; build ok; Playwright 59/60, the failure being the known home-page iframe tab-order flake (finding 15), unrelated. Screenshots of the Tron sequence (120/450/800/1300 ms), fire stages, overdrive, 100% rainbow and the extinguish state at desktop and phone are produced by `tests/blackjack.spec.js` under `test-results/`.

## Limits

- Overdrive and the 100% state usually coincide in strategy-only play (each correct play adds 6% flow), but count/wager misses can now separate them.
- The fire is original art; no third-party sprites were added.
- No real-device or screen-reader pass.
