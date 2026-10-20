# AGENTS.md

Operating rules for every AI coding agent working in this repository (Claude Code, Cursor, Codex, OpenCode, Copilot, Gemini and any future tool). This file is the **single source of truth**; tool-specific files only point here.

**Precedence:** an explicit instruction from the human for the current task › `CLAUDE.local.md` (personal) › **Project specifics** below › general rules. Hard safety rules (secrets, protected branches, destructive operations, paid calls) can only be relaxed by the human through the escape hatches in §12.

---

## 1. Project specifics

> Keep it short; link to docs for detail. The full plan lives in [`docs/PLAN.md`](docs/PLAN.md).

| Item | Value |
|---|---|
| Project | Hexis Ops — human-in-the-loop AI agents for business operations (agent proposes, auto-applies what is safe, routes exceptions to a human reviewer) |
| Package manager | `pnpm` (only) |
| Apps / packages | `apps/web` (Next.js, presentation only) · `apps/api` (Fastify, orchestration: HTTP, persistence, LLM calls) · `packages/core` (pure TypeScript business logic: engine + scenarios; no React, Fastify or DB driver) |
| Commands | typecheck: `pnpm typecheck` · lint: `pnpm lint` · tests: `pnpm test` · dev: `pnpm dev` |
| Paid scripts | Anything ending in `:live` (e.g. `pnpm eval:live`). Limited credits: Anthropic and AWS. |
| Protected branches | `main`, `master` |
| Branch naming | `feat/<phase>-<topic>` · `fix/<topic>` · `docs/<topic>` · `chore/<topic>` |
| Docs to keep updated | `docs/dev-log.md` · `docs/ROADMAP.md` · `docs/ai/incidents.md` |
| Languages | Chat with the human: Spanish · Code, comments, names, commits, README, dev-log, roadmap: English (public portfolio repo) |

---

## 2. Hard rules (summary)

<!-- reminder:start -->
- Do only what was asked. Out-of-scope ideas go in a "Suggestions" note, never into the diff.
- When in doubt, ask the human. Never invent APIs, options, versions, model names or prices.
- No commits, pushes, merges or PRs unless the human explicitly asks. Never on main/master.
- No new dependency without the dependency-vetting report and the human's approval.
- Never read, print, copy or commit secrets (.env, keys, credentials).
- No paid calls (LLM APIs, cloud) and no destructive operations (DB, git history, recursive deletes, Docker volumes) without explicit approval.
- Before finishing a task, run typecheck, lint and tests (those that exist) and report only what actually ran. Then ask the human whether to commit.
- Business logic stays out of the UI. Robust but simple; no over-engineering.
<!-- reminder:end -->

---

## 3. Scope discipline

- Work **only** on the task given. Do not review, refactor, rename or "improve" files outside it.
- Keep diffs small and focused: one change, one purpose.
- Do not create files, folders, scripts or configuration the task does not need.
- Do not change shared configuration (tsconfig, ESLint, CI, Docker, Caddy, DNS) unless the task asks for it.
- Noticed something worth fixing elsewhere? List it under **Suggestions** at the end of your reply.
- Do not read large files whole when a search or a line range will do (see `task-closure` skill, context hygiene).

## 4. Ask, don't invent

- Missing information (a requirement, a name, an expected behaviour, a version) → **stop and ask**.
- Never invent library APIs, CLI flags, configuration keys, model IDs or prices. If unsure, say so and propose how to verify (docs link, a quick check the human can run).
- If an instruction conflicts with this file or the project plan, stop and point out the conflict.
- For a **new feature** or an ambiguous request, use the `clarify-before-build` skill before writing code.

## 5. Architecture

- **Robust but simple.** No layers, patterns, generics or abstractions "just in case". Solve today's problem with a design that does not block tomorrow's.
- **Business logic separate from UI.** Business rules live in a framework-free module (e.g. `packages/core` or `src/domain`). UI code only presents and calls; API code only orchestrates (HTTP, persistence, external calls).
- **Vertical, feature-based structure.** Each feature owns its folder with everything it needs (components, hooks, routes, service, schemas, tests).
- **Promotion rule:** a module stays inside its feature until **two or more** features need it; then it moves to `shared/` (app level) or the core package (business logic).
- **Reuse where it is natural**, never forced.
- **Validate at the boundaries** (HTTP input, LLM output, env vars, file input) with a schema library (e.g. Zod).
- **Strict typing.** No `any` (or equivalent) without a one-line justification comment.

## 6. How a task runs

1. **Clarify** — new feature or unclear request → `clarify-before-build`.
2. **Plan** — change touching 3+ files, a schema/migration, or anything hard to revert → `plan-before-change`; wait for approval.
3. **Implement** — small steps, matching the plan. New business logic gets tests. No debug `console.log`, commented-out code or unexplained TODOs.
4. **Debug** — anything unexpected → `debugging-discipline`. No fix before the root cause is known.
5. **Check invariants** — values defined in several places (limits, thresholds, totals, enums) → `invariant-check`.
6. **Close** — `task-closure`: verification, docs, human actions, commit message.

**Done means:** the item does what `docs/PLAN.md` asks for it, no more and no less · typecheck, lint and tests pass · new business logic has tests · no leftovers from step 3.

## 7. Dependencies

- No new dependency, version bump or remote execution (`pnpm add`, `pnpm dlx`, `npx <pkg>`) without running the **`dependency-vetting`** skill and getting the human's approval.
- If you cannot vet it (no web access), **stop** and give the human the links to check.
- Prefer zero-dependency solutions for small problems.

## 8. Secrets

- Never read, print, copy, log or commit `.env*` (except `.env.example`), private keys or credential files.
- Scripts that need secrets follow the **`secret-safe-scripts`** skill (`--env-file`, the human runs them).
- Production prompts, full datasets and cached production results stay out of the repo (`private/` is gitignored).

## 9. Costs & external services

- **No real calls to paid APIs** (LLMs, cloud, third-party) without explicit approval. Tests use mocked or recorded responses by default.
- Scripts that spend money end in **`:live`**; the hook blocks them unless the human enables them.
- Cloud CLIs (`aws`, `gcloud`, `terraform`, …) and remote shells or copies (`ssh`, `scp`, `rsync`) always require the human's confirmation.

## 10. Data safety

- `DELETE`, `TRUNCATE`, `DROP`, `migrate reset` and similar: **propose, never execute**, unless the human says "yes, delete it" and enables the escape hatch.
- Test any data query with `LIMIT` first and on non-production data.
- Recursive deletes (`rm -r`, `Remove-Item -Recurse`, `rmdir /s`) and Docker data loss (`docker compose down -v`, `docker volume rm|prune`, `docker system prune`) need the human's confirmation every time.

## 11. Git

- **The AI commits only when the human explicitly asks.** No push, merge or PR creation unless asked.
- **`main` and `master` are sacred:** no direct commits, merges or pushes. Work on a branch; integration happens through a PR the human merges.
- Before starting a task, check the current branch. On a protected branch → stop and propose a branch name.
  - **One exception:** while the repository has no commits yet, work happens on `main` and the human makes the first commit (scaffold + kit). From that commit on, everything goes through branches.
- Never rebase, force-push, `reset --hard`, `clean -f` or delete branches with `-D` on your own.
- Commit messages: **Conventional Commits** in English (`feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`).

## 12. Guardrails (hooks) and escape hatches

Claude Code enforces part of these rules with hooks in `.claude/hooks/` (configured in `.claude/guardrails.config.json`). The command guard covers both the Bash and PowerShell tools. **Other tools have no hooks: there, you are the only safety layer.**

| Guardrail | Behaviour | Escape hatch (human only, set in their own terminal) |
|---|---|---|
| Blocked CLIs (e.g. `vercel`) | Always blocked | none |
| Commit/merge/push on `main`/`master` | Always blocked | none |
| Commit/push on other branches, PR creation | Human confirms | — |
| Destructive git | Blocked | `CLAUDE_ALLOW_GIT_DESTRUCTIVE=1` |
| Other package managers | Blocked | none (edit config) |
| Add/update dependency, `dlx`, unknown `npx` | Human confirms | — |
| Paid scripts (`:live`) | Blocked | `CLAUDE_ALLOW_PAID=1` |
| Cloud CLIs | Human confirms | — |
| Remote shells and copies (`ssh`, `scp`, `rsync`) | Human confirms | — |
| Destructive DB operations | Blocked | `CLAUDE_ALLOW_DB_DESTRUCTIVE=1` |
| Recursive deletes, Docker volume removal / prune | Human confirms | — |
| Reading/printing secret files | Blocked | none |

Escape hatches are environment variables the **human** sets, never the agent: either run the command yourself in your own terminal, or set the variable in the environment that launches Claude Code (bash: `export CLAUDE_ALLOW_PAID=1` · PowerShell: `$env:CLAUDE_ALLOW_PAID = "1"`), restart it, and unset it when the task is done.

**Known limit:** hooks only see command strings and file paths. Logic hidden inside a script (a `deleteMany()` or a paid API call in a `.ts` file run with `tsx`) is invisible to them: ask before writing and running such scripts.

## 13. Incidents

When something slips through (a wrong number reached a report, a rule was bypassed, context exploded, a bad dependency got in), **propose an entry** in `docs/ai/incidents.md`: what happened, impact, root cause, and the rule/skill/hook change that prevents it. Add it only after the human agrees.

## 14. Communication

- Be brief and concrete: what changed, in which files, and why.
- Explain non-obvious design decisions in one line.
- If you could not do something, say so plainly and state what is missing.
- Never claim something works, passes or is verified unless you ran the check in this session and saw the result.

## 15. Skills index

| Skill | Use when |
|---|---|
| `clarify-before-build` | New feature or ambiguous request, before any code |
| `plan-before-change` | Change touches 3+ files, schema/migration, or is hard to revert |
| `debugging-discipline` | Any bug, anomaly or unexpected result |
| `invariant-check` | Values that must match across sources (limits, thresholds, totals, report numbers) |
| `dependency-vetting` | Before adding, updating or remotely executing any package |
| `secret-safe-scripts` | A script needs env vars / credentials |
| `pr-review` | The human asks to review a pull request |
| `task-closure` | Finishing a task or a roadmap item |
