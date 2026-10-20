# AI guardrails

How AI coding agents are kept focused, safe and accountable in this repository: a set of rules, skills and hooks.

**Principles:** do only what was asked · ask instead of inventing · humans own commits, money and data · verify before claiming · robust but simple.

## What's inside

```
AGENTS.md                          Single source of truth for ALL agents (rules + project specifics)
CLAUDE.md                          Imports AGENTS.md + Claude Code notes
.cursor/rules/agents.mdc           Cursor pointer to AGENTS.md (unused today, kept for the future)
.claude/
  settings.json                    Permissions + hook wiring (Bash and PowerShell)
  guardrails.config.json           Per-project knobs read by the hooks
  hooks/
    lib.cjs                        Shared helpers
    guard-bash.cjs                 Git, package managers, deps, paid scripts, cloud CLIs, deletes, Docker, DB, secrets
    guard-secret-files.cjs         Blocks Read/Edit/Write/Grep on secret files
    session-reminder.cjs           Re-injects hard rules after compaction
    test-hooks.mjs                 Cross-platform hook tests (99 cases)
  skills/
    clarify-before-build/          Clarify goal and approach before a new feature
    plan-before-change/            Short approved plan for multi-file / risky changes
    debugging-discipline/          4-phase root-cause method, "our bug first", 3-strikes stop rule
    invariant-check/               Mirrored values and report numbers are verified, not assumed
    dependency-vetting/            Supply-chain checks before any new package
    secret-safe-scripts/           Run scripts with credentials without exposing them
    pr-review/                     Description first, then a severity-ranked review
    task-closure/                  Verification, evidence, docs, human actions, commit
docs/ai/incidents.md               Lessons-learned log that feeds new guardrails
```

## Guardrails at a glance

| Action | Result |
|---|---|
| Commit / merge / push on `main` or `master` | ⛔ Blocked (once the repo has its first commit) |
| Commit / push on a feature branch, create PR | ❓ Human confirms |
| Force-push, `reset --hard`, rebase, `clean -f`, `branch -D` | ⛔ Blocked (escape hatch) |
| Other package managers | ⛔ Blocked |
| Add / update dependency, `dlx`, unknown `npx` | ❓ Human confirms (after vetting) |
| Paid scripts (`*:live`) | ⛔ Blocked (escape hatch) |
| Cloud CLIs (`aws`, `gcloud`, `terraform`, …) | ❓ Human confirms |
| Recursive deletes, `docker compose down -v`, `docker volume rm/prune`, `docker system prune` | ❓ Human confirms |
| `DELETE` / `TRUNCATE` / `DROP` / `migrate reset` | ⛔ Blocked (escape hatch) |
| Reading or printing `.env`, keys, credentials | ⛔ Blocked |
| Blocked CLIs (`vercel`, `netlify`) | ⛔ Blocked |

Hooks run only in Claude Code, and the command guard watches both the Bash and PowerShell tools. Other tools follow `AGENTS.md` without mechanical enforcement.

## Testing the hooks

```bash
node .claude/hooks/test-hooks.mjs
```

Run it after every change to a hook or to `.claude/guardrails.config.json`. Requires Node ≥ 18 and git on PATH.

## Credits

The `debugging-discipline`, `task-closure` (verification before completion), `clarify-before-build` and `plan-before-change` skills adapt ideas from [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT License). The text here is original and simplified to fit a human-in-control workflow (no automatic commits, branches or worktrees).
