# Paste this into the local Codex session

Read docs/playable-portfolio/BRIEF.md and RUNBOOK.md, plus repository instructions.
Implement this playable portfolio in the existing repository.

You are the lead and sole integration owner. The user authorizes bounded
subagent work, local source edits, relevant dependency installation, local
verification, and local commits on the feature branch. No deployment or push.

First inspect the repository and existing edits. Preserve them.
If still on main, create a feature branch before implementation.
If changes are uncommitted, inspect and checkpoint only relevant non-secret
project files; do not stage unrelated content.

Read ART_DIRECTION.md if present. If absent, use BRIEF.md and continue.
Do not wait for Claude. Do not launch a separate Claude process yourself.

Check the installed client's agent/model capabilities.
Use a strong coordinator and the smallest suitable available coding workers,
with at most two initially and three after interfaces stabilize.
Report the actual selection or the routing limitation.
If model control is unavailable, use a single worker/session rather than
silently spawning an expensive fleet.

Create STATUS.md, TASKS.md and CONTRACTS.md.
Establish a minimal working vertical slice before expanding the catalog.
Delegate disjoint tasks with explicit ownership and acceptance criteria.
Workers must not recursively delegate or edit shared integration files.

Implement, inspect, fix, and integrate. Do not stop after proposing a plan.
Proceed autonomously through unblocked tasks within the runbook's bounded run.
After two failed repair attempts, take over the difficult issue or document
the blocker and continue elsewhere.

Prioritize responsive typing, dragging, coherent original art, and accessible
portfolio access. Investigate drawing recognition honestly.
Do not claim a hand-coded placeholder is a trained recognizer.
Do not invent project details or performance results.

Finish with a working recoverable checkpoint and an evidence-based handoff.
