# Task 03B correction round 7 (CSS only)

Follow `/AGENTS.md`. Do not run npm install, do not commit. Scope: `src/components/bento/visuals/visuals.css` and `src/components/bento/bento.css` (Sketchbook tile section) only. Everything else stays.

Measured after round 6 (real browser): 1440 OK (objects 60-87px, inside stage, clear of text), 390 OK (56-80px), 195 OK (43-46px), compact tile alignment OK at all sizes. Remaining defect: at 720 and 820 (the full-width Sketchbook tile, 640-1023px) the seven objects are 104-111px each in a stage only 170px tall, so `insideStage=false` and `clearOfText=false` (they hang below the stage into the title/summary and are clipped by `overflow: clip`). The width-based sizing (percent of a 770px-wide stage) is too large for the fixed-ish height.

Fix for the 640-1023px range: give the stage a definite height and size objects from that height with plain percentages: `.bento-slot--sketchbook .sketchbook-stage { flex: none; height: 200px; }` in that range (definite, so percent heights resolve), objects `height: clamp(56px, 32%, 72px); width: auto; aspect-ratio: 1 / 1` (so about 64px at 200px high), positioned by percent offsets so that `top + height <= 100%` for every object (re-check each object's `top`/`bottom` offsets in that range; spread them across the full 770px width so the layout looks like the desktop composition scaled out, not clustered at the left; the dashed stroke SVG keeps `preserveAspectRatio` so it spans the width). Do NOT use `container-type`, `cqh`, or any unit that can resolve to 0 (that caused the earlier 0x0 bug). Do not change the 1440, 390, or 195 rules.

Acceptance (the existing test now asserts it): at 820x1100 and 720x450 each of the 7 objects is at least 48px wide and tall (about 56-72px expected), inside the stage rect (1px tolerance), clear of the text block; tile height stays about 262-290px; no overflow.

Report files changed and honest lint/test/build results. You cannot run Playwright.