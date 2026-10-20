---
name: clarify-before-build
description: Use before writing code for a new feature, a new screen or endpoint, or any request that is ambiguous or could be built in clearly different ways. Do NOT use for small, well-specified changes (a typo, a one-line fix, renaming).
---

# Clarify before build

Building the wrong thing well is still waste. Spend two minutes making sure the goal is clear.

## Steps

1. **Restate the goal** in one or two sentences: who it is for, what problem it solves, what "done" looks like.
2. **Ask only what blocks you** — at most 3–5 focused questions, one topic each. Prefer multiple-choice questions with a recommended option.
   - Users and the main flow
   - Inputs, outputs, edge cases that change the design
   - Constraints: performance, cost, security, deadlines
   - What is explicitly **out of scope**
3. **Offer 2–3 approaches** when there are real alternatives, each with its trade-off (effort, risk, reversibility), and **recommend one**.
4. **Confirm** the chosen approach and the definition of done. Then move to `plan-before-change` if it applies, or implement.

## Rules

- Do not ask questions whose answers are already in AGENTS.md, the plan or the code — read first.
- Do not start writing code while questions are open.
- Keep it light: for a medium feature this should take one exchange, not a meeting.
- Record decisions that matter later in the dev-log entry at closure.
