#!/usr/bin/env node
/**
 * PreToolUse (matcher: "Read|Edit|Write|MultiEdit|NotebookEdit|Grep") — blocks the
 * agent from opening secret files with its OWN file tools (Bash is covered by
 * guard-bash.cjs). Patterns come from guardrails.config.json → secretPatterns.
 *
 * Belt and braces: settings.json also has permissions.deny on Read(./.env*).
 * Deny rules are the strongest layer; this hook adds Edit/Write/Grep coverage
 * and an explanatory message instead of a silent cut.
 */
const { loadConfig, readStdin, isSecretPath, block } = require('./lib.cjs');

const cfg = loadConfig();

readStdin((data) => {
  const ti = data?.tool_input || {};
  const p = String(ti.file_path || ti.notebook_path || ti.path || '');

  if (isSecretPath(p, cfg)) {
    block(
      'secret file access',
      `"${p}" holds credentials; it is never read, edited or shown. To check a variable exists, ask the human to run a presence-only check (grep -c VAR_NAME .env). To run a script with those vars, use the secret-safe-scripts skill.`,
    );
  }

  // Grep with a glob that targets secret files, e.g. "**/.env*" or "*.pem"
  if (data?.tool_name === 'Grep' && ti.glob) {
    const literalHints = cfg.secretPatterns
      .map((g) => g.replace(/\*/g, '').toLowerCase())
      .filter((h) => h.length >= 4);
    const glob = String(ti.glob).toLowerCase();
    const allowed = cfg.secretAllow.some((a) => glob.endsWith(a.toLowerCase()));
    if (!allowed && literalHints.some((h) => glob.includes(h))) {
      block('secret file search', `Grep glob "${ti.glob}" targets secret files.`);
    }
  }
});
