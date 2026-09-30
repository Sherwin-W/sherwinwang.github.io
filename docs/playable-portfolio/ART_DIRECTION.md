# Art direction: "Desk Sketchbook"

One idea: an open sketchbook on a desk. Played objects are paper cutouts laid on it; portfolio content is calm, printed and always reachable.

## 1. Composition and hierarchy

**Desktop (>=900px).** Full-viewport paper, no visible card edge. Hierarchy, in order:
1. Title block, left-aligned at roughly 12% from the left, vertically 30% from top: "Hello, I'm Sherwin" (display), one line of role copy beneath (body, only text already in the repo), then one hint line in handwriting: "click anywhere to name something". The hint fades after the first spawn and never returns that session.
2. Open canvas, the rest of the page. Keep it mostly empty.
3. Bottom-center dock (one row): **Projects · About · Contact · Resume** as text buttons, then a divider, then **Type / Draw** toggle. Portfolio links are plain text labels, never icon-only.
4. Trash bottom-right, 72px.
5. Drawing tools appear only in Draw mode, in a strip above the dock.

**Mobile (<600px).** Title block top-left, 24px gutters, display size 2.25rem. Dock becomes two rows: row 1 portfolio links (wrap allowed, 44px min targets), row 2 Type/Draw toggle plus trash at the right. Canvas fills between. Replace the hamburger on Home with the dock. On touch, the word input pins above the keyboard but the object still spawns at the tap point.

## 2. Paper, palette, type, shadow, spacing

**Paper** `#f4efe4`. Texture: one tiling 256px SVG/PNG noise-fiber layer at 6-8% opacity plus a very soft vignette (`radial-gradient` to `rgba(120,100,70,0.06)` at edges). Static, `pointer-events:none`.

**Tokens**
- `--paper #f4efe4`, `--paper-raised #fbf8f1` (sheets, input)
- `--graphite #2b2a28` text, `--graphite-soft #6b675f` secondary (4.5:1 on paper)
- `--line #3a3631` object outline
- Accents (objects only, desaturated): `--clay #d9785c`, `--moss #7fa37a`, `--sky #8db4c9`, `--butter #e8c768`, `--plum #a98ab0`
- `--focus #1f5fbf`, 3px outline, 3px offset

**Type.** Body and headings: `Georgia, serif` (already in use; no new font payload). UI labels: `system-ui` 600, 0.95rem. Handwriting (`"Caveat", cursive`, only if self-hosted under ~30KB) for the hint and inferred-word label only, max 1.25rem. Display 4rem/1.05 desktop, 2.25rem mobile. Body 1.125rem/1.6, max 62ch.

**Shadows.** Cutout shadow: `0 1px 0 rgba(43,42,40,.25), 0 3px 6px rgba(60,45,25,.18)`. Dragged: `0 10px 14px rgba(60,45,25,.22)` with scale 1.06. Sheets: `0 18px 40px rgba(60,45,25,.25)`. No blur above 40px, no glass, no gradients on controls.

**Spacing.** 8px base grid. Controls 44px high, 12px radius, 1.5px `--line` border, `--paper-raised` fill, pressed state drops 1px.

## 3. Chibi object style (all 12 objects)

- Canvas 128x128 viewBox, object fills about 100px. Same optical size across catalog (cat = dog = tree height feel; sun/moon may be 88px).
- Rounded-blob silhouette, head-heavy (head 55-60% of height), stubby limbs, no anatomy detail.
- **Outline**: 3px `--line`, round joins/caps, slightly imperfect (hand-traced feel, no wobble filter).
- **Fill**: one flat accent, one lighter tone patch (belly, petals), one 25%-opacity shade shape on the lower right. No gradients.
- **Paper cutout edge**: 4px `--paper-raised` border around the outline (a white-ish sticker rim), then the cutout shadow.
- Faces: two 6px dark oval eyes, faint `--clay` blush; mouth only on cat/dog/fish.
- Accents: cat ginger, dog `--clay`+cream, rabbit cream, bird `--sky`, fish `--clay`, butterfly `--plum`, tree/cactus `--moss`, flower/sun `--butter`, mushroom `--clay`, moon cream.
- Placeholder art must carry `data-placeholder="true"` and a dashed outline until replaced; never ship emoji as final art.

## 4. Cat (reference asset)

Anatomy: round head as wide as the body, triangular ears with pink inner notch, small triangle nose, two 1.5px whiskers per side, curled tail as a separate SVG group, seated three-quarter front pose, rounded nub paws. Ginger with cream muzzle and two forehead stripes.

Animations (CSS, transforms only, on an inner sprite element; placement transform lives on the outer wrapper):
- **Spawn** 320ms: scale 0.6 -> squash (1.15 x, 0.85 y) at 35% -> stretch (0.95 x, 1.08 y) at 65% -> 1.0. Ease `cubic-bezier(.3,1.4,.5,1)`. A small paper-puff ring (2 short arcs) fades at the point.
- **Idle**: blink every 4-6s (eyes scaleY to 0.1 for 120ms); tail sways +-8deg over 2.4s, `ease-in-out`, alternating. Stagger start per object so nothing syncs.
- **Drag**: on pickup, scale 1.06, rotate -3deg, raised shadow; tail swing stops; eyes stay open. Release settles back in 160ms.
- **Delete**: over trash, object shrinks to 0.85 and trash lid tilts 12deg with highlight (`--clay` ring). Release: object shrinks to 0 and rotates 20deg into the trash over 220ms.
- **Reduced motion**: no squash, no blink, no tail; spawn is a 120ms opacity fade; drag keeps only the shadow change; delete is a 120ms fade.

Other objects reuse spawn/drag/delete; each gets one idle motion by animation key (bird hop, flower sway, sun ray spin).

## 5. Controls

- **Word input** appears centered on the click point (clamped 12px inside viewport): a 220px paper-raised pill in the UI font, 1.5px border, focus ring, hidden label "Name an object", placeholder "e.g. cat". Enter submits, Escape cancels, `maxlength=24`. Unknown word: message under the pill with up to 3 suggestion chips; input preserved.
- **Type/Draw toggle**: two-segment control in the dock; active segment filled `--graphite` with `--paper` text.
- **Draw strip** (Draw mode only): Undo, Clear, brush size (2 sizes), **Create** (primary, filled `--graphite`), inferred-word label in handwriting with up to three chips and a "Type instead" button. Strokes: `--graphite` 4px round.
- **Trash**: bottom-right, a paper-cut bin icon drawn in object style with an accessible name; also reachable via keyboard ("Delete selected"). On drag-over: lid opens and ring highlights.
- **Selection**: 2px dashed `--focus` outline; Delete removes; arrows move 8px.

## 6. Project sheet

A sheet of `--paper-raised` paper slightly rotated (-0.6deg, removed under reduced motion), 720px max width desktop, full-width minus 16px on mobile, scroll within (`max-height: 88vh`). Backdrop `rgba(43,42,40,.35)`, no blur. Two `--butter` tape strips (60%) on top corners. Order: title (2rem), short description, diagram, tech chips, verified links, labeled Close (top-right, 44px). Entry: rise 24px and fade, 220ms.

**Diagram.** Inline SVG, graphite 2px lines, boxes filled `--paper` with `--line` outline, components as rounded rectangles, one accent colour per layer (client `--sky`, service `--moss`, data `--butter`, ML `--plum`), 14px UI-font labels, arrowheads 8px, text on a `--paper` backing so crossing lines never obscure it. On narrow screens the diagram scrolls horizontally inside its own container rather than shrinking text below 14px. Include `<title>`/`<desc>`. Content only from verified repo info; gaps go in developer notes, not published copy.

## 7. Acceptance criteria (observable)

1. At 1440x900 and 390x844, the title, all four portfolio links, and the mode toggle are visible without scrolling, and at least half the canvas area is empty paper on first load.
2. All 12 objects share the 3px outline, sticker rim, and shadow, and sit at the same apparent size (within 15%) when spawned side by side; the cat shows a visible squash-and-stretch on spawn.
3. Clicking empty paper opens a pill input at that point; Enter spawns the object at that exact point; clicking a dock button or dragging an object opens no input.
4. Dragging an object over the trash visibly opens the lid and rings it; releasing removes the object; with `prefers-reduced-motion`, all idle/squash motion is absent.
5. Opening a project sheet shows title, description, SVG diagram, tech chips, links and Close; focus is trapped, Escape closes, focus returns to the opener, and the body text reads at 4.5:1 contrast with no horizontal page scroll at 390px.
