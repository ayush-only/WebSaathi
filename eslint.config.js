'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['**/node_modules/**', 'test-results/**'] },
  js.configs.recommended,
  { rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] } },
  {
    files: ['apps/extension/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions, module: 'readonly', require: 'readonly' }
    },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] }
  },
  {
    files: ['apps/backend/**/*.js', 'apps/demo-portal/server.js', 'scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } }
  },
  {
    files: ['apps/demo-portal/public/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser } }
  },
  {
    // page.evaluate callbacks run in the browser
    files: ['tests/browser/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, chrome: 'readonly' } }
  }
];
