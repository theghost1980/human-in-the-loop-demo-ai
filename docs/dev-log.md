# Hexis Ops — Dev Log

Newest entries on top. One entry per closed roadmap item or phase.

---

<!--
## YYYY-MM-DD — <Phase N> · <item>

**Branch:** `feat/...`
**Done:**
- ...

**Decisions:**
- ... (why, in one line)

**Verification:** typecheck ✅ · lint ✅ · tests ✅ (n passing)

**Human actions needed:**
- ...

**Next:**
- ...
-->

## 2026-10-20 — Planning

**Done:**
- Defined scope, architecture, phases 0–5 and working rules (`docs/PLAN.md`, `docs/ROADMAP.md`, `CLAUDE.local.md`).

**Decisions:**
- Public repo under PolyForm Noncommercial 1.0.0; production prompts and full eval sets stay off the repo.
- Web on Vercel, API + Postgres on AWS EC2 with Docker Compose and Caddy; domains `ops.hexis.fyi` / `api.hexis.fyi`.
- Vertical, feature-based structure; business logic isolated in `packages/core`.

**Next:**
- Phase 0 scaffold.
