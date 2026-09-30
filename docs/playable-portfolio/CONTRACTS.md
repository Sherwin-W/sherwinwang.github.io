# Integration contracts

Shared workspace; lead owns Git, App, styles, package files and docs. Workers do not delegate.
Catalog exports `catalog` array ({id,label,aliases,asset,width,height,animation}) and `resolveWord(text)` -> {status: 'match'|'ambiguous'|'unknown', entry?, suggestions: entry[]}.
Canvas exports default PlayCanvas. It imports catalog.js and ./PlayCanvas.css. Asset URLs use /objects/{id}.svg; dimensions 96x96. It is self-contained, renders word controls, placement area, drawing capture and trash. No network recognition: manual selection must be labeled honestly.
Interaction modes: idle, typing, drawing, dragging. Opening native portfolio dialog makes background inert. Pointer capture handles release outside; cancellation restores position; resizing clamps placements. Keyboard arrows move selected objects; Delete removes; Escape cancels typing/drawing. Input max 48 characters; exact/alias before conservative edit-distance matching. No arbitrary HTML.
