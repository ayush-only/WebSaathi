'use strict';
const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  { ignores: ['legacy/**', 'node_modules/**', '**/node_modules/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'script',
      globals: { ...globals.browser, ...globals.node, ...globals.webextensions } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] }
  }
];
