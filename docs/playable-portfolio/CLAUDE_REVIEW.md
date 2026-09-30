# Claude: direction pass before coding

Read repository instructions and docs/playable-portfolio/BRIEF.md.
Inspect the existing landing page and available screenshots if accessible.
Your role is art director. Codex owns implementation.

Write only docs/playable-portfolio/ART_DIRECTION.md.
Do not edit source, package files, Git branches, or shared status files.

Make one concrete direction, not a list of competing redesigns:
- Composition and hierarchy for desktop and mobile.
- Paper texture, palette, typography, shadows and spacing.
- A consistent original chibi object style.
- Cat anatomy/pose and spawn, idle, drag and delete animation treatment.
- Placement and appearance of word input, drawing controls, trash and projects.
- Project sheet treatment, diagram styling and readability.
- Five observable visual acceptance criteria.

Keep the output under 1,200 words. Make it directly implementable.
Stay faithful to the brief. Do not introduce physics, crafting, or new hosting.
Use one strong model pass. If delegation is useful, use at most one small
read-only worker for a bounded consistency/copy audit. Do not create a swarm.

# Claude: later review pass

After Codex has produced a working build, read ART_DIRECTION.md, VALIDATION.md,
the relevant implementation and actual desktop/mobile screenshots.

Write only docs/playable-portfolio/CLAUDE_REVIEW_RESULT.md.
Return at most ten actionable findings, ordered by severity.
For each: observed evidence, user impact, concrete fix, acceptance condition.
Distinguish observed bugs from hypotheses.
If screenshots/browser access are unavailable, label visual review incomplete.
Do not ask Codex to restart the design or add unrelated features.

Codex will implement the fixes. You are not a concurrent source writer.
