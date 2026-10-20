#!/usr/bin/env node
/**
 * SessionStart (matcher: "compact") — after a compaction, re-inject the hard rules.
 * Reads the block between <!-- reminder:start --> and <!-- reminder:end --> in
 * AGENTS.md, so the reminder never drifts from the source of truth.
 * Plain stdout from SessionStart is added to Claude's context.
 */
const fs = require('fs');
const path = require('path');

try {
  const root = process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, '..', '..');
  const text = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  const m = text.match(/<!-- reminder:start -->([\s\S]*?)<!-- reminder:end -->/);
  if (m) process.stdout.write(`Project hard rules (from AGENTS.md):\n${m[1].trim()}\n`);
} catch {
  // Silent: never break session start.
}
process.exit(0);
