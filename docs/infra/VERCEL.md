# Hexis Ops — Vercel setup guide (web placeholder at `ops.hexis.fyi`)

Publishes `apps/web` on Vercel and serves it at `https://ops.hexis.fyi`. It is the human half of the Phase 0 goal "`ops.hexis.fyi` serves the placeholder page".

It is **independent from AWS**: it can be done at any time, because `apps/web` is already on `main`. It expands step **C4** of [`RUNBOOK.md`](./RUNBOOK.md); the reasons are in [`DECISIONS.md`](./DECISIONS.md) §11.

**Legend:** ⏱ estimated time · ✅ how to verify · ↩️ how to undo · **PowerShell** = your PC

**Rules while following this guide**
- Everything is done in the Vercel **dashboard** and in Namecheap. The Vercel CLI is blocked for the AI agent by the repo guardrails.
- No secrets are needed. Never paste tokens or keys in chats.
- **NOT VERIFIED** = not confirmed in official docs; the line says how to check it.

Total: **⏱ about 20–30 minutes**, plus DNS propagation.

---

## Before you start
- A GitHub account that owns `theghost1980/human-in-the-loop-demo-ai` (public repository).
- `apps/web` is on `main` (merged with the scaffold). Vercel builds the *production* deployment from `main`.
- Access to Namecheap for `hexis.fyi`.
- The domain is not already attached to another Vercel account (if it is, see *Troubleshooting*).

---

## Steps

### 1. Create the Vercel account · ⏱ 5 min
vercel.com → sign up or log in → **Continue with GitHub**.

The Hobby plan is free and, per Vercel's docs, restricted to personal, non-commercial use, which fits this portfolio project. When a Hobby limit is exceeded, the feature is paused for about 30 days; nothing is charged.

✅ You land on the Vercel dashboard with a Hobby team.
↩️ Delete the account from your Vercel account settings (nothing else depends on it yet).

### 2. Import the repository · ⏱ 5 min
Dashboard → **Add New… → Project** → *Import Git Repository* → **Import** next to `human-in-the-loop-demo-ai`.

If the repository is not listed, use **Adjust GitHub App Permissions** and give Vercel access to **this repository only**.

✅ The *Configure Project* screen opens.
↩️ Cancel before pressing **Deploy**.

### 3. Configure the project before the first deploy · ⏱ 5 min
On the *Configure Project* screen:

| Setting | Value |
|---|---|
| **Root Directory** | **Edit** → select `apps/web` |
| Framework Preset | Next.js (detected automatically) |
| Build and install commands | leave the defaults |
| Environment Variables | **none** (see *Not now*) |
| Node.js version | the default is **24.x**; confirm later in Settings → Build and Deployment → Node.js Version |

**NOT VERIFIED:** whether the dashboard shows an option to include source files outside the Root Directory. If it does, keep it enabled (it will matter once `apps/web` imports `packages/core`).

✅ The Root Directory shows `apps/web`.
↩️ Cancel, or change the value in Settings → Build and Deployment.

### 4. First deploy · ⏱ 5 min
Press **Deploy** and wait for the build. Open the `*.vercel.app` address it gives you.

✅ The page shows "Hexis Ops — Human-in-the-loop AI agents for business operations. Coming soon." In the build log, note which pnpm version was used (9 or 10 are both fine for this lockfile) and that `next build` finished.
↩️ Delete the project from its settings.

### 5. Add the domain in Vercel · ⏱ 3 min
Project → **Settings → Domains → Add Domain** → `ops.hexis.fyi`.

Vercel shows a **CNAME** record with a value that is **unique to this project** (it looks like `<id>.vercel-dns-017.com`). Copy exactly the value it shows; do not use a value from another project or from a guide.

✅ The domain appears in the list with a pending or "Invalid Configuration" status (expected until DNS is set).
↩️ Remove the domain from the list.

### 6. Create the DNS record in Namecheap · ⏱ 5 min
Namecheap → Domain List → **Manage** next to `hexis.fyi` → **Advanced DNS** → **Add New Record**:

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME Record | `ops` | the value shown by Vercel | Automatic |

Save the record. Use `ops` as the host, not `ops.hexis.fyi`.

**NOT VERIFIED:** the exact Namecheap labels (they come from RUNBOOK C4). If there is no *Advanced DNS* tab, the domain probably uses other nameservers: add the record where the DNS is actually hosted.

✅ The record appears in the Host Records list.
↩️ Delete the record in Namecheap.

### 7. Verify · ⏱ 5 min + propagation
In Vercel → Settings → Domains, wait for **Valid Configuration**; the HTTPS certificate is issued automatically.

**PowerShell**
```powershell
Resolve-DnsName ops.hexis.fyi -Type CNAME -Server 1.1.1.1
```
```powershell
Invoke-WebRequest https://ops.hexis.fyi -UseBasicParsing | Select-Object StatusCode
```

✅ The CNAME answer points to the Vercel value, the status code is `200` and the page shows the placeholder.
↩️ Remove the domain in Vercel and the CNAME in Namecheap.

---

## What happens on later pushes
- **Production Branch** is `main`: only merges to `main` change `https://ops.hexis.fyi`.
- Pushes to other branches create **Preview** deployments, but Vercel automatically skips builds for monorepo projects that the commit does not affect (requirements per Vercel's docs, all met here: GitHub repository, pnpm workspace in `pnpm-workspace.yaml`, unique package names). In practice only changes under `apps/web` trigger a build.
- Hobby allows 100 deployments per day.

## Not now (Phase 2)
- **`NEXT_PUBLIC_API_URL=https://api.hexis.fyi`**: the placeholder does not read it. Add it in Settings → Environment Variables (Production; decide separately about Preview) when the UI first calls the API, then redeploy.
- **API CORS** (`CORS_ORIGINS`) arrives in the same phase; previews are not allowed against the production API (DECISIONS §11).

## Troubleshooting
| Symptom | What to check |
|---|---|
| Build fails during install or build | Copy the build log and bring it to the next session. Note the pnpm version the log reports. |
| `*.vercel.app` shows a 404 or the wrong app | The Root Directory must be exactly `apps/web` (Settings → Build and Deployment). |
| Domain shows *Invalid Configuration* | Look for conflicting A, AAAA or CNAME records for the host `ops`, and compare with the value shown for **this** project. |
| Vercel asks for a TXT record | The domain is used by another Vercel account: add the `TXT` record it shows (at `_vercel` on the apex domain). |
| The subdomain does not resolve | The Namecheap host must be `ops`; allow time for propagation (compare with `Resolve-DnsName … -Server 1.1.1.1`). |
| A Hobby feature is paused | A Hobby usage limit was exceeded: wait about 30 days or reduce usage. |

## Undo everything
Remove the domain in Vercel and the `ops` CNAME in Namecheap; then delete the Vercel project.

---

## Sources and verification log (2026-10-20, agent review)
Checked against Vercel's official docs:
- Monorepo import flow and Root Directory, and automatic skipping of unaffected projects — [Using Monorepos](https://vercel.com/docs/monorepos).
- pnpm detection from the lockfile (`lockfileVersion: 9.0` is read by pnpm 9 or 10) — [Package Managers](https://vercel.com/docs/package-managers).
- Subdomains use a project-specific CNAME value; troubleshooting table — [Adding a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain).
- Hobby plan: free, personal and non-commercial use, limits and pauses — [Hobby plan](https://vercel.com/docs/plans/hobby).
- Node.js 24.x is available and the default — [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Still **NOT VERIFIED**: Namecheap's exact UI labels; the "include source files outside the Root Directory" option; which pnpm version the build uses (read it from the first build log).
