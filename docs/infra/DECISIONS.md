# Hexis Ops — Infrastructure decisions (Phase 0 & Phase 3)

Scope: everything needed to go from an empty AWS account to `https://api.hexis.fyi/health` (Phase 0) and a protected production demo (Phase 3). Nothing beyond that.

Conventions in this document:
- **NOT VERIFIED** = a value or detail I could not confirm in official docs; the line says how to check it. Do not treat it as fact.
- Commands: **PowerShell** = your Windows PC · **bash** = the server (via Session Manager).
- Step-by-step execution lives in [`RUNBOOK.md`](./RUNBOOK.md). This file explains the *why*.

---

## 0. Fixed context (already decided)

| Item | Value |
|---|---|
| AWS account | **Free plan**, region **eu-north-1** (Stockholm) |
| Credits | USD 200 · **181 days remaining on 2026-10-20 → plan ends ≈ 2027-04-19** |
| Free plan behaviour | Usage is paid from credits; the account **cannot incur charges**. When the plan ends (6 months or credits exhausted, whichever first) AWS **suspends the account**, keeps data **90 days**, then erases it. Upgrading to Paid keeps remaining credits. Source: [AWS Free Tier FAQs](https://aws.amazon.com/free/faqs/) |
| Demo lifetime | Until hired. Re-evaluated at the **end-of-free-plan decision point** (see §14) |
| Spend after credits | Decide at the decision point: upgrade to Paid if affordable, otherwise export and shut down, documenting everything |
| Topology | One EC2 host with Docker Compose (api + postgres + caddy). No RDS/ECS/Terraform (parked) |
| Domains | `ops.hexis.fyi` → Vercel · `api.hexis.fyi` → EC2 · DNS at Namecheap |
| Naming | **Hexis Ops** is the product name. The repository is `theghost1980/human-in-the-loop-demo-ai` (not renamed). The demo is deployed on `hexis.fyi`, a domain owned by the author. |

**Important consequence:** exhausting the credits early also suspends the account (and the demo). The budget alerts in §14 exist to stop that, not to stop a bill.

---

## 1. Dockerfile for the API (pnpm monorepo, `core` as source)

**Decision:** `apps/api/Dockerfile`, multi-stage, build context = **repo root**.

1. `base` — `node:24-bookworm-slim`; enable pnpm through Corepack using the `packageManager` field of the root `package.json`.
2. `build` — copy `pnpm-lock.yaml`, `pnpm-workspace.yaml`, the root `package.json` and **every workspace `package.json`** (`apps/api`, `apps/web`, `packages/core`) first (layer cache), then `pnpm install --frozen-lockfile --filter @hexis/api...`; then copy the sources of `apps/api` and `packages/core` and run the API build (esbuild bundle, see §2). The bundle inlines `packages/core` because it is imported as TypeScript source.
3. `runtime` — fresh `node:24-bookworm-slim`, `NODE_ENV=production`, copy only `apps/api/dist/`, run as the built-in **`node`** user (non-root), `EXPOSE 3001`, `HEALTHCHECK` using Node's `fetch` (the slim image has no curl).

`.dockerignore` (repo root): `node_modules`, `**/node_modules`, `.git`, `.github`, `apps/web/*` followed by `!apps/web/package.json`, `**/.next`, `docs`, `infra`, `coverage`, `**/dist`, `.env*` (keep `!.env.example`), `private`, `.claude`, `*.log`.

**Why:** smallest runtime (no pnpm, no dev deps, no sources), non-root, reproducible from the lockfile. Debian-slim (glibc) avoids musl surprises with native modules. The lockfile has an importer for `apps/web`; copying every workspace manifest (and keeping `apps/web/package.json` through `.dockerignore`) keeps the frozen install consistent with the workspace.

**`pnpm fetch` + `pnpm install --offline` (valued, not adopted for now):** pnpm's Docker guide shows `pnpm fetch --prod` after copying only the lockfile, but its monorepo example uses a plain frozen install, and I could not confirm in the guide the combination with `--offline` and `--filter`. Here it would also download the `apps/web` dependencies (Next.js, React) into the build stage, and GitHub runners start every build with an empty layer cache, so the caching benefit is nil in CI. Revisit only if local rebuilds become slow.

**Discarded:** Alpine base (musl edge cases, small gain); single-stage image (ships dev deps and sources); `pnpm deploy` into the runtime image (more moving parts than a bundle).

**Verify:**
- Build with `apps/web` excluded from the context: `docker build -f apps/api/Dockerfile -t hexis-ops-api .` must pass the frozen install (**NOT VERIFIED** until built).
- Image size after a local build: `docker images hexis-ops-api` → expect a few hundred MB, dominated by the Node base image (**NOT VERIFIED** exact size; measure it).
- Non-root: `docker run --rm --entrypoint id hexis-ops-api` → `uid=1000(node)`.
- Corepack ships with Node 24 (it was announced to be removed from Node in later majors): verified locally on Node 24.12; **NOT VERIFIED** inside the image — run `docker run --rm node:24-bookworm-slim corepack --version`. If missing, install pnpm in the build stage with the exact version pinned in `packageManager`.
- Docs: [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/), [pnpm + Docker](https://pnpm.io/docker), [Node official image](https://hub.docker.com/_/node).

---

## 2. How the API runs in production

**Decision:** **bundle with esbuild** into `apps/api/dist/server.mjs` (`dist/migrate.mjs` joins it in Phase 1, see §7), ESM, `platform=node`, target Node 24, all dependencies bundled except optional natives (e.g. `pg-native`), with a `createRequire` banner so bundled CommonJS packages work in ESM. Run with `node dist/server.mjs`. Development keeps `tsx watch`.

The build lives in a small `apps/api/scripts/build.ts`, run with `tsx` (cross-platform, no shell quoting issues on Windows; being TypeScript, it stays inside the typecheck and ESLint setup).

**Why:** one file, no `node_modules` in the image, lower memory and faster start than compiling TypeScript at boot, and missing imports fail at build time instead of at runtime.

**Discarded:**
- `tsx` in production: needs the whole workspace and dev dependencies inside the image; compiles on every boot.
- Node's built-in type stripping: only supports erasable TypeScript syntax and has extra rules for imports and `node_modules`; too fragile for a monorepo that imports `core` as source.

**Dependency note:** `esbuild` becomes a direct `devDependency` of `apps/api` → run the **dependency-vetting** skill before adding it (it is already a transitive dependency of `tsx`).

**Code requirements for the agent:**
- Listen on `HOST` (default `0.0.0.0` in the container; Fastify's default is `127.0.0.1`, unreachable from Caddy). Add `HOST` to the Zod env schema; it is the only new variable in Phase 0 (`DATABASE_URL` arrives in Phase 1, `CORS_ORIGINS` in Phase 2).
- Fastify logger (pino) writes JSON to stdout; no `pino-pretty` in production.
- `trustProxy: true` (behind Caddy) so the client IP is correct for per-IP rate limits (Phase 3).

**Verify:** `node apps/api/dist/server.mjs` locally, then `Invoke-RestMethod http://localhost:3001/health` → `status : ok`. Docs: [esbuild API](https://esbuild.github.io/api/), [Fastify listen options](https://fastify.dev/docs/latest/Reference/Server/).

---

## 3. How the code reaches EC2

**Decision: (B) build in GitHub Actions → push to GHCR → the server pulls.**

- Workflow `.github/workflows/api-image.yml`: on push to `main` (paths: `apps/api/**`, `packages/core/**`, `pnpm-lock.yaml`, `apps/api/Dockerfile`, `.dockerignore`) and `workflow_dispatch`.
- Runs on **`ubuntu-24.04-arm`** (native arm64, free for public repos — [GitHub changelog, GA 2025-08-07](https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/)), so no QEMU emulation.
- Uses **only the Docker CLI** that the runner image already includes (the arm64 Ubuntu 24.04 runner image lists Docker and Buildx): `docker login ghcr.io` with the workflow's `GITHUB_TOKEN`, then `docker build` and `docker push`. Permissions: `contents: read` and `packages: write`. The only action is `actions/checkout`, pinned by commit SHA exactly as in `ci.yml`.
- Image `ghcr.io/theghost1980/hexis-ops-api`, tags `main` and `sha-<short>`. The image carries the label `org.opencontainers.image.source=https://github.com/theghost1980/human-in-the-loop-demo-ai`, which links the package to this repository (the image name follows the product, the repository keeps its own name).
- Package visibility **public** (the repo is public; the image contains no secrets) → the server pulls without credentials.
- **NOT VERIFIED:** that the workflow's `GITHUB_TOKEN` can create the package on the first push (personal account). Fallback, in order: (1) GitHub → Packages → `hexis-ops-api` → Package settings → **Manage Actions access** → add this repository with role **Write** (this page exists only once the package exists); (2) if it still fails, a personal access token with only `write:packages`, stored as a repository secret and used for `docker login` instead of `GITHUB_TOKEN`.
- Infra files (`infra/`) reach the server with a read-only `git clone` of `https://github.com/theghost1980/human-in-the-loop-demo-ai.git`; deploy = `git pull` + `docker compose pull` + `up -d` (script `infra/scripts/deploy.sh`).

**Why:** builds are free and reproducible, the 2 GiB server never compiles anything, and rollback is just running an older `sha-` tag. Three CLI commands add less supply-chain surface than third-party Docker actions.

**Discarded:**
- (A) build on the instance: `pnpm install` for a monorepo with Next.js can exhaust 2 GiB RAM; slow; mixes build and runtime.
- (C) build on your PC and copy: your PC is x86, the server is ARM → emulated cross-build (slow), manual and not reproducible.
- Third-party Docker actions (`docker/login-action`, `docker/build-push-action`, …): extra code to trust for three commands.
- Automatic deploy from Actions (SSH or SSM send-command with OIDC): more IAM and secrets; **parked**. Deploy stays a manual one-liner.

**Verify:** after the first run, `docker manifest inspect ghcr.io/theghost1980/hexis-ops-api:main` on the server shows `arm64`, and the package page links to the repository. Docs: [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

---

## 4. Instance, architecture, disk and monthly cost

**Decision:** **`t4g.small`** (Graviton, **arm64**, 2 vCPU, 2 GiB RAM) · **20 GiB gp3**, encrypted, delete on termination · 2 GiB swap file.

**Why:** `t4g.small` is on the Free-plan eligible list for accounts created after 2025-07-15 (`t3.micro`, `t3.small`, `t4g.micro`, `t4g.small`, `c7i-flex.large`, `m7i-flex.large` — [EC2 docs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html)). 2 GiB fits Postgres + Node + Caddy; `t4g.micro` (1 GiB) would rely on swap.

**Discarded:** `t3.small` (x86, typically pricier per hour than t4g — NOT VERIFIED for eu-north-1); `t4g.micro` (too little RAM); `c7i-flex`/`m7i-flex.large` (more than needed, burns credits faster).

**Monthly cost formula** (730 h/month):

| Item | Formula | Estimate | Status |
|---|---|---|---|
| EC2 `t4g.small` | hourly price × 730 | ≈ USD 12 (≈ 0.0168 USD/h) | **NOT VERIFIED for eu-north-1** — the figure found is not region-specific |
| EBS gp3 20 GiB | GiB × price per GiB-month | ≈ USD 2 | **NOT VERIFIED** for eu-north-1 |
| Public IPv4 (Elastic IP, attached) | 0.005 USD/h × 730 | ≈ USD 3.65 | Verified by you on AWS pages |
| S3 backups (Phase 3, < 1 GiB) | GiB × price | < USD 0.10 | NOT VERIFIED (negligible) |
| Data transfer out | GB × price beyond any free allowance | ≈ USD 0 at demo traffic | **NOT VERIFIED** whether the 100 GB/month free egress applies on the Free plan |
| **Total** | | **≈ USD 18/month → ≈ USD 110 over 6 months** | Fits the USD 200 credit |

**Verify before launching:** [AWS Pricing Calculator](https://calculator.aws/) → EC2, region *Europe (Stockholm)*, `t4g.small`, Linux, On-Demand; EBS gp3 20 GiB; and [EC2 On-Demand pricing](https://aws.amazon.com/ec2/pricing/on-demand/) (data transfer section). Update this table with real numbers.

---

## 5. Server access, IAM and root hygiene

**Decision:** **AWS Systems Manager Session Manager** from the browser (EC2 → Connect → Session Manager). **Port 22 closed.** A key pair is still created at launch and stored in your password manager as an emergency fallback (you would open 22 to your IP temporarily).

IAM:
- **Root user:** MFA on, **no access keys**, used only for account/billing tasks.
- **Admin IAM user** `saturno-admin`: console access, MFA, `AdministratorAccess`, **no access keys** (you do not need the AWS CLI on your PC for this plan).
- **Instance role** `hexis-ec2-role` (instance profile): managed policy `AmazonSSMManagedInstanceCore`. In Phase 3, add an inline policy limited to the backup bucket (§13).

**Why:** your home IP is dynamic, so an IP-restricted port 22 breaks regularly; Session Manager needs no inbound port, no keys to rotate, and logs sessions.

**Discarded:** SSH with port 22 open to "My IP" (breaks with a dynamic IP; temptation to open 0.0.0.0/0); IAM Identity Center (better at scale, unnecessary setup for a solo account).

**Verify:** EC2 → instance → Connect → *Session Manager* tab shows "Connect" enabled (may take a few minutes after launch). In the session: `whoami` → `ssm-user`. **NOT VERIFIED:** that the Free plan allows Systems Manager without restriction — if Connect is unavailable, check the Free plan restrictions on the [Free Tier page](https://aws.amazon.com/free/). Docs: [Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html), [IAM root user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html).

---

## 6. Operating system and host setup

**Decision:** **Ubuntu Server 24.04 LTS (arm64)**.

- Docker Engine + Compose plugin from **Docker's official apt repository** (packages `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, `docker-compose-plugin`).
- **2 GiB swap file**.
- Docker log rotation in `/etc/docker/daemon.json`: `{"log-driver": "local", "log-opts": {"max-size": "10m", "max-file": "3"}}`.
- **unattended-upgrades** (enabled by default on Ubuntu for security updates) with automatic reboot at 04:00 if a reboot is required; containers come back via `restart: unless-stopped` and the Docker service enabled at boot.
- **No ufw.** The EC2 **security group** is the firewall (Docker-published ports bypass ufw anyway — see §7).

**Why Ubuntu over Amazon Linux 2023:** Docker's official repo ships the Compose plugin for Ubuntu; on AL2023 the Compose plugin must be installed manually. Ubuntu AMIs also include the SSM agent (snap) — **NOT VERIFIED for the exact AMI you pick:** check with `snap list amazon-ssm-agent`.

**Verify:** `uname -m` → `aarch64` · `docker compose version` → `Docker Compose version v2.x` · `free -h` → `Swap: 2.0Gi` · `systemctl is-enabled unattended-upgrades` → `enabled`. Docs: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Docker local logging driver](https://docs.docker.com/engine/logging/drivers/local/), [Ubuntu automatic updates](https://ubuntu.com/server/docs/package-management).

---

## 7. Compose design and Postgres

**Decision:** two files in `infra/`.

**`infra/compose.yaml` (production stack, Phase 0):**

| Service | Image | Published ports | Notes |
|---|---|---|---|
| `caddy` | `caddy:2` (pin a minor once verified) | `80:80`, `443:443` | Only service with published ports. `environment`: `API_DOMAIN=${API_DOMAIN}`, `ACME_EMAIL=${ACME_EMAIL}` (per-environment values, from `infra/.env`). Volumes `caddy_data:/data`, `caddy_config:/config`, `./Caddyfile:/etc/caddy/Caddyfile:ro` |
| `api` | `ghcr.io/theghost1980/hexis-ops-api:${API_TAG:-main}` (+ `build:` for local builds) | none (`expose: 3001`) | `environment`: `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=${PORT:-3001}` (literals and a default, not in `.env`). Healthcheck on `/health` |
| `postgres` | `postgres:18` | **none** | `environment`: `POSTGRES_USER=${POSTGRES_USER}`, `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`, `POSTGRES_DB=${POSTGRES_DB}` (from `infra/.env`). Volume `pgdata:/var/lib/postgresql` (**Postgres 18 images changed the data path**; do not mount `/var/lib/postgresql/data`), healthcheck `pg_isready`. Nothing uses it yet in Phase 0: it is there to validate the volume, the memory limit and the healthcheck |

Common: one default bridge network; `restart: unless-stopped`; `mem_limit` caddy 128m, api 512m, postgres 512m.

**Secrets and environment:** **no service uses `env_file`.** Each service declares in `environment:` only what it needs. Non-secret constants are literals or carry a default in Compose (`NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=${PORT:-3001}`). Secrets and per-environment values are written as `${VAR}` and come from `infra/.env` (on the server) or from `--env-file infra/.env.local` (local smoke test): `API_DOMAIN`, `ACME_EMAIL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and any future key. So `infra/.env` holds only secrets and per-environment values, and each of them reaches only the container that needs it — never the internet-facing Caddy. No literal secret values in the repo.

**`infra/compose.dev.yaml` (local):** `postgres` only, published as `127.0.0.1:5432:5432` (loopback only).

**Docker vs firewall:** ports published by Docker bypass host firewalls like ufw ([Docker packet filtering docs](https://docs.docker.com/engine/network/packet-filtering-firewalls/)). Protection here = (1) only Caddy publishes ports, (2) the security group allows only 80/443.

**Postgres version policy:** pin the **major** (`postgres:18`), take minor updates on deploy (`docker compose pull`). Major upgrades are a deliberate task (dump → new major → restore). Docs: [postgres image](https://hub.docker.com/_/postgres) (check the PGDATA note for 18+).

**Migrations (Phase 1, not Phase 0):** there is no schema and no Kysely yet. In Phase 1 the stack gains a one-shot `migrate` service (same image, `command: node dist/migrate.mjs`, `restart: "no"`, `depends_on: postgres (healthy)`; `api` then depends on it with `completed_successfully`) and `DATABASE_URL` joins the env schema. Migrations are forward-only in production and use Kysely's `Migrator` with a **custom `MigrationProvider` that imports the migrations in code** (Kysely ships `FileMigrationProvider`, which reads a folder and would not find `.ts` files inside a bundle), so they end up in `dist/migrate.mjs`. From Phase 1, `deploy.sh` takes a `pg_dump` **before** running migrations. Docs: [Kysely migrations](https://kysely.dev/docs/migrations).

**Verify (Phase 0):** `docker compose ps` → `caddy`, `api`, `postgres` *healthy/running*. From the PC: `Test-NetConnection api.hexis.fyi -Port 5432` → `TcpTestSucceeded : False`. Secrets isolation, on the server: `sudo docker compose exec caddy env | grep -c POSTGRES` → `0`.

---

## 8. Caddy

**Decision:** `infra/Caddyfile`:

```caddyfile
{
	email {$ACME_EMAIL}
}

{$API_DOMAIN} {
	encode zstd gzip
	reverse_proxy api:3001 {
		flush_interval -1
	}
	header -Server
}
```

- **Production:** `API_DOMAIN=api.hexis.fyi` → automatic HTTPS (Let's Encrypt; ZeroSSL fallback).
- **Local:** `API_DOMAIN=http://localhost` → the `http://` scheme turns automatic HTTPS off.
- `API_DOMAIN` and `ACME_EMAIL` reach the `caddy` container through its own `environment:` entries (see §7); it receives no other variable.
- `flush_interval -1` keeps SSE streaming immediately (Caddy also flushes `text/event-stream` responses on its own — **NOT VERIFIED** for your version; the explicit setting is harmless).
- **Certificates persist** in the `caddy_data` volume. Never delete it casually: re-issuing repeatedly can hit Let's Encrypt rate limits.

**DNS requirements for the certificate:** the `A` record `api` must already resolve to the Elastic IP, and ports 80 and 443 must be reachable from the internet **before** the first `up`. No CAA record (with none, any CA may issue; a CAA limited to Let's Encrypt would block the ZeroSSL fallback). No AAAA record (the instance has no IPv6).

**Verify:** `docker compose logs caddy | grep -i "certificate obtained"` · PowerShell `Invoke-RestMethod https://api.hexis.fyi/health` → `status : ok`. Docs: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Caddy Docker image](https://hub.docker.com/_/caddy).

---

## 9. Local flow on Windows 11 (Docker Desktop + WSL2)

**Decision:**
- **Daily development:** only Postgres in Docker — `docker compose -f infra/compose.dev.yaml up -d` — and `pnpm dev` for API (`tsx watch`) and web (`next dev`) on Windows.
- **Production smoke test (occasional, before a release):** `docker compose -f infra/compose.yaml --env-file infra/.env.local up --build` with `API_DOMAIN=http://localhost` (copy `infra/env.local.example` to `infra/.env.local` first) → `Invoke-RestMethod http://localhost/health`. Locally this builds an amd64 image; that is fine (the server gets arm64 from CI).
- **`.gitattributes`** (`* text=auto eol=lf`) is already in the repo: LF everywhere, which keeps shell scripts, `Caddyfile`, YAML and `Dockerfile` valid on Linux even when edited on Windows.

**Why not profiles:** two small files are easier to read than one file with profiles; the dev file never risks publishing ports in production.

**Verify:** `docker compose -f infra/compose.dev.yaml ps` → `postgres ... (healthy)`. Docs: [Docker Desktop WSL2 backend](https://docs.docker.com/desktop/features/wsl/).

---

## 10. Secrets on the server

**Decision:**
- Repo ships **`infra/env.production.example`** (keys only, no values; only secrets and per-environment values: `API_DOMAIN`, `ACME_EMAIL`, `POSTGRES_*`, future keys). It is named without the leading dot on purpose: the agent guardrails block every `.env.*` file, and the real file on the server is `infra/.env`.
- On the server, inside a Session Manager session:
  ```bash
  sudo install -m 600 -o root -g root /dev/null /opt/hexis/app/infra/.env
  sudo nano /opt/hexis/app/infra/.env
  ```
  Paste values from your **password manager**. Generate the DB password on the server: `openssl rand -base64 32`. Paste the Anthropic key directly from the Anthropic console.
- The password manager is the only copy outside the server. Never in the repo, chats, issues or screenshots.

**Why:** zero extra services; Session Manager is an encrypted channel; the file is root-only.

**Discarded (parked):** SSM Parameter Store SecureString + a script that renders `.env` (nicer rebuilds, more IAM).

**Verify:** `sudo stat -c '%a %U' /opt/hexis/app/infra/.env` → `600 root` · `git -C /opt/hexis/app status --ignored` lists `infra/.env` as ignored.

---

## 11. Vercel with a pnpm monorepo

**Decision (dashboard only — the Vercel CLI is blocked for agents):**
- Import the GitHub repo → **Root Directory: `apps/web`** → Framework preset: Next.js (auto).
- Install/build: leave defaults; Vercel detects pnpm from the root lockfile and installs the workspace. Keep "Include files outside the Root Directory" enabled (needed for `packages/core`).
- **Node.js version:** 24.x in Project Settings (must satisfy `engines`).
- **Env vars:** `NEXT_PUBLIC_API_URL=https://api.hexis.fyi` (Production). For Preview, the same value (or leave unset and use mock mode).
- **Domain:** add `ops.hexis.fyi`; Vercel shows the exact CNAME target to create in Namecheap.
- **CORS (API, from Phase 2):** the Phase 0 placeholder makes no API calls, so `CORS_ORIGINS` is introduced when the UI first calls the API (Phase 2). Production value `https://ops.hexis.fyi` (comma list; add `http://localhost:3000` only in dev). Preview deployments are **not** allowed against the production API by default.

**Verify:** the deployment log shows pnpm installing at the repo root; `https://ops.hexis.fyi` loads; a request from another origin to the API gets no `Access-Control-Allow-Origin`. Docs: [Vercel monorepos](https://vercel.com/docs/monorepos), [Node.js version](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

---

## 12. DNS at Namecheap

**Decision (Domain List → hexis.fyi → Advanced DNS):**

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `api` | Elastic IP | 5 min while setting up, then Automatic |
| CNAME | `ops` | target shown by Vercel (do not guess it) | Automatic |

No AAAA, no CAA (see §8).

**Order:** Elastic IP → `A api` → wait until it resolves → start Caddy. Vercel domain → `CNAME ops` → wait for Vercel to show "Valid Configuration".

**Verify (PowerShell):**
```powershell
Resolve-DnsName api.hexis.fyi -Type A -Server 1.1.1.1   # IPAddress = your Elastic IP
Resolve-DnsName ops.hexis.fyi -Type CNAME -Server 1.1.1.1
```
Docs: [Namecheap — how to create an A record](https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/).

---

## 13. Backups (Phase 3)

**Decision:**
- S3 bucket `hexis-ops-backups-<account-id>` in eu-north-1: **Block Public Access on**, default encryption SSE-S3, tag `project=hexis-ops`, **lifecycle: expire objects after 14 days**.
- Instance role gets an inline policy: `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` on **that bucket only**.
- AWS CLI v2 on the host (official installer for `aarch64`). Daily systemd timer (03:00) runs `infra/scripts/backup.sh`: `docker compose exec -T postgres pg_dump -Fc` → `aws s3 cp - s3://…/daily/<date>.dump`.
- **Restore test monthly** (and once right after setup): `infra/scripts/restore-test.sh` downloads the latest dump, restores into a throwaway `postgres:18` container, runs a row count, removes the container.
- **No scheduled EBS snapshots:** the host is reproducible from the repo + `.env` + dumps. Take one manual snapshot only before risky host changes (snapshots cost per GiB-month — **NOT VERIFIED** price).

**Verify:** S3 console shows `daily/<today>.dump`; `restore-test.sh` prints the expected count. Docs: [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [S3 lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html), [AWS CLI install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

---

## 14. Cost control, decision point and full shutdown

**Decisions:**
- **AWS Budgets:** monthly cost budget **USD 30** with email alerts at 50 % / 80 % / 100 % actual and 100 % forecasted. Configure it to **exclude credits**, so alerts reflect real consumption (option under the budget's advanced/filter settings — **NOT VERIFIED** exact label).
- **Credits pace check:** the Free plan credit balance (Billing → Credits) monthly. Target: ≥ USD 80 left on 2027-03-01.
- **Cost Anomaly Detection:** one monitor for AWS services, alert by email above USD 5.
- **Tags:** `project=hexis-ops` on every resource; activate it as a cost allocation tag in Billing.
- **Anthropic:** monthly spend limit in its console; separate API key for production.

**🗓️ End-of-free-plan decision point — 2027-04-01** (≈ 18 days before suspension):
1. Option A — **keep it**: upgrade the account to Paid (remaining credits carry over; **check in Billing → Credits how long they last after the upgrade** — AWS's Free Tier FAQ gives different expiry periods). Expected ≈ USD 18/month (update with verified prices).
2. Option B — **shut down**: run the export, then the shutdown list below, and record it in the dev-log.
3. Never rely on the 90-day retention after suspension: resources become inaccessible immediately.

**Export before shutdown:** final `pg_dump` to S3 → download to the PC from the S3 console; save `infra/.env` values in the password manager; keep the repo (code, docs, runbook) as the record.

**Full shutdown list (target: USD 0/month), all in eu-north-1 — then check every region in EC2 Global View:**
1. Terminate the EC2 instance (root volume is deleted on termination).
2. **Release the Elastic IP** (an allocated public IPv4 is billed even when unattached).
3. Delete leftover EBS volumes, snapshots and any AMIs.
4. Empty and delete the S3 bucket.
5. Delete the security group and the IAM role/instance profile (free, but tidy).
6. Delete budgets/anomaly monitors last.
7. Next month's bill (or credit usage) must show 0.

Docs: [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html), [Cost Anomaly Detection](https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html), [public IPv4 pricing announcement](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/).

---

## 15. Security baseline

**Mandatory now (Phase 0):**
- Root: MFA, no access keys. Admin user with MFA, no access keys.
- Security group: inbound **80/443 only**; port 22 closed (Session Manager).
- **IMDSv2 required** on the instance (set explicitly at launch).
- EBS encryption on.
- Postgres and API not published; only Caddy publishes ports.
- API container runs as non-root.
- `.env` mode 600, root-owned; nothing secret in the repo or the image (check with `docker history --no-trunc`).
- Automatic security updates.
- Budget + anomaly alerts.

**Phase 2–3:** CORS allow-list (introduced in Phase 2, production value in Phase 3), per-IP rate limit, max input size, daily spend cap, kill switch, security headers on API responses, backups + restore test.

**Can wait (parked):** WAF, GuardDuty/Security Hub (cost), centralized logging, Parameter Store for secrets, automated deploys with OIDC.

---

## 16. Runbook

The full beginner runbook — zero to `https://api.hexis.fyi/health`, with verification and rollback for every step — is in [`RUNBOOK.md`](./RUNBOOK.md).

---

## Work split

### The agent writes in the repo (no cloud access)
1. `apps/api/Dockerfile` + root `.dockerignore`.
2. `apps/api/scripts/build.ts` (run with `tsx`; esbuild bundle → `dist/server.mjs`) + `build` script — **after** dependency-vetting `esbuild`.
3. API env schema: `HOST` only (`DATABASE_URL` arrives in Phase 1, `CORS_ORIGINS` in Phase 2); `trustProxy`; pino JSON logs.
4. `infra/compose.yaml`, `infra/compose.dev.yaml`, `infra/Caddyfile`, `infra/env.production.example`, `infra/env.local.example` (no `env_file`; per-service `environment:`).
5. `infra/scripts/deploy.sh` (git pull → compose pull → up -d → image prune) and, in Phase 3, `backup.sh`, `restore-test.sh`, systemd unit + timer files. Phase 1 adds the pre-migration dump to `deploy.sh`.
6. `.github/workflows/api-image.yml` (arm64 runner → Docker CLI → GHCR; `actions/checkout` pinned by SHA).
7. `docs/infra/RUNBOOK.md` updates whenever infra files change.

### You do by hand
Everything in AWS, Namecheap, Vercel, GitHub package settings and the Anthropic console, following [`RUNBOOK.md`](./RUNBOOK.md); plus replacing every **NOT VERIFIED** value with what you see.

---

## Verification log (2026-10-20, agent review)

Checked independently against official pages:
- EC2 Free-plan eligible instance types (accounts created on or after 2025-07-15) include `t4g.small` — [EC2 docs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html). Region availability is **not** stated there.
- Free plan end: the account is suspended, data is kept 90 days and then erased; upgrading restores access and keeps remaining credits — [Free Tier FAQs](https://aws.amazon.com/free/faqs/). The FAQ gives different credit expiry periods after an upgrade (check Billing → Credits).
- `ubuntu-24.04-arm` runners are free and GA for public repositories ([changelog](https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/)); the arm64 Ubuntu 24.04 runner image lists Docker, Buildx, Compose, Git and jq.
- SSM Agent is preinstalled on Ubuntu Server 24.04 LTS AMIs — [AWS docs](https://docs.aws.amazon.com/systems-manager/latest/userguide/ami-preinstalled-agent.html).
- Postgres 18 images: data volume at `/var/lib/postgresql`, `PGDATA=/var/lib/postgresql/18/docker` — [Docker Hub](https://hub.docker.com/_/postgres).
- Vercel offers Node.js 24.x (default) and 22.x — [Vercel docs](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- Corepack ships with Node 24.12 (checked locally); not yet checked inside the `node:24-bookworm-slim` image.
- Kysely ships `FileMigrationProvider` and no built-in static provider, so §7 uses a custom `MigrationProvider`.

Still **NOT VERIFIED** after this review: EC2, EBS, S3 and egress prices in eu-north-1; whether the Free plan allows Systems Manager, Budgets and Cost Anomaly Detection; "Free tier eligible" for `t4g.small` in eu-north-1; the Budgets "exclude credits" label; image size and the esbuild bundle of Fastify; Corepack inside the Node image; whether `GITHUB_TOKEN` can create the GHCR package on the first push (personal account, fallback in §3); the frozen install with `apps/web` excluded from the build context.
