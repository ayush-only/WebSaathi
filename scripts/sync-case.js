'use strict';
// Copies case/*.js into extension/vendor/case/ (Chrome can't load files outside the extension folder).
// Run after any change in case/: npm run sync:case. Generated folder: do not edit by hand.
const fs = require('node:fs');
const path = require('node:path');
const src = path.join(__dirname, '..', 'case');
const dst = path.join(__dirname, '..', 'extension', 'vendor', 'case');
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src)) if (f.endsWith('.js')) fs.copyFileSync(path.join(src, f), path.join(dst, f));
console.log('synced case/*.js → extension/vendor/case/');
