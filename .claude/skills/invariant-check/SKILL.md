---
name: invariant-check
description: Use when a change touches values that must stay consistent across several places — scores and weights that must sum to a total, thresholds, limits, enums, units, versions, model/price tables, or numbers in a report or document. Trigger before implementing such a change and MANDATORILY before declaring it complete or presenting a report as ready.
---

# Invariant check — verify, never assume

Values that are declared in one place and mirrored in others drift silently. A total that says 100 while its parts sum to 106 is a bug, even if every file "looks right".

## Before implementing

State the invariant explicitly:

> "The N dimension maximums MUST sum to MAX_SCORE. Current sum = X. Target = Y. Delta = Z."
> "The confidence thresholds (high ≥ 0.85, review < 0.6) must match in core rules, the prompt and the UI legend."

## After implementing — read every source

List and read **all** places where the value lives, for example:

- Backend constants and config
- Validation schemas (e.g. Zod `.max()`, enums)
- Prompts (limits, scales, labels the model is told)
- Frontend constants, legends, labels, derived totals
- Test fixtures and seed/sample data
- Scripts, docs, README and reports that quote the number

## Report in this exact format

> **Invariant check:** core = X · schema = X · prompt = X · UI = X · fixtures = X → sum/total = X vs declared Y → ✅ match / ❌ mismatch (delta = Z)

If there is **any** mismatch: do not mark the task complete. Report it, propose the fix, and wait for the human.

## Human gate

Changes to scoring dimensions, maximums, totals, classification thresholds or rubric versions are **proposed, not executed**: present the full before/after invariant and every affected source, wait for approval, implement, then re-run the check.

## Reports and documents with numbers

Before presenting a report, summary or demo data as ready, verify:

1. **Counts** — every aggregate matches the raw data.
2. **Percentages** — each uses the declared denominator.
3. **Lists vs totals** — listed items match the stated counts.
4. **Traceability** — every claim points to a file, query, log or record.
5. **No invented timelines or estimates** — if one is needed, ask the human and use their exact wording.
