# Hexis Ops — Roadmap

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · 👤 = action for the human dev
Details for every item live in [`PLAN.md`](./PLAN.md). Update this file at the close of each item.

---

## Phase 0 — Foundations & cost safety
- [x] pnpm monorepo scaffold (TS strict, ESLint, Prettier, root scripts)
- [x] `apps/web`, `apps/api`, `packages/core` skeletons
- [x] `GET /health` endpoint
- [x] `.gitignore`, `.env.example`, env validation with Zod
- [x] `LICENSE` (official PolyForm Noncommercial 1.0.0 text) + README license note
- [ ] CI workflow: typecheck + lint + test
- [ ] `infra/docker-compose.yml` (api, postgres, caddy) + `Caddyfile`
- [ ] 👤 AWS: budget alert, credits expiry, EC2, Elastic IP, security group, Docker
- [ ] 👤 Anthropic: project API key + monthly spend limit
- [ ] 👤 Namecheap DNS: `api` A record, `ops` CNAME
- [ ] 👤 Vercel project linked to `apps/web`
- [x] AI guardrails installed: `AGENTS.md`, `CLAUDE.md`, `.claude/` (settings, hooks, 8 skills), `docs/ai/`
- [x] Guardrail hooks cover Bash + PowerShell; `node .claude/hooks/test-hooks.mjs` passes (99 cases)
- [x] Guardrails also confirm recursive deletes and Docker volume removal
- [ ] 👤 Verify the hooks in a fresh Claude Code session (`npm --version` must be blocked in both Bash and PowerShell)
- [ ] First commit on `main` → all further work on branches
- [ ] ✅ Done: `api.hexis.fyi/health` over HTTPS, `ops.hexis.fyi` placeholder, CI green

## Phase 1 — Agent engine (backend)
- [ ] `core/engine`: scenario contract
- [ ] `core/engine`: pipeline steps + document state machine
- [ ] `core/engine`: decision rules + confidence thresholds
- [ ] `core/engine`: grounding verification
- [ ] `core/engine`: model-routing policy (default → escalation)
- [ ] `api/shared/llm`: Anthropic wrapper (structured output, tools, retries, cost accounting, mockable)
- [ ] `api/shared/db`: Kysely + migrations (scenarios, runs, documents, model_calls, proposals, review_decisions)
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
- [ ] ✅ Done: newcomer understands the product within a minute

## Phase 3 — Deploy & protect the public demo
- [ ] Production Compose: restart policies, health checks, pino logs
- [ ] Daily Postgres backup to S3
- [ ] Precomputed cache for sample data
- [ ] Per-IP rate limit + max input size
- [ ] Global daily spend cap → cache-only fallback
- [ ] Kill switch env flag
- [ ] CORS locked to `ops.hexis.fyi`
- [ ] 👤 Vercel production deploy + env vars
- [ ] ✅ Done: production live; simulated abuse blocked with zero spend
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
