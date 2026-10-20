# CLAUDE.md

@AGENTS.md

## Claude Code specifics

- Skills live in `.claude/skills/`; use them when their trigger applies (see AGENTS.md §15).
- Guardrail hooks live in `.claude/hooks/` and read `.claude/guardrails.config.json`. Do not edit hooks or settings unless the human asks.
- After a compaction, the hard rules are re-injected from the `reminder` block in AGENTS.md.
- Personal preferences: `CLAUDE.local.md` (gitignored), if present.
