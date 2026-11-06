# DESIGN.md

Format follows the DESIGN.md convention from [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md). Tone reference: Apple (restraint, one type family, white space). Visual references supplied by the owner, kept in `docs/glass-bento/references/` and compared in `docs/glass-bento/VISUAL_COMPARISON.md`:

- `reference-bento.png`: composition only (asymmetric tile sizes, media-led tiles, compact identity column, varied density).
- `reference-coffee.png`: materials only (floating glass panels, soft shadows, translucency over one restrained color field).

Do not reuse either reference's branding, text, or imagery. The owner's direction overrides generic defaults in installed skills (for example the skill rule against gradient or UI-mock visuals): a clearly labeled illustration is allowed, fabricated data is not.

Design read: portfolio for recruiters and engineers, calm and less dense than the bento reference. Dials: DESIGN_VARIANCE 7, MOTION_INTENSITY 5, VISUAL_DENSITY 3.

## 1. Atmosphere

A dark-first field with one soft blue color wash behind a few floating glass surfaces. Hierarchy comes from tile size and imagery, not from labels or chrome. Calm: nothing moves on its own; motion explains state. Light mode is a pale mirror of the same system.

Honest labeling: the glass is a CSS approximation (`backdrop-filter`, hairline edge, highlight, soft shadow), not Apple's Liquid Glass.

## 2. Color

One accent family (azure). Tokens on `.home-page`; light overrides under `prefers-color-scheme: light`.

| Token | Dark | Light | Role |
|---|---|---|---|
| `--bg` | `#0b0d12` | `#e3e7ef` | Page |
| `--bg-glow` | `rgba(94,140,255,.14)` | `rgba(94,140,255,.16)` | Page glows behind grid |
| `--surface` | `#12151d` | `#fbfcfe` | Calm tiles (no blur) |
| `--glass` | `rgba(255,255,255,.07)` | `rgba(255,255,255,.55)` | Glass panels |
| `--glass-strong` | `rgba(255,255,255,.12)` | `rgba(255,255,255,.8)` | Hover, expanded |
| `--edge` | `rgba(255,255,255,.12)` | `rgba(15,25,50,.16)` | 1px border |
| `--edge-top` | `rgba(255,255,255,.24)` | `rgba(255,255,255,.9)` | Inner top highlight |
| `--text` | `#eceef3` | `#12151c` | Primary |
| `--text-dim` | `#a2a9b8` | `#4a5263` | Secondary, 4.5:1+ on its surface |
| `--accent` | `#6f9bff` | `#2f5fe0` | Links, focus, primary button |
| `--accent-ink` | `#0b0d12` | `#ffffff` | Text on accent |
| `--wash` | `linear-gradient(135deg,#1b2f6b,#2f55c8 45%,#6f9bff 85%,#a9c8ff)` | `linear-gradient(135deg,#7ea4ff,#9fc0ff 50%,#cfe0ff)` | Quest Board backdrop only; saturation kept below 80% |
| `--paper` | `#f4efe4` | same | Sketchbook stage only (the project's own palette) |

No pure black or white, no purple, no neon, no gradient text.

## 3. Typography

Geist variable (self-hosted) with `-apple-system, "SF Pro Text", system-ui` fallback.

| Use | Size | Weight | Tracking |
|---|---|---|---|
| Quest Board title | `clamp(1.75rem, 3vw, 2.5rem)` | 600 | -0.02em |
| Name (identity) | `clamp(1.75rem, 2.4vw, 2.25rem)` | 600 | -0.025em |
| Tile title | 1.125rem | 600 | -0.01em |
| Body | 0.9375rem / 1.55, max 52ch in tiles | 400 | 0 |
| Tag | 0.75rem | 500 | 0.01em |

The name is smaller than before: identity is compact, and the Quest Board is the loudest type on the page. `text-wrap: balance` on titles, `pretty` on body. No em-dashes, no uppercase eyebrows.

## 4. Layout

Homepage redesign (2026-11-05, owner brief). Two sections, each with a small uppercase label: **PROFESSIONAL**, then **AFTER HOURS**. The owner asked for these labels and for the rank rail's labels, so they override the "no uppercase eyebrows" rule below for those places only. Content max 1200px, `gap: 16px`.

```
Professional (>= 1024px): 10 flexible columns + one fixed 216px rail
  r1:  Identity (c1-4) | Who am I? (c5-10)      | Road to
  r2:  Résumé (c1-6)   | QuestBoard (c7-10)     | Diamond (r1-2)
After Hours (12 columns)
  r1:  Spotify, full width, horizontal player
  r2:  Sketchbook (4) | MBTI-Inspired Test (4) | Blackjack Trainer (4), equal height (min 304px)
```

- **Identity:** name, one-line summary, city (from `src/data/profile.ts`, shown as typed; nothing tracks location), and three 44px icon links (email, GitHub, LinkedIn). The interest chips were removed.
- **Who am I?:** the owner's text, unedited. The last line, "Current side quest: Diamond.", is set apart by a hairline, and on desktop a faint line runs from it toward the rail.
- **Road to Diamond:** a dark rail in both themes with a luminous track filling upward from Iron to Diamond IV, Riot's emblems, and the current rank and LP beside the marker. Below 1024px it becomes a horizontal bar after the "Who am I?" card. See `docs/mini-apps/LEAGUE.md`.
- **Résumé:** a small document sheet (paper surface, dog-ear, section rules) showing education, experience and skills from `src/data/resume.ts`. The card and its "Learn more" button open the PDF viewer (native `<dialog>`). See `docs/RESUME.md`.
- **QuestBoard:** a standard project card with the labelled illustration scaled down.
- **After Hours art band:** art areas are a fixed height (120px; Sketchbook stage 144px because that tile has no padding), so all three titles sit on one line. Sketchbook stays cream and Blackjack is felt green in both themes. MBTI is unchanged.
- **Removed from the homepage:** Privacy Preserving Visualization Tool, HTML Transformer, Flutter Event Planning App. Their data (`section` unset) and illustration code are kept.

Tablet (640-1023px): one column, except MBTI and Blackjack side by side. Mobile (< 640px): one column in reading order (identity, about, rank bar, résumé, QuestBoard, Spotify, apps). Spotify reserves its loaded height so nothing below it shifts.

**Adding a project** stays a data-only change in `src/data/projects.js`; set `section: 'professional' | 'after-hours'` to place it. Fields: `id`, `title`, `summary`, `tags`, `section`, `size` (`feature | wide | standard | compact`), `area` (optional named placement for the desktop layout; unnamed tiles flow automatically), `accent`, `links`, `details`, and optional media: `image: { src, alt }` for a real screenshot, or `visual: '<key>'` to use a registered illustration component. A tile with neither renders as a clean text tile. Real screenshots go in `public/projects/` and must contain no private data.

## 5. Media and honesty rules

- **Quest Board:** the app is behind a login, so there is no public screenshot. Use a labeled illustration: floating glass panels (generic placeholders for the three areas the owner described: applications, practice, interview prep) over the blue wash. Panels contain skeleton lines and shapes only. No numbers, percentages, names, streaks, or company names. A small visible caption reads "Illustration". When the owner supplies a sanitized screenshot, set `image` and the illustration is not rendered.
- **Sketchbook:** compose original `public/objects/*.svg` artwork (active catalog only) with a dashed brush-stroke line on a plain `--paper` stage. Do not tile `public/paper-fibers.svg` on the stage: its fiber strands rendered as stray tick marks (diagnosed with layer toggling). It represents the real feature (sketch becomes object); it is not a screenshot and is not labeled as one.
- **Privacy diagram:** abstract points, a noise band, and a smoothed outline. Labeled "Illustration". Makes no claim about results.
- No stock imagery, no fake screenshots of other projects, no invented metrics.

## 6. Materials and depth

Glass is selective: at most four `backdrop-filter` elements on screen at once (the Identity tile and the three small floating panels in Quest Board). All other tiles use `--surface` with the hairline edge and soft shadow. Three levels: page (flat plus two soft glows), tile (`0 10px 32px` tinted shadow), floating glass panel (`0 18px 50px`, 1px `--edge`, inset `--edge-top`). Radius lock: tiles 28px, glass panels inside media 18px, buttons and chips pill. Blur 20px, `saturate(140%)`. Light mode separates tiles from the page with a darker cool page color, near-white tiles, a stronger hairline, and a two-layer tinted shadow (`0 1px 2px` plus `0 12px 32px`). Reduced transparency: honored without needing an OS change to look good. Under `prefers-reduced-transparency: reduce` and `@supports not (backdrop-filter)`, no element relies on background alpha: glass tokens, edges, floating panels, skeleton bars, captions, and hover fills are overridden with opaque solid colors that keep the layered look through solid borders and shadows. Page glows are atmosphere, not transparency, and stay.

## 7. Motion and interaction

Full behavior and the navigate/expand map are in `docs/glass-bento/INTERACTIONS.md` (authoritative for task 2). Summary: interactive tiles lift about 3px and scale about 1.015 on hover with a restrained spring, one soft shimmer per hover, compress to about 0.985 on press then settle; keyboard focus gets the same lift plus the accent ring. Quest Board and Sketchbook are native new-tab links with a visible arrow icon; Privacy, HTML Transformer, and Flutter expand into a panel using shared-element `layoutId` (Escape, focus return, scroll lock). Entry: fade and rise 12px, 40ms stagger, once. No autonomous loops. `useReducedMotion` removes scale, lift, shimmer, and layout animation (panel fades only). Under reduced transparency the shimmer and scrim are disabled or opaque.
## 8. Accessibility and responsive

`min-height: 100dvh`. Touch targets 44px. One `h1` (identity). Static tiles are not interactive; each interactive tile has exactly one click target. Media is decorative (`aria-hidden`, empty `alt`) unless it is a real screenshot with meaningful `alt`. AA contrast in both themes, test desktop 1440x900, tablet 820, mobile 390.

## 9. Do and don't

Do: let imagery and tile size carry hierarchy; keep copy short; keep one accent.
Don't: invent achievements, metrics, user counts, or Quest Board capabilities beyond the owner's description; show private data; copy reference branding or imagery; stack glass on glass; add status dots, version stamps, uppercase eyebrows, or em-dashes; touch the recognizer, model, or worker code.

Prompt shorthand: "Asymmetric 7-tile bento per DESIGN.md: dominant Quest Board media tile on a blue wash with floating glass panels, compact identity, paper-stage Sketchbook, diagram for Privacy, two small text tiles, interests chips; glass only over color; one azure accent."
