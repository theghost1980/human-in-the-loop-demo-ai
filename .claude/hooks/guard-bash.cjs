#!/usr/bin/env node
/**
 * PreToolUse (matcher: "Bash|PowerShell") — one hook, one place to fix matching.
 * Both shell tools send the command in tool_input.command, so one script serves both.
 * All project-specific values come from .claude/guardrails.config.json.
 *
 * NORMALIZATION: the command is lower-cased and every char outside [a-z0-9_./\-]
 * becomes a space, so quotes, &&, ||, ;, $( ) and = act as separators.
 * That closes bypasses like `bash -c "vercel deploy"`. Accepted side effect:
 * `echo "do not use npm"` is also blocked. A false positive beats a bypass.
 *
 * REAL LIMIT: this hook only sees the command STRING. A script file that deletes
 * data or calls a paid API, run via `pnpm tsx script.ts`, is invisible here.
 * That layer is AGENTS.md: ask BEFORE writing and running such a script.
 *
 * Escape hatches (set by the HUMAN in their own terminal, then relaunch Claude):
 *   CLAUDE_ALLOW_GIT_DESTRUCTIVE=1  force-push, reset --hard, rebase, clean -f, branch -D
 *   CLAUDE_ALLOW_DB_DESTRUCTIVE=1   DELETE / TRUNCATE / DROP / migrate reset
 *   CLAUDE_ALLOW_PAID=1             scripts matching paidScriptPattern (e.g. eval:live)
 * Protected branches and blocked CLIs have NO escape hatch.
 */
const { execSync } = require('child_process');
const { loadConfig, readStdin, escapeRegex, isSecretPath, block, ask } = require('./lib.cjs');

const cfg = loadConfig();
const env = process.env;

readStdin((data) => {
  // Blocks exit immediately; "ask" decisions are collected and emitted at the end,
  // so a chained command (git commit && cat .env) still hits every block rule.
  const pendingAsk = [];
  const raw = String(data?.tool_input?.command || '');
  if (!raw.trim()) return;

  const lower = raw.toLowerCase();
  const cmd = lower.replace(/[^a-z0-9_./\\-]+/g, ' ').trim();
  const tokens = cmd.split(/\s+/).filter(Boolean);
  const hasWord = (w) =>
    new RegExp(`(^|[\\s/\\\\])${escapeRegex(w.toLowerCase())}(\\.exe|\\.cmd)?(\\s|$)`).test(cmd);

  // ── 1. Blocked CLIs (no escape hatch) ──────────────────────────────────────
  for (const cli of cfg.blockedCli) {
    if (hasWord(cli)) {
      block(
        `${cli} CLI is forbidden for AI agents`,
        `No agent runs ${cli} commands in this repo, read-only included. Give the human the exact command to run.`,
        raw,
      );
    }
  }

  // ── 2. Git ─────────────────────────────────────────────────────────────────
  // Between "git" and the subcommand we accept flags, "." / ".." or paths, so
  // `git -C . commit` matches but `git log | grep commit` does not.
  const gitSub = (sub) =>
    new RegExp(
      `(^|[\\s/\\\\])git(\\s+(-{1,2}[a-z0-9_-]+|\\.{1,2}|[^\\s]*[\\\\/][^\\s]*)){0,4}\\s+(${sub})(\\s|$)`,
    ).test(cmd);

  // 2a. Destructive git (escape hatch: CLAUDE_ALLOW_GIT_DESTRUCTIVE=1)
  const destructive = [
    { n: 'force push', hit: gitSub('push') && /(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/.test(lower) },
    { n: 'reset --hard', hit: gitSub('reset') && /\s--hard\b/.test(lower) },
    { n: 'rebase', hit: gitSub('rebase') },
    { n: 'clean -f', hit: gitSub('clean') && /\s-[a-z]*f/.test(lower) },
    { n: 'branch -D', hit: gitSub('branch') && /\s(-D\b|-[a-zA-Z]*D\b|--delete\s+--force|--force\s+--delete)/.test(raw) },
    { n: 'filter-branch / filter-repo', hit: gitSub('filter-branch|filter-repo') },
  ].find((d) => d.hit);
  if (destructive && env.CLAUDE_ALLOW_GIT_DESTRUCTIVE !== '1') {
    block(
      `destructive git (${destructive.n})`,
      'Rewriting or discarding history needs an explicit "yes" from the human, who must set CLAUDE_ALLOW_GIT_DESTRUCTIVE=1 in their own terminal.',
      raw,
    );
  }

  // 2b. Commit / merge / push vs protected branches
  const isCommit = gitSub('commit');
  const isMerge = gitSub('merge');
  const isPush = gitSub('push');
  const protectedSet = new Set(cfg.protectedBranches.map((b) => b.toLowerCase()));

  if (isCommit || isMerge || isPush) {
    let branch = '';
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: data.cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
      })
        .toString()
        .trim()
        .toLowerCase();
    } catch {
      branch = '';
    }

    if (protectedSet.has(branch)) {
      block(
        `protected branch "${branch}"`,
        `Nobody commits, merges or pushes directly on ${[...protectedSet].join('/')}. Create a branch first: git switch -c feat/<topic>.`,
        raw,
      );
    }
    if (isPush) {
      const pushIdx = tokens.indexOf('push');
      const targets = pushIdx >= 0 ? tokens.slice(pushIdx + 1) : [];
      const hitProtected = targets.find((t) => protectedSet.has(t.split('/').pop()) && !t.startsWith('-'));
      if (hitProtected) {
        block(
          'push to a protected branch',
          `Pushing to ${hitProtected} is reserved for the human (via PR).`,
          raw,
        );
      }
    }
    pendingAsk.push(
      `Git ${isPush ? 'push' : isMerge ? 'merge' : 'commit'} on branch "${branch || 'unknown'}". ` +
        'Approve ONLY if you explicitly asked the AI to do this in the current conversation.',
    );
  }

  // 2c. Pull requests
  if (/(^|\s)gh\s+pr\s+merge(\s|$)/.test(cmd)) {
    block('gh pr merge', 'Merging pull requests is reserved for the human.', raw);
  }
  if (/(^|\s)gh\s+pr\s+create(\s|$)/.test(cmd)) {
    pendingAsk.push('Create a pull request? Approve only if you explicitly asked for it.');
  }

  // ── 3. Package managers & dependencies ─────────────────────────────────────
  const pm = cfg.packageManager.toLowerCase();
  for (const other of cfg.otherPackageManagers) {
    if (other.toLowerCase() !== pm && hasWord(other)) {
      block(
        `${pm} is the only package manager`,
        `Do not use ${other} here, not even to run scripts. Use ${pm}.`,
        raw,
      );
    }
  }

  const allowedExec = new Set(cfg.allowedExecutables.map((e) => e.toLowerCase()));
  const firstNonFlag = (arr) => arr.find((t) => !t.startsWith('-'));

  const pmIdx = tokens.indexOf(pm);
  if (pmIdx >= 0) {
    const rest = [];
    const after = tokens.slice(pmIdx + 1);
    for (let k = 0; k < after.length; k++) {
      const t = after[k];
      if (t === '--filter' || t === '-f' || t === '-c' || t === '--dir' || t === '-c') { k++; continue; }
      if (t.startsWith('-')) continue;
      rest.push(t);
    }
    const verb = rest[0];
    const args = rest.slice(1);
    const addsDep =
      verb === 'add' ||
      ((verb === 'install' || verb === 'i') && args.length > 0) ||
      verb === 'update' ||
      verb === 'up' ||
      verb === 'upgrade';
    const runsRemote = verb === 'dlx' || (pm === 'bun' && verb === 'x');
    if (addsDep) {
      pendingAsk.push(
        `Dependency change (${pm} ${verb} ${args.join(' ')}). Approve only after the dependency-vetting ` +
          'report was presented and you agreed.',
      );
    }
    if (runsRemote && !allowedExec.has(firstNonFlag(args) || '')) {
      pendingAsk.push(`Running a remote package (${pm} ${verb} ${args.join(' ')}). Vet it first (dependency-vetting).`);
    }
  }

  for (const runner of ['npx', 'bunx']) {
    const i = tokens.indexOf(runner);
    if (i >= 0) {
      const target = firstNonFlag(tokens.slice(i + 1)) || '';
      if (!allowedExec.has(target)) {
        pendingAsk.push(`${runner} ${target}: not in allowedExecutables. Vet the package first (dependency-vetting).`);
      }
    }
  }

  // ── 4. Paid scripts (escape hatch: CLAUDE_ALLOW_PAID=1) ───────────────────
  if (cfg.paidScriptPattern && new RegExp(cfg.paidScriptPattern, 'i').test(lower) && env.CLAUDE_ALLOW_PAID !== '1') {
    block(
      'paid script',
      'This script calls paid services (API credits / cloud). The human must approve and set CLAUDE_ALLOW_PAID=1 in their own terminal.',
      raw,
    );
  }

  // ── 5. Cloud CLIs that can cost money or change infra → ask ───────────────
  for (const cli of cfg.askCli) {
    if (hasWord(cli)) {
      pendingAsk.push(`${cli} command: it may change infrastructure or cost money. Approve only if you asked for it.`);
    }
  }

  // ── 5b. Recursive deletes and Docker data loss → ask (Bash, PowerShell and cmd syntax)
  // `(?<!git\s+)` keeps `git rm -r --cached` out: it only touches the index.
  const CONFIRM_PATTERNS = [
    { n: 'recursive delete (rm -r)', re: /(^|\s)(?<!git\s+)rm\s+(\S+\s+)*?(-[a-z]*r[a-z]*|--recursive)(\s|$)/ },
    { n: 'recursive delete (Remove-Item -Recurse)', re: /(^|\s)(remove-item|ri|del|erase|rd|rmdir)\s+(\S+\s+)*?-r(ec[a-z]*)?(\s|$)/ },
    { n: 'recursive delete (rmdir /s, del /s)', re: /(^|\s)(rmdir|rd|del|erase)\s+(\S+\s+)*?\/s(\s|$)/ },
    { n: 'docker compose down -v', re: /(^|\s)docker(-compose)?\s+(\S+\s+)*?down\s+(\S+\s+)*?(-[a-z]*v[a-z]*|--volumes)(\s|$)/ },
    { n: 'docker volume rm/prune', re: /(^|\s)docker\s+volume\s+(rm|remove|prune)(\s|$)/ },
    { n: 'docker system prune', re: /(^|\s)docker\s+system\s+prune(\s|$)/ },
  ];
  const hitConfirm = CONFIRM_PATTERNS.find((p) => p.re.test(cmd));
  if (hitConfirm) {
    pendingAsk.push(`${hitConfirm.n}: may delete files or Docker data for good. Approve only if you asked for it.`);
  }

  // ── 6. Destructive database operations (escape hatch: CLAUDE_ALLOW_DB_DESTRUCTIVE=1)
  const hasDbClient = cfg.dbClients.some((c) => hasWord(c));
  const SQL_DESTRUCTIVE = [
    { n: 'DELETE FROM', re: /\bdelete\s+from\b/ },
    { n: 'TRUNCATE', re: /\btruncate\b/ },
    { n: 'DROP', re: /\bdrop\s+(table|database|schema|index|view|type|column|constraint|collection)\b/ },
    { n: 'ALTER TABLE ... DROP', re: /\balter\s+table\b[\s\S]*\bdrop\b/ },
    { n: 'dropDatabase / deleteMany', re: /\b(dropdatabase|deletemany|drop)\s*\(/ },
  ];
  const OTHER_DESTRUCTIVE = [
    { n: 'migrate reset', re: /\bmigrate\s+reset\b/ },
    { n: 'db push --force-reset', re: /\bdb\s+push\b[\s\S]*--force-reset/ },
    { n: 'db execute', re: /\bprisma\s+db\s+execute\b/ },
    { n: 'drizzle-kit drop', re: /\bdrizzle-kit\s+drop\b/ },
    { n: 'SQL from file (-f *.sql)', re: /(^|\s)-f\s+\S+\.sql(\s|$)/ },
  ];
  const hitDb =
    (hasDbClient && SQL_DESTRUCTIVE.find((p) => p.re.test(lower))) ||
    (hasDbClient && OTHER_DESTRUCTIVE.find((p) => p.re.test(lower)));
  if (hitDb && env.CLAUDE_ALLOW_DB_DESTRUCTIVE !== '1') {
    block(
      `destructive database operation (${hitDb.n})`,
      'You may PROPOSE the query; executing it needs an explicit "yes, delete it" from the human, who must set CLAUDE_ALLOW_DB_DESTRUCTIVE=1.',
      raw,
    );
  }

  // ── 7. Dumping secret files ────────────────────────────────────────────────
  const touchesSecret = tokens.some((t) => isSecretPath(t, cfg));
  if (touchesSecret) {
    const DUMP =
      /(^|[\s/\\])(cat|type|more|less|head|tail|sed|awk|nl|od|xxd|strings|bat|base64|gc|get-content|source|cp|copy)(\s|$)/;
    const GREPISH = /(^|[\s/\\])(grep|egrep|fgrep|rg|findstr|select-string)(\s|$)/;
    const SAFE_FLAG = /\s-[a-z]*[cql][a-z]*(\s|$)/; // -c / -q / -l: presence only
    if (DUMP.test(cmd) || (GREPISH.test(cmd) && !SAFE_FLAG.test(cmd))) {
      block(
        'reading a secret file',
        'Secret files are never printed or copied. To check a variable exists, ask the human to run a presence-only check: grep -c VAR_NAME .env',
        raw,
      );
    }
  }

  if (pendingAsk.length) ask(pendingAsk.join(' | '));
});
