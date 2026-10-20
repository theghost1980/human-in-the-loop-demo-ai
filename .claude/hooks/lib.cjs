/**
 * Shared helpers for the guardrail hooks.
 *
 * Files use the .cjs extension on purpose: if the project's package.json has
 * "type": "module", plain .js files would be loaded as ESM and `require` would fail,
 * which makes Claude Code treat the hook as a non-blocking error (= no protection).
 *
 * Claude Code hook contract (PreToolUse):
 *   exit 0, no output        -> no objection, normal permission flow continues
 *   exit 2 + stderr          -> BLOCK; stderr is shown to the model
 *   exit 0 + JSON on stdout  -> structured decision (we use it for "ask")
 *   any other exit code      -> hook error; the tool call RUNS ANYWAY. Never throw.
 */
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  packageManager: 'pnpm',
  otherPackageManagers: ['npm', 'yarn', 'pnpm', 'bun'],
  allowedExecutables: [],
  protectedBranches: ['main', 'master'],
  blockedCli: [],
  askCli: [],
  dbClients: ['psql', 'mysql', 'mongosh', 'sqlite3', 'prisma'],
  paidScriptPattern: ':live\\b',
  secretPatterns: ['.env', '.env.*', '*.pem', '*.key'],
  secretAllow: ['.env.example', '.env.sample', '.env.template', '.env.dist'],
};

function loadConfig() {
  try {
    const file = path.join(__dirname, '..', 'guardrails.config.json');
    const user = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { ...DEFAULTS, ...user };
  } catch {
    return DEFAULTS;
  }
}

function readStdin(onData) {
  let input = '';
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    let data = {};
    try {
      data = JSON.parse(input);
    } catch {
      process.exit(0);
    }
    try {
      onData(data);
    } catch {
      // Fail open on internal bugs: a crashing hook would not block anyway.
      process.exit(0);
    }
    process.exit(0);
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globToRegex(glob) {
  const body = glob
    .split('')
    .map((c) => (c === '*' ? '[^/\\\\]*' : c === '?' ? '.' : escapeRegex(c)))
    .join('');
  return new RegExp(`^${body}$`, 'i');
}

function isSecretPath(p, cfg) {
  if (!p) return false;
  const base = String(p).split(/[\\/]/).pop().toLowerCase();
  if (cfg.secretAllow.some((a) => a.toLowerCase() === base)) return false;
  return cfg.secretPatterns.some((g) => globToRegex(g).test(base));
}

function block(title, detail, raw) {
  const tail = raw ? ` Intercepted: ${JSON.stringify(raw)}` : '';
  console.error(`BLOCKED by guardrail hook — ${title}. ${detail}${tail}`);
  process.exit(2);
}

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

module.exports = { loadConfig, readStdin, escapeRegex, globToRegex, isSecretPath, block, ask };
