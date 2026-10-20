# Hexis Ops — Roadmap

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · 👤 = action for the human dev
Details for every item live in [`PLAN.md`](./PLAN.md). Update this file at the close of each item.

---

## ▶ Next session — where we stopped (2026-10-20)

**State:** Phase 0 scaffold, CI, LICENSE, env validation and the infrastructure plan are done; `esbuild` is approved and added. Docker Desktop is installed (29.9.1) but the Claude app must be **restarted** so it sees `docker` in its PATH.

**Human (free, any order):**
1. Restart the Claude app; check that Docker Desktop is running (`docker info`).
2. RUNBOOK Part A (root MFA, admin user, budgets) and B1–B3 (role, security group, emergency key pair).
3. Anthropic: monthly spend limit and a dedicated production key (password manager only, never in chats).
4. Vercel + `ops.hexis.fyi`: follow [`docs/infra/VERCEL.md`](./infra/VERCEL.md).
5. Verify the guardrail hooks in a fresh Claude Code session (`npm --version` must be blocked from Bash and PowerShell).

**Do NOT do yet:** launch EC2 or the Elastic IP, create the `api` DNS record, change the GHCR package visibility.

**Agent (one commit per step, same branch):**
1. API: `HOST` in the env schema (+ tests), `trustProxy`, JSON logs.
2. `apps/api/scripts/build.ts` + `build` script; check `node dist/server.mjs` → `/health`.
3. `apps/api/Dockerfile` + `.dockerignore`; local `docker build` (needs Docker visible to the agent).
4. `infra/compose.yaml`, `compose.dev.yaml`, `Caddyfile`, `env.*.example`, `deploy.sh` (vet the `caddy` and `postgres` images first).
5. `.github/workflows/api-image.yml`. **Decision needed:** it is designed to run on `main`; to test it earlier, either add a temporary push trigger for this branch or merge to `main` through a PR (whether a manual run from a feature branch is possible is NOT VERIFIED).
6. Local smoke test of the whole stack with Docker.

---

## Phase 0 — Foundations & cost safety
- [x] pnpm monorepo scaffold (TS strict, ESLint, Prettier, root scripts)
- [x] `apps/web`, `apps/api`, `packages/core` skeletons
- [x] `GET /health` endpoint
- [x] `.gitignore`, `.env.example`, env validation with Zod
- [x] `LICENSE` (official PolyForm Noncommercial 1.0.0 text) + README license note
- [x] CI workflow: typecheck + lint + test
- [x] Dependency-vetting report for `esbuild` (approved by human) → add as `apps/api` devDependency
- [ ] API: env schema gains `HOST` only; `trustProxy`; pino JSON logs
- [ ] API: `scripts/build.ts` (run with `tsx`; esbuild bundle → `dist/server.mjs`) + `build` script; `node dist/server.mjs` serves `/health` locally
- [ ] `apps/api/Dockerfile` (multi-stage, non-root, healthcheck, all workspace manifests copied) + root `.dockerignore` (`apps/web/*` + `!apps/web/package.json`); local `docker build` OK
- [x] `.gitattributes` (`* text=auto eol=lf`: LF everywhere)
- [ ] `infra/compose.yaml` (caddy, api, postgres:18; per-service `environment`, no `env_file`) + `infra/compose.dev.yaml` (postgres on 127.0.0.1)
- [ ] `infra/Caddyfile` (`API_DOMAIN`, SSE-friendly proxy) + `infra/env.production.example` + `infra/env.local.example`
- [ ] `infra/scripts/deploy.sh` (git pull → compose pull → up -d → prune; the pre-migration dump arrives in Phase 1)
- [ ] Local smoke test: `docker compose -f infra/compose.yaml --env-file infra/.env.local up --build` → `http://localhost/health` OK
- [ ] `.github/workflows/api-image.yml` (ubuntu-24.04-arm; Docker CLI + `GITHUB_TOKEN`, no third-party actions → GHCR `main` + `sha-<short>`, label → this repo)
- [x] `docs/infra/DECISIONS.md` + `docs/infra/RUNBOOK.md` in the repo
- [ ] 👤 AWS account safety: root MFA + no keys, admin IAM user with MFA (RUNBOOK A1–A2)
- [ ] 👤 AWS Budgets USD 30 (credits excluded) + Cost Anomaly Detection USD 5; note credit balance and end date (A3)
- [ ] 👤 IAM role `hexis-ec2-role` (SSM) + security group 80/443 + emergency key pair (B1–B3)
- [ ] 👤 (Optional) Short test: launch `t4g.small` without Elastic IP, check "Free tier eligible" + Session Manager, terminate (B3b)
- [ ] 👤 EC2 `t4g.small` Ubuntu 24.04 arm64, 20 GiB gp3 encrypted, IMDSv2 + Elastic IP (B4–B5) — launch only when the image workflow is green
- [ ] 👤 Session Manager access + host setup: swap, Docker + Compose, log rotation, unattended upgrades (B6–B7)
- [ ] 👤 Namecheap: `A api → Elastic IP` (C1)
- [ ] 👤 GHCR package `hexis-ops-api` set to public after the first image build (C2)
- [ ] 👤 First deploy: clone to `/opt/hexis/app`, `infra/.env` (600, root), `docker compose up -d` (C3)
- [ ] 👤 Vercel project (root `apps/web`, Node 24.x) + `ops.hexis.fyi` + Namecheap CNAME — [`docs/infra/VERCEL.md`](./infra/VERCEL.md) (C4); `NEXT_PUBLIC_API_URL` waits for Phase 2
- [ ] 👤 Anthropic: production API key + monthly spend limit (C5)
- [ ] 👤 Activate `project` cost allocation tag; record IDs, IP and credit end date in dev-log (C6)
- [ ] 👤 Calendar reminders: 2027-03-01 credit pace check (≥ $80 left) · 2027-04-01 end-of-free-plan decision
- [x] AI guardrails installed: `AGENTS.md`, `CLAUDE.md`, `.claude/` (settings, hooks, 8 skills), `docs/ai/`
- [x] Guardrail hooks cover Bash + PowerShell; `node .claude/hooks/test-hooks.mjs` passes (99 cases)
- [x] Guardrails also confirm recursive deletes and Docker volume removal
- [x] Guardrails also confirm `ssh`, `scp` and `rsync` (+ hook test cases)
- [ ] 👤 Verify the hooks in a fresh Claude Code session (`npm --version` must be blocked in both Bash and PowerShell)
- [ ] First commit on `main` → all further work on branches
- [ ] ✅ Done: `api.hexis.fyi/health` over HTTPS from the GHCR image, port 5432 closed, `ops.hexis.fyi` placeholder, CI + image workflow green

## Phase 1 — Agent engine (backend)
- [ ] `core/engine`: scenario contract
- [ ] `core/engine`: pipeline steps + document state machine
- [ ] `core/engine`: decision rules + confidence thresholds
- [ ] `core/engine`: grounding verification
- [ ] `core/engine`: model-routing policy (default → escalation)
- [ ] `api/shared/llm`: Anthropic wrapper (structured output, tools, retries, cost accounting, mockable)
- [ ] `api/shared/db`: Kysely + migrations (scenarios, runs, documents, model_calls, proposals, review_decisions)
- [ ] Deployed stack: `DATABASE_URL` in the env schema, compose `migrate` one-shot + `dist/migrate.mjs` (Kysely custom static provider), `deploy.sh` pre-migration `pg_dump`
- [ ] Persist-before-process for every model response
- [ ] Batch runs: bounded concurrency + SSE progress + idempotency
- [ ] Mock ERP tools (`lookupProduct`, `getCurrentPrice`, `getSupplierHistory`)
- [ ] Scenario 🛒 supplier price changes + ~15 sample emails
- [ ] API endpoints: create run, stream progress, list/detail documents & proposals
- [ ] Pipeline tests with mocked model responses
- [ ] ✅ Done: sample batch via API ends in `auto_applied` / `needs_review` with evidence + cost

## Phase 2 — Operations UI (frontend)
- [ ] App shell, layout, dark mode, shared UI primitives
- [ ] Feature `runs`: new run (scenario select, paste/upload, Load sample data)
- [ ] Feature `runs`: live progress (SSE)
- [ ] Feature `review`: queue with confidence signal + reason
- [ ] Feature `review`: evidence highlighting + current vs proposed
- [ ] Feature `review`: approve / edit / reject with comment
- [ ] Feature `audit`: decision history
- [ ] Feature `costs`: spend, cost/doc, automation rate, model share
- [ ] Empty / loading / error states, responsive, basic a11y
- [ ] API CORS allow-list (`CORS_ORIGINS`, Zod-validated)
- [ ] ✅ Done: newcomer understands the product within a minute

## Phase 3 — Deploy & protect the public demo
- [ ] Production hardening: limits/healthchecks under load, rollback by `API_TAG` documented
- [ ] `infra/scripts/backup.sh` + `infra/systemd/hexis-backup.{service,timer}` + `infra/scripts/restore-test.sh`
- [ ] 👤 S3 backup bucket (private, SSE-S3, 14-day lifecycle, tagged) (RUNBOOK D1)
- [ ] 👤 Inline S3 policy on `hexis-ec2-role` limited to the bucket (D2)
- [ ] 👤 AWS CLI v2 on the host; backup timer enabled; first backup in S3 (D3–D4)
- [ ] 👤 Restore test passes (D5) — then monthly
- [ ] Precomputed cache for sample data
- [ ] Per-IP rate limit (client IP via `trustProxy`) + max input size
- [ ] Global daily spend cap → cache-only fallback
- [ ] Kill switch env flag
- [ ] Production `CORS_ORIGINS` = `https://ops.hexis.fyi` only
- [ ] Security headers on API responses
- [ ] 👤 Production `.env` protection values + deploy (D6)
- [ ] 👤 Vercel production deploy + env vars
- [ ] 👤 Replace NOT VERIFIED prices in `docs/infra/DECISIONS.md` §4 with real billing numbers
- [ ] ✅ Done: production live; simulated abuse blocked with zero spend; backup in S3 and restore test passed
- [ ] ✉️ Milestone: 2-min video + first application send-out

## Phase 4 — Trust & quality (evals)
- [ ] Eval dataset format + sample subset in repo
- [ ] Failure taxonomy
- [ ] Eval runner CLI (accuracy, cost, latency; version comparison)
- [ ] Recorded responses for CI evals + accuracy threshold gate
- [ ] Agent quality page in UI
- [ ] Prompt-injection cases + defenses verified
- [ ] ✅ Done: CI blocks accuracy regressions; quality page shows real numbers

## Phase 5 — More scenarios & personalization
- [ ] Scenario 📈 lead qualification (samples, tools, evals, cache)
- [ ] Scenario 🧾 invoice extraction (samples, tools, evals, cache)
- [ ] Scenario 🎧 support ticket triage (samples, tools, evals, cache)
- [ ] Personalized links `?scenario=<id>&for=<company>`
- [ ] ✅ Done: four scenarios end to end with evals and cache

---

## Parked
- Observability (traces, metrics, alerts)
- Portfolio polish (ADRs, case-study page, per-scenario videos)
- Infra learning track (ECS Fargate + RDS + Terraform; GCP Cloud Run)
- Automated deploys (OIDC + SSM), secrets in SSM Parameter Store, scheduled EBS snapshots, WAF / GuardDuty, IPv6-only API

## 🗓️ Decision point — 2027-04-01 (AWS Free plan ends ≈ 2027-04-19)
- [ ] 👤 Upgrade to Paid (if affordable) **or** export DB + config and run the full shutdown list (`docs/infra/DECISIONS.md` §14)
- [ ] 👤 Check in Billing → Credits how long the remaining credits last after an upgrade to Paid
- [ ] 👤 Record the decision and final numbers in `docs/dev-log.md`
