#!/usr/bin/env node
/**
 * Cross-platform test runner for the guardrail hooks (Windows, macOS, Linux).
 *
 *   node .claude/hooks/test-hooks.mjs
 *
 * Simulates the JSON Claude Code sends to each hook on stdin and checks the outcome:
 *   block = exit 2 · ask = exit 0 + JSON "ask" · pass = exit 0 without a decision
 *
 * Git branch rules are tested inside a temporary repo (requires git on PATH).
 * Run it every time you touch a hook or guardrails.config.json. Tests assume the
 * default config values; adjust expectations if you changed them.
 */
import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const cleanEnv = { ...process.env };
delete cleanEnv.CLAUDE_ALLOW_GIT_DESTRUCTIVE;
delete cleanEnv.CLAUDE_ALLOW_DB_DESTRUCTIVE;
delete cleanEnv.CLAUDE_ALLOW_PAID;

let failures = 0;
let total = 0;

function run(hook, payload, env = cleanEnv) {
  const r = spawnSync(process.execPath, [join(HOOKS, hook)], {
    input: JSON.stringify(payload),
    env,
    encoding: 'utf8',
  });
  if (r.status === 2) return 'block';
  if (r.status === 0 && r.stdout.includes('"permissionDecision":"ask"')) return 'ask';
  if (r.status === 0) return 'pass';
  return `error(${r.status})`;
}

function expect(expected, label, got) {
  total++;
  const ok = expected === got;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} [${got}${ok ? '' : ` ≠ ${expected}`}] ${label}`);
}

const bash = (expected, command, cwd, env) =>
  expect(expected, command, run('guard-bash.cjs', { tool_name: 'Bash', tool_input: { command }, cwd }, env));
const ps = (expected, command, cwd, env) =>
  expect(expected, `[PowerShell] ${command}`, run('guard-bash.cjs', { tool_name: 'PowerShell', tool_input: { command }, cwd }, env));
const file = (expected, tool, input) =>
  expect(expected, `${tool} ${JSON.stringify(input)}`, run('guard-secret-files.cjs', { tool_name: tool, tool_input: input }));

// ── Temporary git repo for branch rules ───────────────────────────────────────
const repo = mkdtempSync(join(tmpdir(), 'guardrails-'));
const git = (args) => execSync(`git ${args}`, { cwd: repo, stdio: 'ignore' });
git('init -q');
git('checkout -q -b main');
git('-c user.name=t -c user.email=t@t commit -q --allow-empty -m init');

console.log('\n== Blocked CLIs ==');
bash('block', 'vercel ls');
bash('block', 'npx vercel deploy --prod');
bash('block', 'bash -c "vercel deploy"');
bash('block', 'netlify deploy');
bash('pass', 'cat vercel.json');

console.log('\n== Git on protected branch (main) ==');
bash('block', 'git commit -m "fix"', repo);
bash('block', 'git -C . commit -m x', repo);
bash('block', 'git push origin main', repo);
bash('block', 'git merge feat/x', repo);
bash('pass', 'git status', repo);
bash('pass', 'git log --oneline | grep commit', repo);

git('checkout -q -b feat/demo');
console.log('\n== Git on feature branch ==');
bash('ask', 'git commit -m "feat: x"', repo);
bash('ask', 'git push -u origin feat/demo', repo);
bash('block', 'git push origin HEAD:main', repo);
bash('block', 'git push --force', repo);
bash('block', 'git push -f origin feat/demo', repo);
bash('block', 'git reset --hard HEAD~1', repo);
bash('block', 'git rebase main', repo);
bash('block', 'git clean -fd', repo);
bash('block', 'git branch -D old', repo);
bash('pass', 'git branch -d merged-branch', repo);
bash('ask', 'git push --force', repo, { ...cleanEnv, CLAUDE_ALLOW_GIT_DESTRUCTIVE: '1' });
bash('ask', 'gh pr create --fill', repo);
bash('block', 'gh pr merge 12', repo);

console.log('\n== Package manager & dependencies ==');
bash('block', 'npm install');
bash('block', 'yarn add react');
bash('block', 'sh -c "npm ci"');
bash('pass', 'pnpm install');
bash('pass', 'pnpm --filter web typecheck');
bash('ask', 'pnpm add zod');
bash('ask', 'pnpm --filter api add fastify');
bash('ask', 'pnpm i -D vitest');
bash('ask', 'pnpm update');
bash('ask', 'pnpm dlx create-next-app');
bash('pass', 'npx tsx src/scripts/x.ts');
bash('ask', 'npx some-random-cli');

console.log('\n== Paid scripts ==');
bash('block', 'pnpm eval:live');
bash('block', 'pnpm run seed:live --scenario retail');
bash('pass', 'pnpm eval:live', undefined, { ...cleanEnv, CLAUDE_ALLOW_PAID: '1' });
bash('pass', 'pnpm eval');

console.log('\n== Cloud CLIs ==');
bash('ask', 'aws s3 ls');
bash('ask', 'terraform apply');
bash('pass', 'cat infra/aws-notes.md');

console.log('\n== Recursive deletes & Docker data (ask) ==');
bash('ask', 'rm -rf dist');
bash('ask', 'rm -r node_modules');
bash('ask', 'rm build -rf');
bash('ask', 'Remove-Item -Recurse -Force dist');
bash('ask', 'Remove-Item dist -r');
bash('ask', 'rmdir /s /q build');
bash('ask', 'del /s /q *.log');
bash('ask', 'docker compose down -v');
bash('ask', 'docker-compose down --volumes');
bash('ask', 'docker compose -f infra/docker-compose.yml down -v');
bash('ask', 'docker volume rm pgdata');
bash('ask', 'docker volume prune');
bash('ask', 'docker system prune -a');
bash('pass', 'rm file.txt');
bash('pass', 'rm -f file.txt');
bash('pass', 'git rm -r --cached dist');
bash('pass', 'Remove-Item dist/file.txt');
bash('pass', 'Get-ChildItem -Recurse src');
bash('pass', 'docker compose up -d');
bash('pass', 'docker compose down');
bash('pass', 'docker compose down --remove-orphans');
bash('pass', 'docker compose logs -f');
bash('pass', 'docker ps');

console.log('\n== Destructive database ==');
bash('block', 'psql "$DB" -c "DELETE FROM leads WHERE id=1"');
bash('block', 'psql "$DB" -c "TRUNCATE leads"');
bash('block', 'psql "$DB" -c "DROP TABLE leads"');
bash('block', 'psql "$DB" -f cleanup.sql');
bash('block', 'pnpm prisma migrate reset');
bash('pass', 'psql "$DB" -c "SELECT count(*) FROM leads"');
bash('pass', 'grep -rn "delete from" src/');
bash('pass', 'psql "$DB" -c "TRUNCATE leads"', undefined, { ...cleanEnv, CLAUDE_ALLOW_DB_DESTRUCTIVE: '1' });
console.log('  (reminder: a DELETE hidden in a .ts script run with tsx cannot be detected here)');

console.log('\n== Secrets via Bash ==');
bash('block', 'cat server/.env');
bash('block', 'head -20 .env.local');
bash('block', 'grep DATABASE_URL .env');
bash('block', 'cat ~/.ssh/id_rsa');
bash('block', 'base64 key.pem');
bash('pass', 'grep -c DATABASE_URL .env');
bash('pass', 'cat .env.example');
bash('pass', 'tsx --env-file .env src/scripts/check.ts');
bash('pass', 'node --env-file=.env dist/index.js');

console.log('\n== Secrets via file tools ==');
file('block', 'Read', { file_path: 'server/.env' });
file('block', 'Edit', { file_path: '/repo/.env.production' });
file('block', 'Read', { file_path: 'certs/server.key' });
file('block', 'Grep', { pattern: 'API', path: '.env' });
file('block', 'Grep', { pattern: 'API', glob: '**/.env*' });
file('pass', 'Read', { file_path: 'server/.env.example' });
file('pass', 'Read', { file_path: 'src/config/env.ts' });
file('pass', 'Grep', { pattern: 'TODO', glob: '**/*.ts' });

console.log('\n== Same rules through the PowerShell tool ==');
ps('ask', 'git commit -m "feat: x"', repo);
ps('block', 'git push --force', repo);
ps('block', 'npm install');
ps('block', 'Get-Content server\\.env');
ps('pass', 'Select-String -Path .env -Pattern VAR_NAME -Quiet');
ps('block', 'pnpm eval:live');
ps('ask', 'Remove-Item -Recurse -Force dist');
ps('pass', 'git status', repo);

rmSync(repo, { recursive: true, force: true });
console.log(`\n${total - failures}/${total} passed${failures ? ` — ${failures} FAILED` : ' ✅'}`);
process.exit(failures ? 1 : 0);
