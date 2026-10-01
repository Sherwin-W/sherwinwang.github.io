# Agent operating runbook

## Repository inspection

Read applicable AGENTS.md and CLAUDE.md instructions first.
Inspect status, diff, package files, scripts, router, public assets, CNAME,
deployment workflow and existing content.
Do not assume the repository is Vite or that main is the publishing source.
Record baseline build/test failures separately from introduced failures.

Preserve user edits. No reset --hard, clean -fd, force push, or broad rewrites.
Work on the feature branch. Do not deploy, change DNS, or push main.

## Coordination

Codex lead is the sole integration owner.
Claude provides advisory direction and review, not concurrent source edits.

Before spawning workers, establish:
1. Task ID and acceptance conditions.
2. Exact owned files/directories.
3. Shared data/interface contracts.
4. Base commit or shared-workspace mode.
5. Verification and return format.

Prefer isolated worktrees for coding workers if the client supports them.
A lead-created committed foundation must exist before worktrees are created.
Lead integrates completed commits sequentially and checks each integration.

If agents share one worktree, assign disjoint files. Workers must not run Git
checkout, commit, cherry-pick, install packages, or change global configuration.
Only the lead performs those operations, after workers have stopped writing.

Only the lead edits package files, lockfiles, App integration, global styles,
routing, shared contracts, and the task/status files.
Workers can request shared changes; they must not silently make them.
Do not run Claude and Codex as competing source writers in one checkout.

## Model and usage policy

Use one strong Codex coordinator and initially two small coding workers.
Use fresh bounded worker prompts instead of copying the whole conversation.
Ask workers to read only the relevant brief, contracts and owned files.
Maximum three concurrent implementation workers.
No recursive delegation by workers.

Verify model availability and per-agent selection in the installed client.
Select the smallest suitable available model for mechanical coding/art tasks.
Do not silently fall back to multiple expensive models if routing is unavailable:
use one coding session and document the limitation instead.

Escalate recognition design, architecture, and unresolved correctness bugs
to the stronger lead. A worker gets at most two repair attempts on the same
failure before returning a concise blocker.

Claude budget: one direction pass, one final review. No perpetual review loop.

## Current revised work queue

The revised drawing-first direction supersedes the original typing-first task
sequence above this point. Select is the initial canvas mode; creation is by
Brush or the accessible object picker. The 1,500 ms post-pointer-up recognizer,
score+margin auto-creation, cancellation, reversible transformation, local
model worker, and manual fallback are implemented.

Interaction checkpoint: `924aba8`. The batch-24 stage is now integrated and
evaluated, including 24 labels, original artwork, adjusted Other training
classes, model/runtime parity, per-class holdout evidence, and browser
preprocessing fixtures. See `STATUS.md` and `VALIDATION.md`.

Do not continue toward 60 until the current 24-class results are reviewed and
a new batch is explicitly selected. Preserve user work, commit only locally,
and do not push or deploy.

## Unattended policy

This is a bounded run, not an infinite automation loop.
Continue through ready tasks without routine clarification.
Resolve reversible implementation choices using the brief.
If a task needs unavailable credentials, spending, permissions or assets,
record it as blocked and proceed with independent tasks.
Never bypass permission prompts or disable sandbox protections.

Maximum run: four hours if the client can track elapsed time reliably,
or six implementation/review cycles, whichever comes first.
Stop earlier when acceptance criteria are met.
Do not sleep or poll continuously waiting for Claude or a missing resource.
Usage exhaustion is a stop condition, not a reason to start extra sessions.

Keep status current at milestone boundaries so work can resume after interruption.
At a stop boundary, finish or clearly mark the current patch; leave the last
working state recoverable and describe uncommitted work.

## Verification

Use repository scripts where available.
Meaningful automated checks:
- Exact/alias/typo/ambiguous/unknown word cases.
- Interaction mode transitions and spawn/delete behavior.
- Drawing cancellation and stale asynchronous recognition responses.

Browser checks when browser tooling is available:
- Type cat, spawn it, drag it, delete it.
- Drag release outside the canvas and pointer cancellation.
- Draw multiple strokes, submit, accept a result or handle uncertainty.
- Open project sheet, keyboard navigate, Escape, focus restoration.
- Narrow mobile viewport and reduced motion.
- Repeated spawning, missing asset, recognition loading/failure.

Capture desktop and mobile screenshots.
Measure typed-spawn timing over repeated trials and record sample count.
Inspect console errors and the production build.
If browser tooling is unavailable, report "not browser-verified"; do not
substitute unit tests for claims about visual quality or smoothness.

## Handoff files

Lead creates and maintains:
- STATUS.md: current phase, completed work, next task, blockers, run budget.
- TASKS.md: task IDs, ownership, dependencies, status.
- CONTRACTS.md: shared interfaces and interaction rules.
- VALIDATION.md: commands, results, measurements, screenshots, limitations.
- ASSET_SOURCES.md: asset/model source, license, attribution, modifications.

Final report: what works, what remains incomplete, commands to run locally,
checks actually performed, screenshot locations, and commit IDs.
