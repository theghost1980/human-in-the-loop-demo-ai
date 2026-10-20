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

## 2026-10-20 — Phase 0 · package skeletons

**Branch:** `feat/phase0-monorepo-scaffold`
**Done:**
- `packages/core` (`@hexis/core`): pure TypeScript package, no dependencies, exported as source.
- `apps/api` (`@hexis/api`): Fastify with `buildApp()` and a server entry that listens on `PORT` (default 3001); no routes yet.
- `apps/web` (`@hexis/web`): Next.js App Router with a placeholder page.
- `vitest` at the root; every package has `typecheck` and `test` scripts.

**Decisions:**
- All new dependencies pinned to versions older than 7 days: `next` 16.4.0, `react` / `react-dom` 19.3.0, `fastify` 5.12.7, `vitest` 4.1.11, `tsx` 4.23.15, `@types/node` 24.19.2 (matches the Node 24 runtime), `@types/react` / `@types/react-dom` 19.3.0.
- Vitest 4 rather than 5: version 5 needs `vite` as a direct dependency.
- `core` has no build step; the web app will need `transpilePackages` when it starts importing it.
- The API reads `PORT` directly until Zod env validation lands (separate Phase 0 item).
- No `next.config.ts` yet; Next works without one.

**Verification:** typecheck ✅ · lint ✅ · format:check ✅ · audit ✅ · `next build` ✅ · API starts and answers (404 on `/`, no routes) ✅ · tests: none yet (no logic to test).

**Human actions needed:**
- Delete `LEEME-PRIMERO.md` at the end of Phase 0.

**Next:**
- `GET /health`, env validation with Zod and `.env.example`, `LICENSE`, CI.

---

## 2026-10-20 — Phase 0 · pnpm monorepo scaffold

**Branch:** `feat/phase0-monorepo-scaffold`
**Done:**
- Root `package.json` (private, pinned `packageManager`, scripts `dev`, `typecheck`, `lint`, `test`, `format`, `format:check`), `pnpm-workspace.yaml`, `tsconfig.base.json` (strict), ESLint 10 flat config with typescript-eslint, Prettier config.
- Five dev dependencies vetted and pinned to exact versions: `typescript` 6.0.3, `eslint` 10.12.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.71.2, `prettier` 3.9.10.

**Decisions:**
- TypeScript 6.0.3, not 7.x: typescript-eslint only supports TypeScript below 6.1.
- Versions published less than 7 days ago were skipped (ESLint 10.13.0, typescript-eslint 8.72.0); `minimumReleaseAge: 10080` (minutes) enforces the same rule in pnpm.
- `eslint-config-prettier` left out: the `recommended` rules do not conflict with Prettier.
- ESLint ignores `.claude/` (hooks have their own test suite); Prettier ignores `*.md`, `.claude/`, `.cursor/` and the lockfile so hand-written docs keep their layout.
- `tsconfig.base.json` stays minimal; `module` settings are decided per package.

**Verification:** lint ✅ · format:check ✅ · audit ✅ (no known vulnerabilities) · typecheck/test: no projects yet (exit 0, nothing checked). ESLint and `tsc` 6.0.3 were also exercised on throwaway files outside the commit.

**Human actions needed:**
- Review the Prettier style (`singleQuote`, `printWidth: 100`) and `engines.node` (`^22.13.0 || >=24.0.0`).
- CI (later in Phase 0) must run Node 22.13+ or 24.
- Delete `LEEME-PRIMERO.md` at the end of Phase 0.

**Next:**
- Skeletons for `apps/web`, `apps/api` and `packages/core`; then `GET /health`.

---

## 2026-10-20 — Planning

**Done:**
- Defined scope, architecture, phases 0–5 and working rules (`docs/PLAN.md`, `docs/ROADMAP.md`, `CLAUDE.local.md`).

**Decisions:**
- Public repo under PolyForm Noncommercial 1.0.0; production prompts and full eval sets stay off the repo.
- Web on Vercel, API + Postgres on AWS EC2 with Docker Compose and Caddy; domains `ops.hexis.fyi` / `api.hexis.fyi`.
- Vertical, feature-based structure; business logic isolated in `packages/core`.

**Next:**
- Phase 0 scaffold.
