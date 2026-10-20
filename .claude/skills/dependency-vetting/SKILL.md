---
name: dependency-vetting
description: Use BEFORE adding a new dependency, upgrading or changing a dependency version, or executing a remote package (pnpm add / install <pkg> / update / dlx, npx <pkg>, bunx). Produces a vetting report the human must approve. If you cannot check the package online, stop and hand the human the links.
---

# Dependency vetting

Every dependency is code from strangers running with your permissions. Supply-chain attacks (typosquats, hijacked maintainers, malicious install scripts, freshly published compromised versions) are common.

## Step 1 — Is it needed at all?

- What exactly will it do? Can it be done in a few lines without a dependency?
- Is something already installed that does it?
- Prefer well-known, widely used packages over niche ones for the same job.

## Step 2 — Check (if you have web access)

| Check | Red flag |
|---|---|
| Exact name | Typosquat or look-alike of a popular package (`reacct`, `lodahs`, scope confusion) |
| Age & last publish | Package only days old, or the requested version published < 7 days ago |
| Maintainers | Recent ownership change, single unknown maintainer |
| Popularity & repo | Very low downloads, no linked repository, archived/abandoned repo |
| Install scripts | `preinstall` / `install` / `postinstall` present (common malware vector) |
| Vulnerabilities | Known advisories for the version (OSV, GitHub Advisories) |
| License | Incompatible with the project's license |
| Footprint | Many transitive dependencies for a trivial job |

Useful sources:
- `https://www.npmjs.com/package/<name>` — versions, publish dates, maintainers, downloads
- `https://socket.dev/npm/package/<name>` — supply-chain risk signals
- `https://osv.dev/list?ecosystem=npm&q=<name>` — known vulnerabilities
- `https://deps.dev/npm/<name>` — dependency graph and health signals
- The GitHub repository — activity, open security issues, Security tab

You can also inspect metadata locally without installing: `pnpm view <name>` (versions, time, maintainers, repository, scripts).

## Step 3 — Report and wait

```
Dependency: <name>@<version> — <purpose>
Alternatives considered: <none needed / built-in X / package Y>
Checks: name ✅ · age ✅ · maintainers ✅ · repo ✅ · install scripts ✅ none · vulns ✅ none · license ✅ MIT · footprint ✅ 3 deps
Verdict: ✅ low risk / ⚠️ caution: <why> / ❌ do not install: <why>
Sources: <links>
```

**Wait for the human's explicit approval** before installing.

## If you cannot check it

**Stop.** Do not install. Give the human the list of links above for that package and the red flags to look for, and wait for their verdict.

## After installing

- Install an exact, already-vetted version.
- Run the package manager's audit (`pnpm audit`) and report the result.
- Mention the new dependency in the dev-log entry at closure.

## Recommended package-manager hardening (verify names in the official docs for your version)

- Do not run dependency lifecycle scripts by default; allow-list only the packages that truly need build scripts (pnpm: `onlyBuiltDependencies` / `pnpm approve-builds`).
- Delay brand-new versions (pnpm: `minimumReleaseAge`, in minutes, e.g. 1440 = 1 day).
- Commit the lockfile and use frozen-lockfile installs in CI.
