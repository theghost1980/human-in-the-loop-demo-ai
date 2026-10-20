# Hexis Ops — Project Plan

> **Human-in-the-loop AI agents for business operations.**
> An agent reads business documents, proposes actions with a confidence level, auto-applies what is safe, and routes exceptions to a human reviewer. Every decision is audited, every model call is costed, and agent quality is measured with evals.

Portfolio project by **Saturno Mangieri**. Source available under **PolyForm Noncommercial 1.0.0**.

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
| Hosting | Vercel (web), AWS EC2 + Docker Compose + Caddy (api, db) |
| Domain | `ops.hexis.fyi` (web), `api.hexis.fyi` (api) — DNS at Namecheap |

### Layering rules

- `packages/core` — **business logic only**, pure TypeScript. No React, no Fastify, no DB driver. Easy to unit-test.
- `apps/api` — HTTP, persistence, LLM client, orchestration. Calls `core`.
- `apps/web` — presentation only. Talks to the API; shares Zod schemas/types from `core`.
- **Vertical features** inside each app. A module used by 2+ features is promoted to `shared/` (app) or `packages/core` (business logic).

### Repository layout

```
hexis-ops/
├── apps/
│   ├── web/src/{features,shared}
│   └── api/src/{features,shared}
├── packages/
│   └── core/src/{engine,scenarios}
├── infra/                 docker-compose.yml, Caddyfile, deploy notes
├── docs/                  PLAN.md, ROADMAP.md, dev-log.md, ai/ (guardrails docs, incidents log)
├── .github/workflows/     ci.yml
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
- **AWS (human):** budget alert, credits expiry check, EC2 (small instance), Elastic IP, security group (80/443 public, 22 own IP only), Docker + Compose installed.
- **Anthropic (human):** dedicated API key for this project, monthly spend limit set in the console.
- **DNS (human, Namecheap):** `A api → Elastic IP`, `CNAME ops → Vercel`.
- `infra/docker-compose.yml` (api, postgres, caddy) + `Caddyfile`.
- First commit on `main` (scaffold); from here on, work in branches.

**Done when:** `https://api.hexis.fyi/health` returns OK over HTTPS, `https://ops.hexis.fyi` serves a placeholder page, CI is green.

### Phase 1 — Agent engine (backend)

**Goal:** the generic, reusable core.

- `packages/core/engine`: scenario contract, pipeline steps, decision rules, grounding verification, model-routing policy — pure and unit-tested.
- `apps/api/shared/llm`: Anthropic client wrapper (structured output, tool use, retries with backoff, token/cost accounting). Mockable.
- `apps/api/shared/db`: Kysely + migrations. Tables: `scenarios`, `runs`, `documents`, `model_calls`, `proposals`, `review_decisions`.
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

**Done when:** someone with no context opens the app, clicks *Load sample data* and understands the product within a minute.

### Phase 3 — Deploy & protect the public demo

**Goal:** online, safe, and impossible to drain the credits.

- Production Docker Compose: restart policies, health checks, structured logs (pino).
- Daily Postgres backup to S3.
- **Credit protection:**
  - Sample data served from **precomputed cached results** (zero model cost).
  - Custom input: **per-IP rate limit**, **global daily spend cap** enforced in the app (falls back to cache-only mode when reached), max input size.
  - **Kill switch** env flag to disable model calls instantly.
- Vercel production deploy with `NEXT_PUBLIC_API_URL=https://api.hexis.fyi`; CORS locked to `ops.hexis.fyi`.

**Done when:** both domains work in production, and a simulated abuse burst is blocked without spending credits.

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
| AWS | $200 | Small EC2 + S3 backups; budget alert set in Phase 0 |
| Anthropic API | $100 | Development and manual live evals, mostly on the cheaper model; public demo near-zero via cache + caps |
| Vercel | Free tier | Frontend |
| Domain | Owned | `hexis.fyi` (renews May 2027) |

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
