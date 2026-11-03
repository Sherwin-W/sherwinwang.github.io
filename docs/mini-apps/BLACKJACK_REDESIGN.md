# Blackjack Trainer: RTS redesign proposal

> Update (gameplay polish iteration): the flow meter is now a horizontal bar above the table, the strategy button is the Ask the Dealer NPC, assistance goes offline at 100/150, and golden cards were added. Current behavior is specified in [BLACKJACK.md](BLACKJACK.md); the wireframes below show the original proposal.

Status: design proposal, implemented on `feature/mini-apps` (uncommitted). The mission is execution quality: correct plays, an accurate count, correct true-count conversion and on-schedule practice wagers, while the help disappears. Money won is not the score.

## What is reused and what is not

| Part | Decision |
|---|---|
| Engine (`cards`, `hand`, `rules`, `strategy`, `shoe`, `count`, `rng`) | Reused. Extended, not rewritten. |
| `game.ts` | Extended: exposure tallies for every counting system, ace side count, insurance phase, endurance (full-shoe) mode, sprint reveal, and a provable "safe round" check that replaces the 30-card heuristic (fixes Codex finding 12). |
| Practice drills, Learn | Kept as "Training" and "Manual" tabs, restyled. Learn text fixed (Codex 13). Chart splits hard 17 from 18+ (Codex 9). |
| `PlayTable.tsx`, `SessionSummary.tsx` | Replaced by the campaign HUD (`src/blackjack/game/`). |
| Fageltomten "Classic Playing Cards" sprites | **Not used.** The license says "Do not redistribute"; committing PNGs to a public repo, or publishing them in the public `gh-pages` branch, is redistribution. Cards are drawn by our own code (`PixelCard.tsx`) as original pixel art. The renderer is the only place to change if the owner later supplies the sprites with written permission. |
| Other third-party art | None. Thumbs-up, coin, HUD frames and effects are original SVG pixel bitmaps; sounds are synthesized with Web Audio at runtime. |
| Fonts | Silkscreen (labels, numerals) and Pixelify Sans (body), both SIL OFL 1.1, self-hosted through `@fontsource`. |

## Palette

Night-ops command table. Dark is the primary look; a parchment "map table" light theme keeps the site toggle working.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--px-void` | `#0b0c16` | `#e9dfc4` | page |
| `--px-panel` | `#151827` | `#f7efd9` | HUD panels |
| `--px-panel-2` | `#1e2236` | `#efe3c2` | insets, inputs |
| `--px-line` | `#3b4170` | `#5b4a33` | 1px pixel borders |
| `--px-hi` | `#5d66a8` | `#8a7452` | bevel highlight |
| `--px-ink` | `#ece6cf` | `#231b12` | text |
| `--px-dim` | `#9b98b3` | `#6a5a44` | secondary text |
| `--px-field` | `#10261f` | `#cfe0c4` | battlefield |
| `--px-gold` | `#f2c14e` | `#9a6a00` | coins, flow, primary |
| `--px-cyan` | `#3ef0de` | `#007f78` | neon tier, focus |
| `--px-magenta` | `#ff4fa3` | `#b0186a` | neon tier accent |
| `--px-good` | `#6ee77a` | `#1f7a2c` | correct, +count |
| `--px-bad` | `#ff5a5a` | `#b3261e` | mistakes, −count |
| `--px-warn` | `#ffa445` | `#9a4b00` | assistance warnings |

Dealer cards are dark (navy face, pale ink); player cards are light (cream face, dark ink), so the two sides read at a glance without color alone (labels and positions also differ).

## Typography

- Silkscreen: HUD labels, counters, buttons, numbers. Uppercase, sized in whole pixels (12/16/24/32).
- Pixelify Sans: sentences (feedback, explanations, reports) at 16px or more for readability.
- Numbers use tabular figures where the font supports it; counts always carry a sign.

## Desktop wireframe (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◀ PORTFOLIO   BLACKJACK OPS   [OPERATOR · HI-LO]  RND 12  312▸184  ▐▌│ ← top HUD + vertical flow meter
├───────────────┬──────────────────────────────────────┬───────────────┤
│ COUNT COMMAND │  DEALER            ▒▒ ▒▒   17        │ INTEL         │
│ RC   +4       │                                      │ ACES 7/24     │
│ [−1]   [+1]   │  ─────────── shoe ▓▓▓▓▓░░░ ───────── │ side count ON │
│ TRUE COUNT    │                                      │ [?] STRATEGY  │
│ +4 ÷ 4.5 = +0 │  YOU   ░░ ░░  SOFT 18   BET 2        │ SURRENDER  ✓  │
│ SYSTEM HI-LO  │                                      │ INSURANCE  ✓  │
│ 2-6 +1 ...    │  [HIT H][STAND S][DOUBLE D][SPLIT P] │ H17 · 3:2 ... │
├───────────────┴──────────────────────────────────────┴───────────────┤
│ ▸ feedback / mistake explanation line                                │
└──────────────────────────────────────────────────────────────────────┘
```

## Mobile wireframe (< 820px)

```
┌────────────────────────────┐
│ ◀  OPERATOR  RND 12   ▐▌   │ compact HUD + small vertical flow meter
├────────────────────────────┤
│ DEALER  ▒▒ ▒▒  17          │ battlefield first, cards at 2× scale,
│ shoe ▓▓▓░░░ 184 left       │ long hands overlap instead of overflowing
│ YOU ░░ ░░ ░░  SOFT 18      │
│ [HIT][STAND][DBL][SPLIT]…  │ 48px targets, wrap to two rows
├────────────────────────────┤
│ ▾ COUNT  RC +4 [−1][+1]    │ collapsible drawers (details/summary)
│ ▸ INTEL  aces · rules · ?  │
└────────────────────────────┘
```

## HUD components

| Component | Role |
|---|---|
| `Campaign` | Briefing screen (difficulty select, rules), run lifecycle, report |
| `useRun` | Controller: the private `Game` in a ref, flow, run stats, assistance, checkpoints, coins |
| `TopHud` + `FlowMeter` | Difficulty, round, exposed cards, vertical flow meter, reward icons |
| `CountPanel` | Manual counter (system-specific steps), true-count calculator, system tags |
| `Battlefield` | Dealer (dark) and player (light) hands, action bar, wager, checkpoints, sprint |
| `ResourcePanel` | Ace tracking, strategy reference button, rule/insurance/surrender availability |
| `PixelCard` | Original pixel card renderer (SVG, `shape-rendering: crispEdges`) |
| `Coins` | Cosmetic coin drops, collectable by pointer, touch or the `C` key |
| `StrategyDialog` | Rule-matched basic-strategy chart in a modal `<dialog>` |
| `RunReport` | End-of-shoe report, grade, mistakes, suggested drills |

## Animation plan

| Event | Effect | Reduced motion |
|---|---|---|
| Deal / hit | card slides from the shoe (top right) and settles in 2 steps (`steps()` timing for a sprite feel), 140ms stagger | fade only |
| Hole card | 3-frame flip (scaleX 1 → 0 → 1) | instant swap |
| Stand | hand plate stamps a pixel border | none |
| Double | bet chip doubles with a short pop | none |
| Split | cards slide apart into two plates | none |
| Surrender | hand dims and drops 4px | dim only |
| Payout | `+N` / `−N` pixel numbers float up from the hand | static text |
| Flow 25% | thumbs-up pops (scale steps) | static icon |
| Flow 50% | neon pixel border fades in around the battlefield, slow hue shift | static border |
| Flow 75% | coins drop by the pointer on correct decisions | coins appear without the bounce |
| Mistake | 250ms shake + red edge pulse | no shake; with "reduce flashing" a static red outline for 600ms, no pulse |
| Shoe cleared | banner sweep + coin shower | banner only |

No animation blocks input; the engine resolves instantly and animation is presentation only.
