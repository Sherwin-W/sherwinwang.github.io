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

Use one strong Codex coordinator and at most two small coding workers.
Use fresh bounded worker prompts instead of copying the whole conversation.
Ask workers to read only the relevant brief, contracts and owned files.
Maximum three concurrent implementation workers.
No recursive delegation by workers.

Verify the models actually available through the installed collaboration
client and record the selected model for each worker. Select the smallest
suitable available model for mechanical coding/art tasks. If the client does
not expose the requested model selection, do not claim it was routed; record
the limitation and use the available default.

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

The 24-object recognizer remains the active supported catalog unless measured
validation evidence shows that expansion preserves its per-class quality and
auto-creation reliability. The remaining 36 illustrations and metadata may
be prepared separately, but asset-only entries must not be presented as
recognition-supported. Preserve user work, commit only locally, and do not
push or deploy.

## Unattended policy

This is an authorized overnight run, bounded by the explicit end time below,
completion of useful authorized backlog, or account usage exhaustion.
Continue through ready tasks without routine clarification. Do not stop just
because a milestone completes.
Resolve reversible implementation choices using the brief.
If a task needs unavailable credentials, spending, permissions or assets,
record it as blocked and proceed with independent tasks.
Never bypass permission prompts or disable sandbox protections.

The user-authorized limit is 07:00 America/Los_Angeles on 2026-10-01. This
overrides the earlier four-hour/six-cycle cap. After the deadline, stop new
work and leave a recoverable checkpoint. At each milestone, inspect
`docs/playable-portfolio/claude-reviews/`; ignore `.draft.md` files, read and
triage completed reviews, and record resolved, obsolete, and deferred items
in our status notes. Do not wait for reviews; continue independent work.
Do not sleep or poll continuously waiting for Claude or a missing resource.
Usage exhaustion is a stop condition, not a reason to start extra sessions.

Keep status current at milestone boundaries so work can resume after interruption.
At a stop boundary, finish or clearly mark the current patch; leave the last
working state recoverable and describe uncommitted work.

Use up to six planned model validation experiments, each with an explicit
wall-clock timeout. Select models and thresholds using validation data only;
keep the held-out test set untouched until final evaluation. Training
experiments may run longer than the former single short training run, within
the overall deadline and account limits. Preserve the current model until a
measured replacement is independently reviewed and integrated.

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
