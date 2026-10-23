import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import web from './apps/web/eslint.web.js';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/.turbo/**', '**/private/**', '**/.firebase/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  { files: ['scripts/privacy-check'], languageOptions: { globals: globals.node } },
  { files: ['apps/web/src/**/*.{ts,tsx}'], languageOptions: { globals: globals.browser } },
  web,
]);
