---
name: task-closure
description: Use when finishing a task, a roadmap item or a phase, before declaring anything "done", "fixed", "working" or "passing", and when preparing a commit message. Also use proactively before an operation that would load a lot of context (reading a file over ~200 lines whole, a command with long output).
---

# Task closure — verify, document, hand over

A task is not finished when the code is written. It is finished when the human knows exactly what was verified, what changed, what they must do, and how to commit it.

## Step 1 — Run the verification

Run `pnpm typecheck`, and `pnpm lint` and `pnpm test` as well when those scripts exist (commands in AGENTS.md "Project specifics" or `.claude/guardrails.config.json` → `commands`). Check the root `package.json` scripts instead of assuming.

A script that does not exist yet (early Phase 0) is reported as **not available**, never as passed. A check that spends money (`:live`) is never part of this step.

## Step 2 — Evidence before claims

Report **only what you observed in this session**:

- List the commands you ran and their real result (`typecheck ✅`, `tests ❌ 2 failing: <names>`).
- Never write "works", "fixed", "passes" or "verified" for anything you did not run.
- If something you did not run is relevant (e.g. you skipped e2e tests), state it as **not verified**.
- A failing check means the task is **not done**: report it, propose the fix, and wait.

## Step 3 — Propose the documentation updates

Do not apply them yet; show them.

- **Dev log** (`docs/dev-log.md`): a new entry — date, branch, what was done, decisions (one line each, with the why), verification result, human actions, next step.
- **Roadmap** (`docs/ROADMAP.md`): which checkboxes move to `[x]` or `[~]`.

**Never read these files whole** — they grow. Use:

| Need | Do | Don't |
|---|---|---|
| See entry format | read the first/last ~20 lines | read the whole file |
| Tick an item | search for the item text → edit that line | read the file to "find" it |
| Check a phase | search headings, then read only that range | read everything |

## Step 4 — Human actions

List anything the human must do or check: env vars to set, DNS/cloud settings, a screen to try, a decision to make. If there is nothing, say "No action needed".

## Step 5 — Commit proposal

- Check the current branch. On `main`/`master` → stop and propose a branch.
- Propose a **Conventional Commits** message in English, e.g. `feat(review-queue): add approve/edit/reject actions`.
- Ask: **"Do you want me to commit?"** Apply the doc updates and commit **only on an explicit yes**. Never push unless asked separately.

## Step 6 — Context hygiene

- Next task in a different area → suggest `/clear` (or a new chat). Direct continuation → suggest `/compact`.
- Self-audit: if this session loaded heavy context (2+ whole large files, long command outputs, big pasted blocks), say so and recommend `/compact` or `/clear` **before** the next task. This is a qualitative estimate — never invent token numbers.
- If a top-tier model is active, suggest switching to a cheaper one for mechanical work (docs, commit messages).

## During the session (proactive)

Before reading a large file whole or running a command with long expected output, offer the lighter option first (search, line range, summary, or the human runs it and pastes the relevant part), unless the human already asked for the full content.

## Output template

```
Verification
- pnpm typecheck ✅
- pnpm lint ✅
- pnpm test ✅ 42 passing
Not verified / not available: <anything relevant you did not run or that does not exist yet>

Docs (proposed)
- dev-log: <entry>
- roadmap: [x] <item>

Human actions
- <…>

Commit (proposed, branch feat/…)
feat(scope): <message>

Do you want me to commit?
```
