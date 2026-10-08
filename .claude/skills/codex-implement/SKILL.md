---
name: codex-implement
description: Delegate one bounded implementation task to Codex CLI, then inspect its real diff, verify, and request targeted fixes. Use for any change to src/, public/, tests/, scripts/, or config in this repo.
---

# codex-implement

Claude conducts; Codex writes code. One task at a time.

## 1. Prepare the handoff

Write `docs/glass-bento/handoffs/NN-short-name.md` (Markdown only). It must be self-contained, because Codex does not see this conversation. Sections:

- **Objective**: one paragraph, observable outcome.
- **Relevant files**: files to read and files it may edit (explicit scope). Anything else is off-limits.
- **Design decisions**: concrete choices already made (reference `DESIGN.md` sections; restate values that matter).
- **Preserved work**: what must not change (playable canvas logic, routes, recognizer, tests, untracked review docs).
- **Acceptance criteria**: observable, checkable statements.
- **Required checks**: commands (`npm run lint`, `npm run test`, `npm run build`, browser checks) and what to report.

Codex also reads `AGENTS.md` automatically. Do not paste Claude's "do not write code" restriction into a handoff.

## 2. Invoke Codex

Windows, PowerShell. Pipe the handoff on stdin (the trailing `-`), run from the repo root, and capture the final message:

```powershell
$task = "docs/glass-bento/handoffs/01-name.md"
$out  = "$env:TEMP\codex-last.txt"   # or the session scratchpad
Get-Content $task -Raw | codex exec -s workspace-write -C (Get-Location).Path -o $out -
Get-Content $out
```

- Use `-s read-only` for inspection or review tasks, `-s workspace-write` for implementation. Add `--ephemeral` for throwaway read-only checks.
- Never use `--dangerously-bypass-approvals-and-sandbox` or `danger-full-access`, and do not widen the sandbox automatically when a task fails. If a command is blocked, read the error, narrow or restate the task, or ask the user.
- Long tasks: use a long tool timeout or run in the background and wait for completion.
- Check `codex exec --help` if syntax errors appear; the CLI changes between versions.

## 3. Inspect the actual diff

Do not rely on Codex's summary.

```powershell
git status --short
git diff --stat
git diff -- <changed paths>
```

Untracked new files do not appear in `git diff`; read them directly. Confirm: only in-scope files changed, preserved work untouched (`git status` still shows the untracked review docs and `.gitignore` edit as before), no stray files, no invented content or statistics, no em-dashes in visible copy.

## 4. Verify

Run the handoff's required checks yourself: `npm run lint`, `npm run test`, `npm run build`, and when layout or interaction changed, Playwright screenshots at desktop (1440x900) and mobile (390x844) via the `playwright-cli` skill. Compare against `DESIGN.md` and the `design-taste-frontend` pre-flight list. Distinguish pre-existing failures (check against a stash-free baseline by reading earlier results) from introduced ones.

## 5. Request targeted corrections

If criteria fail, write a short correction handoff listing only the failing items with evidence (file:line, screenshot, command output) and the expected result. Re-run `codex exec` once per round, repeat steps 3 and 4. After two correction rounds on the same issue, stop and report to the user.

## 6. Close out

Update `docs/glass-bento/TASKS.md` (status, what was verified, open issues). Do not commit unless the user asks. Start the next task only after the current one is accepted.
