# Hexis Ops — Infrastructure runbook

From an empty AWS account to `https://api.hexis.fyi/health` (Phase 0), plus the Phase 3 add-ons.
Written for a first-time AWS user. The reasons behind each choice are in [`DECISIONS.md`](./DECISIONS.md).

**Naming:** *Hexis Ops* is the product name. The repository is `theghost1980/human-in-the-loop-demo-ai`. The demo is deployed on `hexis.fyi`, a domain owned by the author: `ops.hexis.fyi` (web) and `api.hexis.fyi` (API).

**Legend:** ⏱ estimated time · ✅ how to verify · ↩️ how to undo · **PowerShell** = your PC · **bash** = the server (Session Manager)

**Rules while following this runbook**
- Do every step in region **Europe (Stockholm) eu-north-1** (top-right selector in the console).
- Tag everything you create with `project = hexis-ops`.
- If a screen or option differs from what is written here, follow the official doc linked in DECISIONS.md and note the difference in the dev-log.
- Anything marked **NOT VERIFIED** must be checked, not assumed.

Total for Phase 0: **⏱ about 3–4 hours**, plus DNS propagation waits.

---

## Part A — Account safety (once)

### A1. Protect the root user · ⏱ 10 min
1. Sign in as root → account menu (top right) → **Security credentials** → **Assign MFA device** (authenticator app).
2. Same page: confirm there are **no access keys**. If any exist, delete them.

✅ IAM → Dashboard shows no root security warnings.
↩️ Not applicable (keep it).

### A2. Create your admin user · ⏱ 15 min
1. IAM → Users → **Create user** `saturno-admin` → *Provide user access to the AWS Management Console* → custom password.
2. Permissions: **Attach policies directly** → `AdministratorAccess`.
3. Open the user → Security credentials → **Assign MFA device**. Do **not** create access keys.
4. Save the account sign-in URL (IAM dashboard) in your password manager. Sign out of root and sign in as `saturno-admin` from now on.

✅ You can open EC2 as `saturno-admin`, and the user shows MFA = Assigned.
↩️ IAM → Users → delete the user.

### A3. Budget and anomaly alerts · ⏱ 15 min
1. Billing and Cost Management → **Budgets** → Create budget → *Customize* → Cost budget → Monthly → amount **USD 30**.
2. Advanced options: **exclude credits** so the budget tracks real usage (**NOT VERIFIED** exact label).
3. Alerts: 50 % actual, 80 % actual, 100 % actual, 100 % forecasted → your email.
4. Billing and Cost Management → **Cost Anomaly Detection** → Create monitor → *AWS services* → alert subscription: email, threshold **USD 5**.
5. Billing → **Credits**: note the balance and the end date in the dev-log.

✅ Budgets lists `hexis-ops-monthly`; you receive the anomaly subscription confirmation email (if any).
↩️ Delete the budget / monitor.

---

## Part B — Server

### B1. Instance role for Session Manager · ⏱ 5 min
1. IAM → Roles → **Create role** → Trusted entity: *AWS service* → Use case: **EC2**.
2. Attach `AmazonSSMManagedInstanceCore`. Name: `hexis-ec2-role`. Tag `project=hexis-ops`.

✅ The role exists with one policy attached.
↩️ Delete the role.

### B2. Security group · ⏱ 5 min
1. EC2 → Security Groups → **Create** `hexis-api-sg` in the default VPC.
2. Inbound: **HTTP 80** from `0.0.0.0/0`, **HTTPS 443** from `0.0.0.0/0`. **No SSH rule.**
3. Outbound: leave the default (all).

✅ Inbound rules show exactly two entries (80, 443).
↩️ Delete the security group (after the instance is terminated).

### B3. Emergency key pair · ⏱ 2 min
1. EC2 → Key Pairs → **Create** `hexis-emergency`, type ED25519, format `.pem`.
2. Move the downloaded file into your password manager (as an attachment) and delete it from Downloads.

✅ The key pair appears in the list; the file is no longer in Downloads.
↩️ Delete the key pair.

### B3b. Optional short test before the real launch · ⏱ 20 min
Goal: confirm, for almost nothing, that `t4g.small` shows **Free tier eligible** in eu-north-1 and that Session Manager works on your account — before the image pipeline exists. Needs B1 and B2 done.

1. EC2 → **Launch instance** with the same values as B4, but **do not allocate an Elastic IP** (leave *auto-assign public IP* enabled: Session Manager needs outbound internet).
2. When the status checks pass, Connect → **Session Manager** and run:
   ```bash
   whoami        # ssm-user
   uname -m      # aarch64
   ```
3. Write down whether the instance type was marked **Free tier eligible** at launch.
4. **Terminate** the instance right away.

✅ Session Manager opened and the type was marked eligible. If either failed, fix it now (DECISIONS.md §4–§5) instead of during the real deploy.
↩️ Terminate the instance (it is the last step above). A running instance with an auto-assigned public IPv4 is billed per hour, so the test costs only the minutes it runs (**NOT VERIFIED** exact amount: check Billing afterwards).

### B4. Launch the instance · ⏱ 10 min
**Do this when the image pipeline is ready** (the `api-image` run of C2 is green): from here on the server consumes credits (≈ USD 18/month, **NOT VERIFIED**).

EC2 → **Launch instance**:

| Field | Value |
|---|---|
| Name | `hexis-api` (adds tag Name) + tag `project=hexis-ops` |
| AMI | **Ubuntu Server 24.04 LTS**, architecture **64-bit (Arm)** |
| Instance type | **t4g.small** (must show "Free tier eligible") |
| Key pair | `hexis-emergency` |
| Network | default VPC, auto-assign public IP: enabled (replaced by the Elastic IP next) |
| Security group | existing → `hexis-api-sg` |
| Storage | **20 GiB gp3**, encrypted: yes, delete on termination: yes |
| Advanced → IAM instance profile | `hexis-ec2-role` |
| Advanced → Metadata version | **V2 only (token required)** |

Launch.

✅ Instance state *Running*, status checks *2/2 passed* (wait a few minutes).
↩️ Instance → **Terminate**.

### B5. Elastic IP · ⏱ 5 min
1. EC2 → Elastic IPs → **Allocate** (tag `project=hexis-ops`).
2. Actions → **Associate** → instance `hexis-api`.
3. Write the IP in the dev-log (it is public, not a secret).

✅ The instance's *Public IPv4 address* equals the Elastic IP.
↩️ Disassociate → **Release** (an allocated but unused Elastic IP keeps costing money).

### B6. Connect with Session Manager · ⏱ 5 min
EC2 → instance → **Connect** → tab **Session Manager** → Connect. (If disabled, wait 5–10 minutes after launch.)

```bash
whoami        # ssm-user
uname -m      # aarch64
```

✅ A browser terminal opens and prints the values above.
↩️ None. If it never becomes available: check the role is attached (B4) and see DECISIONS.md §5.

### B7. Host setup · ⏱ 30 min
Run in the Session Manager terminal (bash). Paste one block at a time.
Every `apt-get` runs non-interactively (`DEBIAN_FRONTEND=noninteractive`, `NEEDRESTART_MODE=a`, `--force-confdef` / `--force-confold`) so that no dialog can freeze the browser terminal (**NOT VERIFIED** on this exact AMI).

**Updates and swap**
```bash
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h        # Swap: 2.0Gi
```

**Docker Engine + Compose plugin** (official repository — if the commands on [docs.docker.com/engine/install/ubuntu](https://docs.docker.com/engine/install/ubuntu/) differ, use the official ones)
```bash
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update
sudo env DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

**Docker log rotation**
```bash
echo '{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"}}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker && sudo systemctl enable docker
sudo docker run --rm hello-world     # "Hello from Docker!"
docker compose version               # Docker Compose version v2.x
```

**Automatic security updates with reboot at 04:00 (UTC)**
```bash
systemctl is-enabled unattended-upgrades     # enabled
sudo tee /etc/apt/apt.conf.d/52hexis-reboot > /dev/null <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
EOF
sudo unattended-upgrade --dry-run --debug 2>&1 | tail -n 5   # no errors
```

✅ All expected outputs above.
↩️ If something breaks badly: terminate the instance and redo B4–B7 (nothing on it is irreplaceable yet).

---

## Part C — DNS and deploy

### C1. DNS record for the API · ⏱ 5 min + propagation
Namecheap → Domain List → `hexis.fyi` → **Advanced DNS** → Add record:
`A Record` · Host `api` · Value **Elastic IP** · TTL **5 min**.

**PowerShell**
```powershell
Resolve-DnsName api.hexis.fyi -Type A -Server 1.1.1.1
# IPAddress : <your Elastic IP>
```

✅ The answer is your Elastic IP (can take from minutes up to the TTL).
↩️ Delete the record.

### C2. Prerequisites from the repo · ⏱ 10 min
1. The agent's Phase 0 infra work (Dockerfile, compose, Caddyfile, scripts, `api-image.yml`) is merged to `main` through a PR.
2. GitHub → Actions → **api-image** run is green. If the push to GHCR fails with a permissions error (**NOT VERIFIED** that `GITHUB_TOKEN` can create the package on a personal account), use the fallback of DECISIONS.md §3: Package settings → **Manage Actions access** → add this repository with role **Write**; if it still fails, create a personal access token with only `write:packages` and store it as a repository secret.
3. GitHub → your profile → **Packages** → `hexis-ops-api` → Package settings → **Change visibility → Public** (only needed after the first push).

✅ On the server: `sudo docker pull ghcr.io/theghost1980/hexis-ops-api:main` succeeds without login, and the package page links to the repository.
↩️ Set the package back to private (the server will then fail to pull).

### C3. First deploy · ⏱ 15 min
```bash
sudo mkdir -p /opt/hexis
sudo git clone https://github.com/theghost1980/human-in-the-loop-demo-ai.git /opt/hexis/app
sudo install -m 600 -o root -g root /dev/null /opt/hexis/app/infra/.env
sudo nano /opt/hexis/app/infra/.env
```
Fill it from `infra/env.production.example`, taking values from your password manager. `infra/.env` holds only secrets and per-environment values (`API_DOMAIN=api.hexis.fyi`, `ACME_EMAIL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, future keys); the non-secret constants (`NODE_ENV`, `HOST`, `PORT`) are already in `compose.yaml`. Compose reads the file only to fill the `${VAR}` entries of each service; no service loads the whole file. For the database password, run `openssl rand -base64 32` in another line and paste the result. Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

```bash
sudo stat -c '%a %U' /opt/hexis/app/infra/.env    # 600 root
cd /opt/hexis/app/infra
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps          # caddy, api, postgres running/healthy
sudo docker compose logs caddy | grep -i "certificate obtained"
```

**PowerShell**
```powershell
Invoke-RestMethod https://api.hexis.fyi/health
# status
# ------
# ok
Test-NetConnection api.hexis.fyi -Port 5432   # TcpTestSucceeded : False
```

✅ Health returns `ok` over HTTPS; port 5432 is closed from the internet.
↩️ `sudo docker compose down` (keeps data). **Never** `down -v` unless you mean to delete the database and certificates.

**Later deploys:** `sudo /opt/hexis/app/infra/scripts/deploy.sh`
**Rollback to an older image:** `cd /opt/hexis/app/infra && sudo API_TAG=sha-<short> docker compose up -d api`

### C4. Vercel and the web domain · ⏱ 20 min
Full step-by-step guide, with verification, troubleshooting and undo: [`VERCEL.md`](./VERCEL.md). Summary:
1. Vercel → Add New → Project → import the GitHub repo.
2. **Root Directory:** `apps/web` · Framework: Next.js · leave install/build commands as default.
3. Settings → **Node.js Version:** 24.x (it is the default).
4. Settings → Domains → add `ops.hexis.fyi` → copy the **exact** CNAME target Vercel shows.
5. Namecheap → Advanced DNS → `CNAME Record` · Host `ops` · Value = that target · TTL Automatic.

`NEXT_PUBLIC_API_URL` is **not** needed yet: the placeholder does not read it. Add it in Phase 2, when the UI first calls the API.

**PowerShell**
```powershell
Resolve-DnsName ops.hexis.fyi -Type CNAME -Server 1.1.1.1
Invoke-WebRequest https://ops.hexis.fyi -UseBasicParsing | Select-Object StatusCode   # 200
```

✅ Vercel shows "Valid Configuration" and the placeholder page loads over HTTPS.
↩️ Remove the domain in Vercel and the CNAME in Namecheap.

### C5. Anthropic · ⏱ 10 min
1. Anthropic console → create a **dedicated API key** for Hexis production → paste it straight into the server `.env` (C3) and your password manager.
2. Set the **monthly spend limit** for the organization/workspace.

✅ The key appears in the console list; the limit is visible in billing/limits settings.
↩️ Revoke the key.

### C6. Phase 0 close-out · ⏱ 10 min
- Tag check: Billing → **Cost allocation tags** → activate `project`.
- Raise the `api` DNS TTL to Automatic.
- Record in `docs/dev-log.md`: Elastic IP, instance ID, AMI ID, credit balance and end date, any screen that differed from this runbook.

✅ Phase 0 "Done" criteria in `docs/PLAN.md` are met.

---

## Part D — Phase 3 add-ons

### D1. Backup bucket · ⏱ 10 min
S3 → Create bucket `hexis-ops-backups-<account-id>` (eu-north-1) · Block all public access: **on** · Default encryption: SSE-S3 · tag `project=hexis-ops`.
Management → **Lifecycle rule** → apply to all objects → *Expire current versions* after **14 days**.

✅ Bucket exists, not public, lifecycle rule listed.
↩️ Empty and delete the bucket.

### D2. Let the instance write backups · ⏱ 5 min
IAM → Roles → `hexis-ec2-role` → Add permissions → **Create inline policy** (JSON), replacing `BUCKET`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::BUCKET" },
    { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"], "Resource": "arn:aws:s3:::BUCKET/*" }
  ]
}
```

✅ The role lists two policies.
↩️ Delete the inline policy.

### D3. AWS CLI on the host · ⏱ 10 min
Follow the official **Linux ARM (aarch64)** instructions: [AWS CLI install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

```bash
aws --version                          # aws-cli/2.x ... aarch64
aws sts get-caller-identity            # Arn contains assumed-role/hexis-ec2-role
aws s3 ls s3://hexis-ops-backups-<account-id>/
```

✅ Commands succeed without configuring keys (the instance role is used).
↩️ `sudo rm -rf /usr/local/aws-cli /usr/local/bin/aws`.

### D4. Daily backup timer · ⏱ 10 min
The agent provides `infra/scripts/backup.sh` and `infra/systemd/hexis-backup.{service,timer}`.
```bash
sudo cp /opt/hexis/app/infra/systemd/hexis-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hexis-backup.timer
sudo systemctl start hexis-backup.service     # run once now
systemctl list-timers | grep hexis            # next run shown
```

✅ S3 shows `daily/<today>.dump`.
↩️ `sudo systemctl disable --now hexis-backup.timer`.

### D5. Restore test (now, then monthly) · ⏱ 10 min
```bash
sudo /opt/hexis/app/infra/scripts/restore-test.sh   # prints the row counts it checked, then "restore test OK"
```

✅ Counts match production (`sudo docker compose exec postgres psql -U <user> -d <db> -c 'select count(*) from runs;'`).
↩️ The script removes its temporary container; nothing to undo.

### D6. Production protections · ⏱ 10 min
In the server `.env`: `CORS_ORIGINS=https://ops.hexis.fyi`, rate limit, max input size, daily spend cap and kill switch values (names defined by the Phase 3 code). Then `sudo /opt/hexis/app/infra/scripts/deploy.sh`.

✅ The Phase 3 "Done" criteria in `docs/PLAN.md` (simulated abuse blocked with zero spend).

---

## Part E — End-of-free-plan decision (🗓️ 2027-04-01)

Free plan ends ≈ **2027-04-19**. On **2027-04-01**:
- **Keep:** Billing → upgrade to **Paid** plan (remaining credits carry over; **check in Billing → Credits how long they last after the upgrade**). Re-check the budget amount.
- **Shut down:** follow the export + shutdown list in DECISIONS.md §14, then verify in EC2 **Global View** that no resource remains in any region.
- Either way, record the decision and the final numbers in `docs/dev-log.md`.
