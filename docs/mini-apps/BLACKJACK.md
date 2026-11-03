# Blackjack Trainer ("Blackjack Ops")

Route `/blackjack/` (Vite entry `blackjack/index.html`), opened in a new tab from the home grid. Practice only: virtual units, no money, no accounts, no network calls. Design proposal, palette, wireframes and animation plan: [BLACKJACK_REDESIGN.md](BLACKJACK_REDESIGN.md).

## Display and mobile

- **Dark only.** `blackjack/index.html` pins `<html data-theme="dark">` with an inline dark background (no light flash, no theme script); `game.css` has no light palette. The rest of the site keeps its own theme system.
- **Full Screen** (top bar and in-run HUD; `game/useFullscreen.ts`, `game/ScreenControls.tsx`): requests element fullscreen on the whole app (standard or `webkit` API), then, on touch devices only, tries `screen.orientation.lock('landscape')`. State follows `fullscreenchange`/`webkitfullscreenchange`, so Esc and system gestures are picked up; orientation is unlocked on any exit; listeners are cleaned up; the run is never reset. Where element fullscreen does not exist (iPhone Safari allows it only for video) the button explains that honestly and suggests rotating or **Share → Add to Home Screen**: `public/blackjack/manifest.webmanifest` (`display: fullscreen`, `orientation: landscape`) and the `apple-mobile-web-app-*` metas make the home-screen launch bar-free. The UI is never rotated with CSS.
- **Rotate prompt**: phones in portrait (coarse pointer, ≤ 600px) see a dismissible "Rotate your phone for the best experience"; portrait stays fully playable.
- **Phone landscape** (`orientation: landscape` and height ≤ 520px): the table on the left with dealer and player side by side, flow bar and combo on one row, single-row action bar; Count and Intel panels in a right-hand column. At 844×390 and 667×375 the cards and action buttons are above the fold.
- Safe-area insets (`viewport-fit=cover`, `env(safe-area-inset-*)`) and `dvh` units; touch targets ≥ 44px.
- **Exit to Portfolio** (always visible; icon-only with the same accessible name in the compact in-run HUD): leaves fullscreen first, then navigates.

## Mission

An RTS-styled pixel skill game. The score is execution, not money:

1. correct basic-strategy decisions (and insurance),
2. an accurate running count,
3. correct running-to-true count conversion,
4. practice wagers that follow the training schedule,
5. all of the above while help is removed, until the whole shoe is cleared.

Hand outcomes never change the score or the flow meter.

## Tabs

| Tab | Content |
|---|---|
| Campaign (default) | Briefing (difficulty, options, table rules) → run on the RTS HUD → after-action report |
| Training | Strategy quiz, Hi-Lo counting drills (guided → color only → cards only → speed), true-count drills |
| Manual | Lessons, rule-matched strategy chart, Hi-Lo and Wong Halves, the wager rubric and its limits |

## Difficulties

| | Recruit | Operator | Grandmaster |
|---|---|---|---|
| Counting system | none | Hi-Lo | Wong Halves |
| Graded | decisions, insurance | + running count, true count, wagers, optional aces | same as Operator |
| Counter steps | – | ±1 | ±0.5, ±1, ±1.5 |
| Wager | fixed 1 unit | chosen before every deal | chosen before every deal |

Tags. Hi-Lo: 2–6 +1, 7–9 0, 10–A −1. Wong Halves: 2 +0.5; 3, 4, 6 +1; 5 +1.5; 7 +0.5; 8 0; 9 −0.5; 10–A −1. Both are stored doubled (`tag2`) so fractional counts are exact integers (`engine/systems.ts`). Both sum to 0 over a full shoe (tested).

Index plays (count-based deviations) are not scored. Every decision is graded against basic strategy for the table rules; a correct basic-strategy play is never marked wrong because a deviation might apply. Insurance is graded the same way (decline); the explanation notes that counters take it at high counts.

## Modes and run state

- One source of truth: `game/campaignState.ts` (a reducer). The briefing selection is persisted (`blackjack-difficulty-v1`), so visiting Training or Manual no longer silently resets it to Recruit (the likely cause of the "switch didn't take" bug). A run snapshots its difficulty at start; the HUD reads only that snapshot.
- The top HUD has a Recruit / Operator / Grandmaster switcher. Switching mid-run asks for confirmation (nothing played yet: immediate) and always starts a fresh run.
- Every start (Deploy, New shoe, mode switch, abandon + redeploy) gets a new run id; the run screen is keyed by it, so coins, flow, hint prices, golden-card history, assistance state, stats, exposed-card progress and the shoe all start over. Nothing run-specific is in localStorage.

## HUD

- Top: back link, difficulty, mode switcher, round, exposed cards / shoe size, coins (this run).
- Above the table: the horizontal flow bar (fills left to right, percentage shown, smooth eased fill) with its reward banner.
- Left, Count command (counting modes): the player's manual counter, the true-count calculator `RC ÷ decks = TC` computed from the **player's** counter, never the engine's count (both go offline together at 100), and the system's tag table.
- Center, Battlefield: dealer hand (dark cards), shoe bar, player hands (light cards), action bar / insurance / wager / checkpoint / sprint controls, feedback line.
- Right: **Ask the Dealer** (pixel NPC + button with the current price), then Intel: aces seen of `decks × 4` (counting modes), optional ace side count, and the table rules.
- Phone (< 820px): field first, cards at 2×, long hands overlap, Count and Intel become collapsible drawers; tablet (820–1099px): Intel moves under the field.

## Assistance removal (Operator, Grandmaster)

Measured in cards actually exposed to the player (`ShoeTally.exposed`: face-up cards; the hole card counts only once revealed).

| Exposed cards | Goes OFFLINE |
|---|---|
| 100 | manual counter **and** true-count calculator, together |
| 150 | ace tracker (and dealer advice becomes paid) |

Offline tools stay in the layout: blurred, dimmed, an OFFLINE badge, buttons disabled and the content `inert`; their keyboard shortcuts stop. A warning appears within 20 cards of each change, and a notice when it happens. Recruit shows no counting tools at all. The engine keeps the objective counts privately for grading; they are never in `publicView`.

## Checkpoints and grading

- A checkpoint comes due every 26 exposed cards (between rounds, before the wager), plus a final one before the last 8 cards of the sprint. Steps: running count (pre-filled from the counter while it exists), ace count if the side count is on, then true count.
- Running count: exact match with the objective count of the difficulty's system.
- True count: `trunc(player RC ÷ estimated decks)`, decks to the nearest half deck (min 0.5), truncated toward zero. Graded from the running count the player just entered, so one counting slip is not scored twice.
- Wager: the illustrative schedule (≤ +1 → 1, +2 → 2, +3 → 4, ≥ +4 → 6) at the objective true count before the deal. A training rubric, not betting advice and not a claim of optimality.

## Flow and rewards (`game/run.ts`)

| Event | Right | Wrong |
|---|---:|---:|
| Strategy decision | +6 | −14 |
| Running count | +10 | −16 |
| True count | +6 | −10 |
| Wager | +4 | −8 |
| Insurance | +4 | −10 |
| Ace count | +4 | −6 |

Clamped to 0–100. A correct decision made after seeing the dealer's advice for that decision does not raise flow (mistakes still lower it). Reduced motion: the circuit appears lit without traveling light, the fire shows one still frame, nothing shakes, and the 100% banner only fades.

- 25%: pixel thumbs-up with a pop, beside the bar.
- 50%: thumbs-up stays; the Tron power-up plays once on the way up (`TronBorder.tsx`): a spark at the bottom center, cyan and magenta light streams run along the bottom, up both sides and across the top, meet at the top center, a short pulse, then the circuit stays softly lit while flow is ≥ 50%. Crossing 50% again later replays it. The combo meter unlocks (below).
- 75%+: **IN THE FLOW!** in rainbow pixel type with a moving holographic highlight, the bar turns into a flowing rainbow with a sweeping shine, and two dancing pixel cats (original two-frame sprite with a bounce) flank the text. All of it disappears as soon as flow drops below 75. Each further correct decision drops a coin.

- 100% (first time in a run only): the circuit replays in rainbow light, a brief "Perfect flow!" banner appears over the table edge (non-blocking), the rail stays iridescent and the multiplier turns rainbow while flow stays at 100%. Dropping below 100% returns to the normal styling; reaching 100% again restores the rainbow without replaying the sequence. A new run resets it.

## Combo multiplier (`ComboMeter.tsx`, `stepCombo` in `run.ts`)

- A fighting-game style streak of consecutive correct **play decisions** (hit, stand, double, split, surrender, insurance). Count checks and wagers move flow but neither build nor break the combo, so e.g. 85% flow with 12× is possible. Hand wins and losses never touch it.
- Locked below 50% flow ("Multiplier unlocks at 50% flow"; the row keeps its height so nothing jumps). The play decision that lifts flow to 50%+ is 1×; earlier decisions never count. Each further correct play adds 1, with no cap. A wrong play resets it to 0 (the fire is extinguished with a short pixel animation; the existing mistake feedback still plays). Falling below 50% resets and hides it. A correct play made with dealer advice leaves it unchanged. A new run starts at 0.
- Layout: one centered group, MULTIPLIER · number · fire, vertically centered with equal gaps. The number uses the game's own 5×7 bitmap digits (`DIGITS` in `pixelArt.ts`, `PixelNumber.tsx`: uniform width, an open 4, a real × glyph), gold with a dark pixel outline, rainbow at 100%.
- Fire (original 4-frame pixel flame, frames shown in an irregular order for a natural flicker): 1× small, 2× livelier, 3× an ember, 4× bigger, 5×–9× full size with several embers, 10×+ COMBO OVERDRIVE: the fire and the number tremble (only them, not the table) and sparks fly. The number pops on every increase.
- Only decisions the player is looking at are graded: an action is ignored if it does not answer the decision currently on screen, so duplicate key events in the same tick, repeated callbacks, animation ends and opening menus cannot add steps.

Coins pop out with a pixel starburst near the pointer (or the action bar for keyboard play) and stay until collected: click, tap, mouse hover, the `C` key or the Collect button. A coin is removed before it is banked, so it cannot count twice. Coins are cosmetic, per run, never money, and have no effect on rules or wagers.

## Ask the Dealer

- The advice is `decide()` for the table rules, from the active hand and the dealer's upcard only (no hidden card), plus `explain()`; insurance advice is "decline". The dealer's line of dialogue is flavor; the play shown is always the basic-strategy play.
- Before 150 exposed cards (and all shoe in Recruit) it is free: "Tell me (free)". From 150 in Operator/Grandmaster each new hint costs 1, then 2, 3, 4 … coins (`revealHint` in `run.ts`). The price is on the button and in the dialog.
- Coins are deducted only when new advice is revealed, never for opening/closing, never twice for the same decision (keyed by round, hand, card count), never below zero; with too few coins the button is disabled with an explanation. Free and paid hints, coins spent and advised decisions appear in the report.
- Advised decisions are still graded, but raise no flow and pay no coins. After 150 the full chart comes with paid advice; before that it is free.

## Golden cards

- When each shoe is built, 25–50 distinct physical cards (six decks; scaled by deck count) are marked golden, chosen from a separate seeded stream (`shoe.ts`), so the shuffle and every outcome are identical with or without them, and the same seed gives the same golden cards. They are never rerolled.
- Golden cards keep their normal art and add a gold edge, warm tint, a highlight sweeping across the face, sparkles and a glow. The flag travels with the card, and `publicView` hides the hole card entirely, so a face-down card never shows (or leaks) golden status.
- Reward rule (`settleGolden`): each golden card is settled once, at the first strategy decision it takes part in (the active hand's cards and the dealer's upcard; insurance counts). A correct, unadvised decision pays one bonus coin per newly settled golden card, at any flow; a wrong or advised decision settles it with no coin. Hitting, splitting, reopening dialogs or later decisions never pay that card again.
- Golden status changes no values, tags, counts or true counts. Mistakes: 300ms shake and red edge pulse plus an explanation; with reduced motion or "Reduce flashing" a static red outline for 600ms instead.

## Endurance shoe

Campaign shoes are dealt to the last card with no cut card and no reshuffle (labeled in the UI as an endurance format that real casinos do not use). A round starts only if it is guaranteed to finish:

- One round uses at most `4 × 30 + 26 = 146` hard points (ace = 1): a player hand only draws below 21, so it ends at ≤ 30; up to 4 hands; the dealer draws only below 17 (or on soft 17, hard 7), so ≤ 26.
- If the remaining cards hold more than 146 points the round cannot run the shoe dry (`roundIsSafe`). At a bet every dealt card is exposed, so this depends only on public information.
- Otherwise rounds stop and the remaining cards (typically ~20) are revealed four at a time in the sprint, then the report appears.

Casino-style shoes (Training/engine API) use the same check and reshuffle instead, which fixes the mid-round exhaustion Codex found (finding 12).

## Insurance

Rule `insurance` (default on). On an ace upcard the round enters `insurance` before the peek; taking it stakes half the bet, paid 2:1 on a dealer blackjack. Settlement `net` includes `insuranceNet`. The hole card stays hidden and uncounted during the decision.

## Keyboard

`H S D P R` actions, `N` / `I` decline / take insurance, `=` `-` counter ±1, `]` `[` ±0.5 (Wong Halves; only while the counter is online), `C` collect coins, `?` Ask the Dealer, `Esc` closes it (focus returns), `Enter` triggers the focused or main button. Shortcuts are off while typing in a field, while the dialog is open and on the report.

## Art and licensing

- Cards, thumbs-up, coin, frames, the dancing cat and the dealer NPC are original pixel bitmaps drawn in code (`game/pixelArt.ts`, `PixelCard.tsx`, `PixelSprite.tsx`), rendered as SVG with `shape-rendering: crispEdges` at whole-number scales. The suggested Luiz Melo "Pet Cat Pack" is CC0 and would have been fine to use; an original cat was drawn instead so no third-party files need to be downloaded or tracked.
- The Fageltomten "Classic Playing Cards" pack was evaluated and **not used**: its license says "Do not redistribute", and this repo and its `gh-pages` branch are public. Using it would need the owner to buy it and get the author's written permission for a public repository.
- Fonts: Silkscreen (HUD, and digits everywhere because Pixelify Sans draws 5 like S) and Pixelify Sans (body), both SIL OFL 1.1 via `@fontsource`.
- Sound: optional, off by default, synthesized at runtime with Web Audio (`game/sound.ts`); no audio files.

## Engine (`src/blackjack/engine/`)

| File | Role |
|---|---|
| `cards.ts`, `hand.ts` | cards, soft/hard totals, naturals |
| `systems.ts` | Hi-Lo and Wong Halves (doubled tags), formatting and parsing of half counts |
| `rng.ts`, `shoe.ts` | seeded mulberry32, Fisher-Yates, finite shoe |
| `rules.ts` | 4/6/8 decks, H17/S17, 3:2 or 6:5, doubling, DAS, late surrender, re-split aces, insurance, penetration |
| `strategy.ts` | multi-deck basic strategy with legality fallbacks (D, Ds, Rh, Rs, Rp) |
| `game.ts` | state machine with `ShoeTally` (exposed, Hi-Lo, Wong ×2, aces), insurance, endurance mode, `roundIsSafe`, `burn`, `publicView` |
| `count.ts`, `drills.ts`, `stats.ts` | true count convention, schedule, drill generation, lifetime progress |

`src/blackjack/game/` holds the campaign: `run.ts` (pure rules: difficulties, thresholds, grading, flow, report), `useRun.ts` (controller; the full `Game` lives in a ref), and the HUD components.

## Storage

`blackjack-progress-v1` (lifetime drill/strategy stats), `blackjack-rules-v1`, `blackjack-settings-v1` (sound, motion, flashing, ace side count), `blackjack-campaign-v1` (best grade per difficulty), `blackjack-difficulty-v1` (briefing selection). In Recruit the ace side-count option is greyed out and disabled ("Available in advanced modes"), which is separate from the in-run OFFLINE state. Coins are not stored: they belong to the run. All local, all resettable by clearing site data; progress has a reset button.

## Verification

- Unit: `systems.test.ts` (both tag tables, balance, half-count parsing), `endurance.test.ts` (exposure exactly once incl. hole-card timing, ace side count separate from Hi-Lo, 400-round tally invariants, insurance payouts and phase, the 146-point bound, a 3,000-trial random-play property test on low-card shoes, full 4/6/8-deck shoes to zero with final counts 0 and all aces seen, Codex 12 fixture), `run.test.ts` (thresholds, warnings, checkpoints, true-count and wager grading, flow tiers, coins, scoring), `RunScreen.test.tsx` (keyboard gating, dialog, insurance keys, counters per system, reduced motion, hard-17 chart row), plus the existing engine, strategy and simulation suites.
- Progression (`game/run.test.ts`, `game/campaignState.test.ts`, `game/Progression.test.tsx`): 100/150 thresholds and warnings, the hint ledger (free, 1/2/3/4, insufficient, never twice), the golden rule, every mode transition, first-click selection, selection surviving a tab visit, new run resetting coins/flow/prices, golden coins paid once, OFFLINE panels present but inert, IN THE FLOW appearing at 75 and clearing below it; `endurance.test.ts` adds golden selection (25–50 distinct, seeded, shuffle unchanged, hole card hidden, counts unchanged).
- Browser (`tests/blackjack.spec.js`): briefing, recruit keyboard play and chart dialog, Operator checkpoint graded against the Hi-Lo of every card read from the screen, a full Operator shoe (warnings and OFFLINE panels at 100/150, dealer price after 150, sprint, 312/312 exposed, report keys inert), flow rewards at 25/50/75 including IN THE FLOW on desktop and phone, coin collection with real basic-strategy play, mode switching (first click, tab round-trip, mid-run fresh start), golden cards only face up and free dealer advice matching `decide()`, reduced-motion statics, mistake feedback with reduced flashing, Wong Halves counter, phone layout (every card on screen, drawers, no overflow), reduced motion, Training and Manual tabs.

## Limits

- Strategy charts are multi-deck (4–8) with a peeking dealer; no single/double deck, no ENHC, no composition-dependent play, no index plays.
- The full-shoe endurance format is a training device; it is not how casinos deal.
- Deck estimation is shown by the shoe bar and the "N left" text; it is not a separate graded skill in the campaign (it is in the Training true-count drill).
