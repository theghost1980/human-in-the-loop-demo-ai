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

## 2026-10-20 — Phase 0 · CI workflow

**Branch:** `feat/phase0-env-validation`
**Done:**
- `.github/workflows/ci.yml`: one `verify` job (Ubuntu, Node 24) that runs `pnpm install --frozen-lockfile`, `typecheck`, `lint` and `test`; triggers on every push and on pull requests to `main`; read-only permissions; a newer run on the same ref cancels the older one (except on `main`).

**Decisions:**
- Actions are pinned to a commit SHA taken from the official repos: `actions/checkout` v7.0.1, `pnpm/action-setup` v6.1.0, `actions/setup-node` v7.1.0 (all older than 7 days).
- `pnpm/action-setup` rather than `pnpm/setup`: v3 of the latter requires pnpm 11 or newer and the repo pins pnpm 10.33.2. The pnpm version comes from `packageManager`.
- Node 24 only (no matrix) and no dependency cache: install takes seconds, so the extra moving part is not worth it.
- Cost: none. The repo is public and uses a standard GitHub-hosted runner, which is free for public repositories; no secrets, artifacts or caches are used, so the workflow cannot spend Anthropic or AWS credits. If the repo ever goes private, the free plan has a monthly minutes quota.

**Verification:** run #1 (push on this branch) completed successfully in about 22 s; the same four commands pass locally. The `pull_request` trigger has not run yet.

**Human actions needed:**
- Add `verify` as a required status check in the `protect-main` ruleset.

**Next:**
- `infra/docker-compose.yml` and `Caddyfile`; then the human-only items (AWS, Anthropic key and spend limit, DNS, Vercel).

---

## 2026-10-20 — Phase 0 · LICENSE

**Branch:** `feat/phase0-env-validation`
**Done:**
- `LICENSE` at the repo root with the official PolyForm Noncommercial License 1.0.0 text; the README already carried the license note and links to it.

**Decisions:**
- The text is the unmodified official file, downloaded by the human from the `1.0.0` tag of `polyformproject/polyform-licenses`; no `Required Notice` line was added (the README keeps the copyright line).

**Verification:** the file is byte-identical to the official one: git blob hash `5ecc88cfc4b1cff608ed640efe913c9dd97935c3` and size 4563 bytes match the values GitHub reports for `PolyForm-Noncommercial-1.0.0.md` at tag `1.0.0`. It starts with the official title, has the 15 sections (Acceptance to Definitions) and LF line endings. format:check ✅.

**Human actions needed:**
- None.

**Next:**
- CI workflow (typecheck, lint, test).

---

## 2026-10-20 — Phase 0 · env validation

**Branch:** `feat/phase0-env-validation`
**Done:**
- Zod schema for the API environment (`NODE_ENV`, `PORT`) in `apps/api/src/shared/config/env.ts`; `loadEnv()` runs at startup in `index.ts`.
- `dev` script loads `../../.env` when it exists (`--env-file-if-exists`); `.env.example` at the repo root.
- 10 tests for `loadEnv` (defaults, coercion, invalid `PORT` and `NODE_ENV`, rejected values never echoed).

**Decisions:**
- `zod` 4.6.7 is the only new dependency.
- Error messages name the wrong variable and the reason but never its value, so future secrets cannot leak into logs.
- Only variables the app reads today are listed; `DATABASE_URL`, `ANTHROPIC_API_KEY`, etc. arrive with the features that use them.
- `.env.example` lives at the root (as in the plan) and `.env` is read from the root too.

**Verification:** typecheck ✅ · lint ✅ · format:check ✅ · audit ✅ · tests ✅ (12 passing) · live startup: an invalid `PORT` exits with a clear message, a missing `.env` falls back to defaults, an env file is honoured through `tsx watch`.

**Human actions needed:**
- `.env.example` was created by the human: the `Read(./.env.*)` deny rule in `.claude/settings.json` also blocks it for the agent (the secrets hook already allows it).

**Next:**
- `LICENSE`, CI.

---

## 2026-10-20 — Phase 0 · GET /health

**Branch:** `feat/phase0-api-health`
**Done:**
- `GET /health` returns `{ "status": "ok" }` from `apps/api/src/features/health/routes.ts`, registered in `buildApp()`.
- `buildApp()` accepts `{ logger }` so tests run without log noise; two tests with `app.inject()` (200 + body, unknown route stays 404).
- `.gitattributes` (`* text=auto eol=lf`): LF in the working tree on every OS.

**Decisions:**
- No new dependencies; `/health` is a plain liveness check (no DB or LLM calls) so it can back Docker and Caddy health checks later.
- Line endings: on Windows, `core.autocrlf=true` checked files out as CRLF and `prettier --check` failed on 15 files (content was fine). Forcing LF through `.gitattributes` fixes it for every clone; Prettier keeps its default `endOfLine`. The 20 CRLF working-tree files were converted to LF; git sees no content change.

**Verification:** typecheck ✅ · lint ✅ · format:check ✅ · tests ✅ (2 passing) · audit ✅ · hooks suite ✅ (99/99) · live `GET /health` 200 ✅ and unknown route 404 ✅.

**Human actions needed:**
- None.

**Next:**
- Env validation with Zod and `.env.example`, `LICENSE`, CI.

---

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
