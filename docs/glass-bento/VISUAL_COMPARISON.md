# Visual comparison: current build vs references (task 01B)

Current build: `screenshots/01-desktop-dark.png`. References: `references/reference-bento.png` (composition), `references/reference-coffee.png` (materials). Neither is copied; branding, text, and imagery are not reused.

## What the bento reference does that ours does not

- Tiles differ strongly in size: one dominant media tile (about 40% of the width), tall and wide image tiles, small utility tiles. Ours are near-equal text cards, so nothing leads.
- Almost every tile is image-led; text is a caption. Ours are text-only, so the page reads as a list in boxes.
- Identity is compact (a narrow column with name, one paragraph, links), not a hero. Our Intro tile is the biggest tile and is mostly empty.
- Density is high and loud. We keep the rhythm (asymmetry, media-first) at about a third of the density and with a single accent.

## What the Coffee reference does that ours does not

- One saturated, soft-edged color field sits behind small translucent panels, so blur and translucency are actually visible. Ours blur a near-flat background, so the glass reads as a dark rectangle.
- Panels float: generous radius, large soft shadow, hairline edge, light inner highlight. Ours have the edge but too little depth.
- The color lives in the backdrop, not in the UI chrome. UI text stays neutral and highly legible.

## Direction for 01B

1. Composition: 12-column grid, 140px row unit. Quest Board is a dominant 8x4 media tile; a compact 4x2 identity tile; Sketchbook 4x2 beneath it; Privacy diagram 5x2; HTML Transformer and Flutter app as two small 3x1 text tiles; one 4x2 interests tile. 7 tiles, no repeated About/Intro copy.
2. Materials: glass only where something colorful sits behind it. Quest Board gets a restrained blue wash backdrop with floating glass panels; identity gets glass over a soft page glow. Other tiles use a calm opaque-ish surface (no backdrop blur) for mobile performance.
3. Media honesty: Quest Board is behind a login, so only an illustration is possible: labeled "Illustration", no numbers, names, or statistics. The data model accepts a real sanitized screenshot later. Sketchbook uses the project's own original object artwork on its paper palette. Privacy uses an abstract diagram. HTML Transformer and Flutter have no assets, so they stay small text tiles.
4. Accent: one azure family only. Warm paper color appears only inside the Sketchbook tile because that is the project's own palette.