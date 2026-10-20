import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    // .claude/ holds the guardrail hooks (plain Node scripts, covered by their own test suite).
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      '.claude/**',
      'private/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
);
