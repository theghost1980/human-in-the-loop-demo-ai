---
name: debugging-discipline
description: Use for any bug, failing test, data anomaly, duplicate or unexpected result — and ALWAYS before suggesting that an external system (another developer's module, a third-party API, a library, an LLM provider, the database) is at fault. Not needed for trivial, obvious typos.
---

# Debugging discipline

## Core principle: assume it is our bug first

Every anomaly is caused by **our** code until proven otherwise. The burden of proof against an external system is high: concrete, reproducible evidence — not a plausible story.

## The four phases (no fix before phase 2 is complete)

### 1. Observe and reproduce
- Capture the exact error, inputs, environment and the expected vs actual result.
- Reproduce it reliably, ideally with a minimal case or a failing test.
- Check what changed recently (diff, commits, config, data, dependency versions).

### 2. Find the root cause
- Trace the data/control flow backwards from the symptom to its origin.
- Compare with a working example (another path, an older commit, a similar feature).
- Check our own logic first: conditions, joins/filters, time zones, units, off-by-one, async ordering, caching, stale state.

### 3. Hypothesis and test
- One hypothesis at a time, stated explicitly: "I think X because Y."
- Test it with the smallest possible experiment. Change one thing at a time.
- Confirm the cause with **two independent methods** (e.g. a test and a direct query, or logs and a minimal repro).

### 4. Fix and verify
- Fix the **root cause**, not the symptom. No retries, sleeps or try/catch that hide the problem.
- Add a regression test that fails before the fix and passes after.
- Verify per `task-closure` (only claim what you ran).

## Stop rule: three failed fixes

If three fix attempts fail, **stop**. The problem is probably the design or a wrong assumption, not the details. Report to the human: what you tried, what you learned, and what assumption or architecture choice you now doubt.

## Data checks (when a database is involved)

1. Write the query and re-read its logic.
2. Run it with `LIMIT 10` on non-production data first.
3. Check the results make sense.
4. Run the full query only after that.
5. Cross-check with a different query or method.

Read-only queries only. Destructive operations follow AGENTS.md §10.

## Before blaming anything external — answer YES to all

- [ ] I assumed our code was wrong first and looked for it.
- [ ] I read our code that handles this data/flow.
- [ ] I verified our logic with a second, independent method.
- [ ] I can point to the exact call/query/line where behaviour diverges.
- [ ] I ruled out our filters, joins, time windows, aggregation, caching and config.
- [ ] I have a reproducible case that isolates the external system.

Any **NO** → keep investigating our side.

If it is proven external: present the evidence to the human **first**. Never contact or accuse another person, team or vendor without the human's approval.
