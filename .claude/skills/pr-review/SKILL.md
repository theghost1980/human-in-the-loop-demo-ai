---
name: pr-review
description: Use when the human asks to review or analyse a pull request or a branch diff. Trigger BEFORE fetching branches, running diffs or any other analysis.
---

# Pull request review

## Step 1 — Description first

Ask the human to paste the PR **title and description** in the chat before anything else. It holds the intent, decisions and context you would otherwise guess (and GitHub CLI access may be unavailable or scoped to another account).

## Step 2 — Gather the diff

Read-only commands only (`git fetch`, `git diff`, `git log`). Read the changed files and enough surrounding code to understand them — not the whole repo.

## Step 3 — Review checklist

- **Scope:** does the diff do what the description says — and nothing else?
- **Correctness:** edge cases, error handling, async/ordering, time zones, units.
- **Architecture:** business logic outside the UI, feature-based structure, no needless abstraction (AGENTS.md §5).
- **Tests:** new logic covered; tests meaningful (not just snapshots); mocks for paid/external calls.
- **Types & validation:** no unjustified `any`; inputs validated at boundaries.
- **Security:** no secrets, injection risks (SQL, prompt, command), authz checks, safe handling of LLM output.
- **Dependencies:** any new package vetted (`dependency-vetting`)?
- **Data & migrations:** reversible? destructive? backfills?
- **Invariants:** mirrored values still consistent (`invariant-check`)?
- **Performance & cost:** N+1 queries, unbounded loops, unnecessary model calls.

## Step 4 — Report

Group findings by severity, each with file:line and a concrete suggestion:

- **Blocking** — must fix before merge
- **Should fix** — important, not blocking
- **Nits** — optional

End with a one-line verdict. Do **not** post comments on GitHub, approve, request changes or merge unless the human explicitly asks.
