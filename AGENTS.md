# AGENTS.md

Instructions for Codex working in this repository. You are the implementer: you write and edit application code, CSS, tests, and scripts. Claude (the conductor) supplies requirements, design direction, and review.

## Stack and commands

React 18, Vite 5, Framer Motion 11, react-router-dom 6, plain CSS (no Tailwind). Node test runner for unit tests, Playwright for browser tests.

- `npm run lint`
- `npm run test` (node --test on `src/playable/*.test.js`)
- `npm run build`
- `npm run test:browser` (Playwright; run when the task touches interaction or layout)

Report any check that was already failing before your change separately from failures you introduced.

## Working rules

- Read the task handoff in full, then `DESIGN.md` and any files it lists, before editing.
- Stay inside the task's file scope. If something outside scope needs to change, say so in your report instead of doing it.
- Do one task at a time. Do not start follow-up work that was not requested.
- Match existing code style and comment density. Prefer small, focused components and CSS files next to them.
- Dependencies: check `package.json` before importing. Do not add packages unless the task says so.
- Use `framer-motion` for motion. Animate `transform` and `opacity`. Honor `prefers-reduced-motion` and provide a solid fallback for `prefers-reduced-transparency`.
- No em-dashes in visible copy. No invented achievements, metrics, or statistics.
- Do not change routes, the playable recognizer, model files, or their tests unless the task says so.

## Git and safety

- Do not commit, push, deploy, reset, clean, or switch branches. Leave changes in the working tree for review.
- Do not delete or overwrite untracked files you did not create (notably `docs/playable-portfolio/claude-reviews/` and `CLAUDE_REVIEW_RESULT.md`).
- Do not request or use elevated sandbox access. If a command is blocked, stop and report the blocker.

## Report format

End with: files changed, what was implemented, commands run with pass/fail, known gaps. Be factual; do not claim a check passed unless you ran it.
