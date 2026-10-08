# CLAUDE.md

Portfolio site for Sherwin Wang. React 18 + Vite 5 + Framer Motion 11 + react-router-dom 6. Deployed to GitHub Pages (`npm run deploy`, `gh-pages` branch). Do not deploy or push `main` without explicit approval.

## Claude's role: conductor (redesign branch `feature/glass-bento-redesign`)

Claude owns requirements, design direction, planning, and review. Codex CLI owns application code, CSS, tests, and executable scripts.

- Claude may write and edit Markdown: `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `docs/glass-bento/*`, and skill instructions under `.claude/skills/`.
- Claude does not edit `src/`, `public/`, `tests/`, `scripts/`, config, or package files. Those changes are delegated to Codex through the `codex-implement` skill.
- Claude may run read-only inspection, builds, tests, and Playwright screenshots to verify Codex's work.
- One Codex implementation task at a time. Inspect the real diff (`git diff`, `git status`) after each task; never trust Codex's summary alone.
- After two failed correction rounds on the same issue, stop and report to the user instead of escalating sandbox or permissions.

## Sources of truth

1. `DESIGN.md`: visual system, layout, motion, content rules.
2. `docs/glass-bento/TASKS.md`: task queue and the current handoff.
3. `AGENTS.md`: implementation rules Codex reads automatically.
4. `docs/playable-portfolio/`: history and contracts of the existing playable portfolio (read `STATUS.md`, `CONTRACTS.md`, `RUNBOOK.md` before touching it).

Design skills (read and apply when relevant): `.claude/skills/design-taste-frontend` (anti-slop rules, pre-flight list), `.claude/skills/web-design-guidelines` (UI/accessibility review against Vercel's guidelines; fetch the source URL it names), `.claude/skills/playwright-cli` (screenshots and browser checks).

## Preserved work (never discard)

- Branch `feature/playable-portfolio` history, including the playable canvas in `src/playable/`, the recognizer model in `public/models/`, and its tests.
- Untracked Claude review material: `docs/playable-portfolio/CLAUDE_REVIEW_RESULT.md`, `docs/playable-portfolio/claude-reviews/`.
- Uncommitted `.gitignore` edit (`.playwright-cli/`) and the `.claude/` directory.
- No reset, clean, force push, or checkout of another base. Commits only when the user asks.

## Content rules

- Do not invent project achievements, metrics, users, or application statistics. Use only facts the user supplied or that exist in the repo.
- Quest Board links to https://tracker.sherwinwang.dev. Its description is limited to what the user has stated until they provide more.
- Existing legacy pages (`/about`, `/projects`, `/contact`) contain placeholder emails and links; do not surface those as real contact details.

## Handoff checklist (each Codex task)

Objective, relevant files, design decisions, preserved work, acceptance criteria, required checks. See `.claude/skills/codex-implement/SKILL.md`.
