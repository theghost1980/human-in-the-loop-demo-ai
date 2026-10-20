# Hexis Ops — Project Plan

> **Human-in-the-loop AI agents for business operations.**
> An agent reads business documents, proposes actions with a confidence level, auto-applies what is safe, and routes exceptions to a human reviewer. Every decision is audited, every model call is costed, and agent quality is measured with evals.

Portfolio project by **Saturno Mangieri**. Source available under **PolyForm Noncommercial 1.0.0**.

**Naming:** *Hexis Ops* is the product name. The GitHub repository is `theghost1980/human-in-the-loop-demo-ai`; the demo is deployed on `hexis.fyi`, a domain owned by the author: `ops.hexis.fyi` (web) and `api.hexis.fyi` (API).

---

## 1. Goals

1. Show production-grade **applied AI engineering**: structured outputs, validation, deterministic verification, model routing, cost control, evals.
2. Show **product engineering**: a polished review experience that a non-technical user understands in under a minute.
3. Be **reusable across job applications**: the engine is generic; each business use case is just configuration (a "scenario").

### Non-goals

- Not a commercial product: no billing, no multi-tenancy, no real third-party integrations.
- No authentication for the public demo (protected by caching, rate limits and spend caps instead).
- No over-engineering: no microservices, no message brokers, no Kubernetes.

---

## 2. Architecture overview

```
               ops.hexis.fyi (Vercel)                      api.hexis.fyi (AWS EC2)
┌────────────────────────────────────┐        ┌──────────────────────────────────────────┐
│ Next.js + React + Tailwind         │  HTTPS │ Caddy (TLS) ──► Fastify API              │
│ features/: runs, review, audit,    │ ─────► │   features/: runs, review, audit, costs  │
│            costs, scenarios        │  SSE   │   shared/: db (Kysely), llm, config      │
└────────────────────────────────────┘ ◄───── │          │                │              │
                                              │          ▼                ▼              │
                                              │      PostgreSQL     Anthropic API        │
                                              │      (Docker)       (Haiku → Sonnet)     │
                                              └──────────────────────────────────────────┘
                        packages/core (pure TypeScript): engine + scenarios
```

### Stack

| Area | Choice |
|---|---|
| Repo | pnpm monorepo, TypeScript strict |
| Frontend | Next.js (App Router), React, Tailwind, TanStack Query |
| Backend | Fastify, Zod, Kysely |
| Database | PostgreSQL (Docker, same EC2 host) |
| AI | Anthropic SDK — a fast/cheap model by default, a stronger model for escalation (exact model IDs and prices verified in Anthropic docs at implementation time) |
| Tests | Vitest |
| CI | GitHub Actions |
| Hosting | Vercel (web), AWS EC2 `t4g.small` arm64 + Ubuntu 24.04 + Docker Compose + Caddy (api, db) in eu-north-1 |
| Delivery | GitHub Actions (arm64 runner) builds the API image → GHCR (public) → server pulls; manual one-line deploy |
| Server access | AWS Systems Manager Session Manager (no SSH port open) |
| Domain | `ops.hexis.fyi` (web), `api.hexis.fyi` (api) — DNS at Namecheap |

Infrastructure details and their rationale: [`docs/infra/DECISIONS.md`](infra/DECISIONS.md). Step-by-step setup: [`docs/infra/RUNBOOK.md`](infra/RUNBOOK.md). Web (Vercel) setup, step by step: [`docs/infra/VERCEL.md`](infra/VERCEL.md).

### Layering rules

- `packages/core` — **business logic only**, pure TypeScript. No React, no Fastify, no DB driver. Easy to unit-test.
- `apps/api` — HTTP, persistence, LLM client, orchestration. Calls `core`.
- `apps/web` — presentation only. Talks to the API; shares Zod schemas/types from `core`.
- **Vertical features** inside each app. A module used by 2+ features is promoted to `shared/` (app) or `packages/core` (business logic).

### Repository layout

```
human-in-the-loop-demo-ai/     # product name: Hexis Ops
├── apps/
│   ├── web/src/{features,shared}
│   └── api/src/{features,shared}
├── packages/
│   └── core/src/{engine,scenarios}
├── infra/                 compose.yaml, compose.dev.yaml, Caddyfile, .env.*.example, scripts/, systemd/
├── docs/                  PLAN.md, ROADMAP.md, dev-log.md, infra/ (DECISIONS, RUNBOOK), ai/ (guardrails docs, incidents log)
├── .github/workflows/     ci.yml, api-image.yml
├── .dockerignore
├── .gitattributes         LF endings everywhere (`* text=auto eol=lf`)
├── .claude/               AI guardrails: hooks, skills, settings
├── .cursor/rules/         Cursor pointer to AGENTS.md (unused today)
├── AGENTS.md              Rules for every AI agent (source of truth)
├── CLAUDE.md              Imports AGENTS.md (Claude Code)
├── .env.example
├── LICENSE                PolyForm Noncommercial 1.0.0 (official text)
└── README.md
```

---

## 3. Core concepts

### Scenario (the unit of reuse)

A scenario is configuration, not code paths:

| Part | Description |
|---|---|
| `inputSchema` | What the scenario accepts (email, CSV row, free text) |
| `outputSchema` | Zod schema the model must return |
| `prompt` | Versioned system prompt (sample version in repo, production version on server) |
| `tools` | Allow-listed functions the agent may call (mock ERP/CRM) |
| `rules` | Deterministic business rules + confidence thresholds |
| `samples` | Realistic sample documents, including tricky ones |

### Pipeline (per document)

1. **Ingest** — normalize input, store the original.
2. **Extract** — call the model with structured output and allowed tools.
3. **Persist first** — save the raw model response **before** any processing (paid work is never lost).
4. **Validate** — Zod. On failure: one retry with the validation error as context; then route to review.
5. **Verify** — deterministic check that every extracted value is grounded in the source document; ungrounded values are flagged or dropped.
6. **Decide** — rules + confidence → `auto_applied` or `needs_review`.
7. **Escalate** — low confidence from the default model → retry once with the stronger model before involving a human.
8. **Record** — tokens, estimated cost, model, latency, prompt version.

### Document states

`received → extracting → validated → auto_applied | needs_review → approved | edited | rejected` (plus `failed` with reason).

---

## 4. Phases

Each phase ends with the **close-out checklist** of the `task-closure` skill (`.claude/skills/task-closure/`, see `AGENTS.md` §6): verification, dev-log, roadmap, human actions, commit message. Working rules for AI agents live in [`AGENTS.md`](../AGENTS.md); how they are enforced is in [`docs/ai/README.md`](ai/README.md).

### Phase 0 — Foundations & cost safety

**Goal:** everything ready and protected before writing business logic.

- Monorepo scaffold (pnpm workspaces, TS strict, ESLint, Prettier, shared scripts: `typecheck`, `lint`, `test`, `dev`).
- `apps/web`, `apps/api`, `packages/core` skeletons; `GET /health` on the API.
- `LICENSE` with the **official** PolyForm Noncommercial 1.0.0 text (from polyformproject.org); README license note.
- `.gitignore` (includes `.env*` except `.env.example`, `CLAUDE.local.md`), `.env.example`, env validation with Zod.
- **AI guardrails** (`AGENTS.md`, `CLAUDE.md`, `.claude/` hooks + skills, `docs/ai/`): protected branches, secrets, dependency and cost control enforced by hooks in Bash and PowerShell; checked with `node .claude/hooks/test-hooks.mjs`.
- CI: typecheck + lint + test on every push and PR.
- First commit on `main` (scaffold); from here on, work in branches.
- **API container** (agent): multi-stage `apps/api/Dockerfile` (`node:24-bookworm-slim`, build context = repo root, every workspace `package.json` copied so the frozen install matches the lockfile, runtime as non-root `node` user, Node-based healthcheck) + root `.dockerignore`. The API is **bundled with esbuild** into `dist/server.mjs` by `apps/api/scripts/build.ts` (run with `tsx`; esbuild added only after dependency-vetting); dev keeps `tsx watch`. Env schema gains only `HOST` (`0.0.0.0` in containers); Fastify `trustProxy` on; pino JSON to stdout.
- **Image pipeline** (agent): `.github/workflows/api-image.yml` on the free `ubuntu-24.04-arm` runner, using only the Docker CLI (`login` / `build` / `push` with `GITHUB_TOKEN`, no third-party actions) → `ghcr.io/theghost1980/hexis-ops-api` tagged `main` and `sha-<short>`, labelled `org.opencontainers.image.source` → this repository; package visibility public (no secrets in the image).
- **Compose & Caddy** (agent): `infra/compose.yaml` — `caddy` (only service publishing 80/443, cert volumes), `api` (no published ports), `postgres:18` (no published ports, volume at `/var/lib/postgresql`; unused until Phase 1, it validates the volume, the memory limit and the healthcheck), healthchecks, `restart: unless-stopped`, memory limits. No service uses `env_file`: each declares only its own variables in `environment:`; non-secret constants are literals or `${VAR:-default}`, while `infra/.env` holds only secrets and per-environment values (`API_DOMAIN`, `ACME_EMAIL`, `POSTGRES_*`, future keys). `infra/compose.dev.yaml` — Postgres on `127.0.0.1:5432` for local `pnpm dev`. `infra/Caddyfile` driven by `API_DOMAIN` (`api.hexis.fyi` in prod → automatic HTTPS; `http://localhost` locally), SSE-friendly proxy. `infra/env.production.example` and `infra/env.local.example` (no leading dot: the agent guardrails block `.env.*` files), `infra/scripts/deploy.sh` (git pull → compose pull → up -d → prune; no database dump until Phase 1).
- **AWS (human, Free plan, eu-north-1):** root MFA without access keys; admin IAM user with MFA; budget USD 30/month (alerts 50/80/100 % + forecast, credits excluded); Cost Anomaly Detection (USD 5); `project=hexis-ops` tags; instance role with `AmazonSSMManagedInstanceCore`; security group 80/443 only (no SSH — access through Session Manager; emergency key pair kept in the password manager); `t4g.small` Ubuntu 24.04 arm64, 20 GiB gp3 encrypted, IMDSv2 required; Elastic IP; host setup (2 GiB swap, Docker Engine + Compose plugin from Docker's repo, Docker log rotation, unattended security upgrades with 04:00 reboot).
- **DNS (human, Namecheap):** `A api → Elastic IP` (5-min TTL during setup), `CNAME ops →` the target Vercel shows. No AAAA, no CAA.
- **First deploy (human):** `git clone` of the public repo to `/opt/hexis/app`, root-only `infra/.env` (mode 600) filled from the password manager, `docker compose up -d`.
- **Vercel (human):** Root Directory `apps/web`, Node 24.x (the default), domain `ops.hexis.fyi`; step by step in [`docs/infra/VERCEL.md`](infra/VERCEL.md). `NEXT_PUBLIC_API_URL` is added in Phase 2, when the web first calls the API.
- **Anthropic (human):** dedicated production API key, monthly spend limit set in the console.

**Done when:** `https://api.hexis.fyi/health` returns OK over HTTPS from a fresh image pulled from GHCR, port 5432 is closed from the internet, `https://ops.hexis.fyi` serves the placeholder page, CI and the image workflow are green, and the runbook steps are recorded in the dev-log.

### Phase 1 — Agent engine (backend)

**Goal:** the generic, reusable core.

- `packages/core/engine`: scenario contract, pipeline steps, decision rules, grounding verification, model-routing policy — pure and unit-tested.
- `apps/api/shared/llm`: Anthropic client wrapper (structured output, tool use, retries with backoff, token/cost accounting). Mockable.
- `apps/api/shared/db`: Kysely + migrations. Tables: `scenarios`, `runs`, `documents`, `model_calls`, `proposals`, `review_decisions`.
- **Migrations in the deployed stack:** `DATABASE_URL` joins the env schema; a one-shot `migrate` service in `infra/compose.yaml` runs `dist/migrate.mjs` (Kysely with a custom, statically imported `MigrationProvider`, so migrations are bundled); forward-only; `deploy.sh` takes a `pg_dump` before running migrations.
- Mock ERP tools for the first scenario: `lookupProduct`, `getCurrentPrice`, `getSupplierHistory`.
- Batch runs: bounded concurrency, SSE progress, **idempotency** (same document twice ⇒ no duplicate effects).
- **First scenario: 🛒 Supplier price changes** (retail/supply chain) with ~15 realistic sample emails (clean, ambiguous, malformed, multi-item, one prompt-injection attempt).
- Endpoints: create run, stream run progress, list documents/proposals, get document detail.

**Done when:** a sample batch can be run via the API; each document ends in `auto_applied` or `needs_review` with evidence and cost stored; pipeline tests pass with mocked model responses.

### Phase 2 — Operations UI (frontend)

**Goal:** feels like a real product.

- **New run:** choose scenario, paste/upload documents, or **Load sample data**.
- **Live run:** per-document progress via SSE.
- **Review queue** (hero screen): confidence signal (high/medium/low) + reason; **evidence highlighting** in the source document; current vs proposed values; approve / edit / reject with comment.
- **Audit history:** who decided what and when, with versions.
- **Cost & performance panel:** total spend, cost per document, automation rate, default vs escalated model share.
- Quality bar: responsive, dark mode, empty/loading/error states, basic accessibility.
- **API CORS:** `CORS_ORIGINS` allow-list (Zod-validated) as soon as the browser calls the API; `http://localhost:3000` only in development.

**Done when:** someone with no context opens the app, clicks *Load sample data* and understands the product within a minute.

### Phase 3 — Deploy & protect the public demo

**Goal:** online, safe, and impossible to drain the credits.

- **Production hardening of the deployed stack:** verified restart policies, healthchecks and memory limits under load; pino JSON logs with Docker log rotation; rollback by `API_TAG=sha-<short>`.
- **Backups:** S3 bucket (Block Public Access, SSE-S3, 14-day lifecycle, `project=hexis-ops`); instance role gets an inline policy limited to that bucket; AWS CLI v2 on the host; daily systemd timer runs `infra/scripts/backup.sh` (`pg_dump -Fc` → S3); `infra/scripts/restore-test.sh` restores the latest dump into a throwaway container — run once at setup and monthly. No scheduled EBS snapshots (host is reproducible); one manual snapshot only before risky host changes.
- **Credit protection:**
  - Sample data served from **precomputed cached results** (zero model cost).
  - Custom input: **per-IP rate limit** (correct client IP via `trustProxy` behind Caddy), **global daily spend cap** enforced in the app (falls back to cache-only mode when reached), max input size.
  - **Kill switch** env flag to disable model calls instantly.
- **Web:** Vercel production deploy with `NEXT_PUBLIC_API_URL=https://api.hexis.fyi`; production `CORS_ORIGINS` = `https://ops.hexis.fyi` only (previews not allowed against the production API).
- **Security headers** on API responses; re-check the Phase 0 security baseline (DECISIONS.md §15).
- **Cost review:** replace every NOT VERIFIED price in DECISIONS.md §4 with real numbers from the bill; confirm credits will last to the decision point.

**Done when:** both domains work in production, a simulated abuse burst is blocked without spending credits, a backup exists in S3 and the restore test passes.

**✉️ Milestone — first application send-out (e.g., Duvo):** 2-minute video (problem → demo → one design decision), link with the retail scenario preselected.

### Phase 4 — Trust & quality (evals)

**Goal:** prove the agent can be measured and improved.

- Eval dataset per scenario (20–30 cases, expected outputs, hard cases included). Sample subset in repo; full set server-side.
- **Failure taxonomy:** wrong field, fabricated value, miscalibrated confidence, wrong action, injection followed.
- Eval runner CLI: compare prompt/model versions → accuracy, cost, latency.
- **Agent quality page** in the UI: latest results and trend across versions.
- Evals in CI using **recorded model responses** (no credit spend); live evals run manually only, in scripts ending in `:live` (e.g. `eval:live`), which the guardrail hooks block unless the human enables them.
- AI security: document content treated strictly as data, allow-listed tools, outputs validated before any action, injection cases in the dataset.

**Done when:** CI fails if a change lowers accuracy below the threshold; the quality page shows real numbers.

### Phase 5 — More scenarios & personalization

**Goal:** one demo, many job applications.

- 📈 **Lead qualification** (sales/SaaS)
- 🧾 **Invoice extraction** (fintech/accounting)
- 🎧 **Support ticket triage** (B2B SaaS)
- Each with sample data, mock tools, eval set and precomputed cache.
- **Personalized links:** `ops.hexis.fyi/?scenario=<id>&for=<company>` opens the right scenario with a subtle welcome line.
- In the demo walkthrough, show live scenario switching to explain: *"the engine is generic; each use case is configuration."*

**Done when:** all four scenarios work end to end with evals and cache.

---

## 5. Budget & credits

| Resource | Credit | Planned use |
|---|---|---|
| AWS | $200 (Free plan) | `t4g.small` + 20 GiB gp3 + Elastic IP + S3 backups ≈ **$18/month** (prices partly NOT VERIFIED, see `docs/infra/DECISIONS.md` §4) ≈ $110 over 6 months |
| Anthropic API | $100 | Development and manual live evals, mostly on the cheaper model; public demo near-zero via cache + caps |
| Vercel | Free tier | Frontend |
| GitHub | Free (public repo) | CI and arm64 image builds; GHCR public package |
| Domain | Owned | `hexis.fyi` (renews May 2027) |

**AWS Free plan timeline.** On 2026-10-20 the plan had 181 days left → it ends ≈ **2027-04-19** (or earlier if credits run out). The Free plan cannot generate charges: at the end the account is **suspended** (data kept 90 days, then erased) unless upgraded to Paid, which keeps the remaining credits.

**Demo lifetime:** until hired. **🗓️ Decision point 2027-04-01:** either upgrade to Paid (if the verified monthly cost is affordable; check in Billing → Credits how long the remaining credits last afterwards) or export the database and configuration, run the full shutdown list (`docs/infra/DECISIONS.md` §14) and document it in the dev-log. Credit pace target: ≥ $80 left on 2027-03-01.

---

## 6. Licensing & what stays private

- Repo is **public** for evaluation; licensed **PolyForm Noncommercial 1.0.0** (view, run locally, evaluate; no commercial use).
- **Never in the repo:** secrets, production config, production prompts, full eval datasets, cached production results.
- **In the repo:** full source, sample prompts and sample data sufficient to run locally.

---

## 7. Parked for later (not in scope now)

- Observability (trace views, metrics, alerts)
- Portfolio polish (ADRs, case-study page, per-scenario videos)
- Infra learning track (ECS Fargate + RDS + Terraform; GCP Cloud Run variant)
- Automated deploys from GitHub Actions (OIDC + SSM send-command)
- Secrets in SSM Parameter Store instead of a hand-written `.env`
- Scheduled EBS snapshots (Data Lifecycle Manager), WAF, GuardDuty/Security Hub, centralized logging
- IPv6-only API to avoid the public IPv4 charge
