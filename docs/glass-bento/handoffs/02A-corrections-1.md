# Task 02A correction round 1

Follow `/AGENTS.md`. Do not run npm install, do not commit. Scope: `src/components/bento/Tile.jsx`, `src/components/bento/motion.js`, `src/components/bento/bento.css` only.

## Bug found by browser inspection

Framer Motion's `whileTap` makes the `motion.article` focusable (`tabindex="0"` is added to ARTICLE.bento-tile--quest and --sketchbook). Measured tab order: GitHub link, then the Quest ARTICLE, then the Quest link, then the Sketchbook ARTICLE, then the Sketchbook link. Each link tile therefore has two tab stops, the focus ring on the article is the browser default (`outline: auto 1px`) instead of the 2px accent ring, and the "one click target per tile" rule is violated.

## Required fix

1. The tile `article` must NOT be focusable or carry a `tabindex` attribute. Remove `whileTap` (and any prop that makes framer add `tabindex`). Implement the press effect with plain pointer events on the article instead: `onPointerDown` (primary button/touch, ignore if the target is outside the link area is unnecessary since the link covers the tile) sets a `pressed` state or animation variant, and `onPointerUp`, `onPointerCancel`, `onPointerLeave`, and `onBlur` clear it. Pressing must still compress to about 0.985 and settle back with the same spring, and the pressed state must not stick after a drag-off or a new-tab navigation. Keep `whileHover` (it does not add tabindex) or equivalent fine-pointer-only hover.
2. Tab order must be: GitHub link, Quest link, Sketchbook link (one stop per interactive tile). Keyboard focus on the link must still lift the tile (hover variant) and show exactly one 2px `--accent` ring, offset 3px, on the tile (via `.bento-tile:has(.bento-tile__link:focus-visible)`), with no UA default ring anywhere.
3. Reduced motion and reduced transparency behavior unchanged.
4. Confirm the hover shadow is actually stronger than rest: the computed `box-shadow` string for hover must differ from rest (log both values in your report). If the transition token pair is identical or the hover rule is overridden by specificity, fix it.

Report: files changed; lint/test/build results honestly (note sandbox blocks, do not work around them).