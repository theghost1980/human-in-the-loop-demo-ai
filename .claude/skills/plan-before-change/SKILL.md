---
name: plan-before-change
description: Use before implementing a change that touches 3 or more files, adds or changes a database schema or migration, changes a public API contract, or would be hard to revert. Produces a short plan the human approves before any edit.
---

# Plan before change

A short written plan makes the change reviewable before it exists, and keeps the diff inside its scope.

## Plan format (in the chat, not a file, unless the human asks)

```
Goal: <one sentence>

Files
- create  path/to/new-file.ts — <purpose>
- modify  path/to/existing.ts — <what changes>
- delete  path/to/old.ts — <why>

Steps (each one small and verifiable)
1. <step> → verify: <test/command/manual check>
2. <step> → verify: <…>

Risks / reversibility
- <migration impact, breaking changes, data risk, rollback>

Out of scope
- <what this change deliberately does not do>
```

## Rules

- Exact file paths. No "and other files as needed".
- Each step must have a way to verify it.
- Flag anything that needs a dependency (→ `dependency-vetting`), touches data (→ AGENTS.md §10) or costs money (→ §9).
- **Wait for approval** before editing. If, while implementing, the plan turns out wrong, stop and propose the updated plan instead of improvising.
- Keep it proportional: 5–15 lines for most changes.
