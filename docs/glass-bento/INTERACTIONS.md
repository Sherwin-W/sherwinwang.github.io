# Interaction map (what navigates, what expands, what does neither)

Source of truth for task 2. Nothing here invents a destination: every URL already exists or is built from existing project code. Nothing is merged, pushed, or deployed until the owner approves.

| Tile | Behavior | Destination or content | Notes |
|---|---|---|---|
| Identity | Not clickable as a tile. Contains one real link: GitHub | `https://github.com/sherwin-w`, new tab | The interest chips are plain text. |
| Quest Board | Navigates, whole tile is one link | `https://tracker.sherwinwang.dev`, new tab | Login-gated app. Tile shows an arrow-up-right icon and an accessible "(opens in a new tab)". |
| Sketchbook | Navigates, whole tile is one link | `/sketchbook/` (static page in this site's own build), new tab | The page mounts the existing `PlayCanvas`. It is not embedded in the portfolio. |
| Privacy Preserving Visualization Tool | Expands in place | Panel: title, existing summary, existing tag, larger illustration | No external destination exists. Panel has only existing content; no new claims. |
| HTML Transformer | Expands in place | Panel: title, existing summary, existing tag | No extra assets or links exist yet. |
| Flutter Event Planning App | Expands in place | Panel: title, existing summary, existing tag | Same. |

Data-driven rule in `projects.js`: `href` + `newTab: true` makes a navigating tile; `expand: true` (optionally with `details: string[]` and `links`) makes an expanding tile; neither makes a static tile. A tile never does both, and a tile has exactly one click target.

Known limit: the three expanding panels contain only what the tile already says, plus a larger illustration for Privacy. They get richer when the owner supplies details or links; the panel renders `details` and `links` automatically when present.

## Behavior spec

Hover (pointer devices, interactive tiles only): lift 3px and scale to about 1.015 with a spring (stiffness about 320, damping about 28, no overshoot bounce), shadow grows one step, and one soft low-contrast shimmer sweeps across once per hover (no loop). Press: compress to about 0.985, then settle back with the same spring. Keyboard `:focus-visible`: same lift and shadow plus the 2px accent ring (no shimmer needed). Reduced motion: no scale, lift, or shimmer; ring and a shadow/background change only. Reduced transparency: unchanged opaque styling; shimmer is a solid-gradient sweep clipped inside the tile, not a translucent overlay on content (it must be disabled in reduced-transparency mode).

New-tab links: native `<a target="_blank" rel="noopener noreferrer">` so Ctrl/Cmd-click, middle-click, context menu, and keyboard Enter all behave natively. The tab is opened by the browser directly from the user action, so there is no popup-blocking risk. Visible indicator: arrow-up-right icon (Phosphor `ArrowUpRight`) in the tile corner, and visually hidden text "(opens in a new tab)" in the link name.

Expanding panel: animates from the selected tile (shared `layoutId`), closes with the Close button, Escape, or scrim click, locks page scroll while open (compensating the scrollbar width), moves focus into the dialog and returns it to the originating tile on close, traps Tab inside, `role="dialog" aria-modal="true" aria-labelledby`. Reduced motion: fade only. Reduced transparency: opaque panel and opaque scrim, no blur.

Sketchbook destination (`/sketchbook/`): no artificial delay and no spinner when ready. A small spinner with "Opening sketchbook..." appears only if loading is still in progress after about 300ms, in two layers: (1) a CSS-only spinner in the static HTML shell shown through `animation-delay` while the JS bundle loads, (2) a React Suspense fallback with the same appearance while the lazily imported canvas loads. When ready, the canvas fades in over about 250ms. The loading feedback lives in this tab; the portfolio tab does not observe it. A plain "Back to portfolio" link is available.