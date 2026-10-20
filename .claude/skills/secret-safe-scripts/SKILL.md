---
name: secret-safe-scripts
description: Use when a script, query or command needs environment variables or credentials (database URLs, API keys) — e.g. one-off verification queries, data analysis scripts, seed scripts. Trigger before writing such a script or before asking the human to run something with credentials.
---

# Secret-safe scripts

`.env` files and credentials are never read, printed, copied or pasted — by the agent or into the chat. Scripts load them at runtime; nobody sees the values.

## Pattern

1. **Write the script** so it reads configuration from `process.env` (or the language equivalent). Never hard-code values.
2. **Validate presence, not values**: fail fast with a clear message if a required variable is missing, without printing any value.
3. **Give the human the exact command** to run, loading the env file at runtime:
   - Node ≥ 20: `node --env-file=.env path/to/script.js`
   - tsx: `pnpm tsx --env-file .env path/to/script.ts`
   - Python: `python -m dotenv -f .env run -- python script.py` (python-dotenv CLI)
4. **The human runs it.** You read only the output.

## Checking that a variable exists

Ask the human to run a presence-only check and paste the number:
- `grep -c VAR_NAME .env` (bash) · `Select-String -Path .env -Pattern VAR_NAME -Quiet` (PowerShell)

## Hard rules

- Never inline credentials in a command (`psql -h <host> -U <user> -p <password>` with literal values).
- Never log `process.env` or any secret, not even partially masked in tests.
- Scripts that **modify data** follow AGENTS.md §10 (propose, confirm, then run). Scripts that **cost money** end in `:live` (§9).
- Name one-off scripts clearly (e.g. `scripts/_check-duplicates.ts`) and delete them when done unless the human wants to keep them.
