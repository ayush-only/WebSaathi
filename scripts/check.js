#!/usr/bin/env node
/**
 * Build check (the extension has no build step — it is loaded unpacked as-is):
 *  1. every .js file parses (node --check)
 *  2. manifest.json is valid MV3 and every referenced file exists
 *  3. permissions stay minimal
 *  4. no obvious secrets in the source tree
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const EXT = path.join(ROOT, 'apps/extension');
let failures = 0;
const fail = (m) => { failures += 1; console.error('✗ ' + m); };
const ok = (m) => console.log('✓ ' + m);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'test-results'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT, []);

// 1. syntax
const js = files.filter((f) => f.endsWith('.js'));
for (const f of js) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { fail('syntax: ' + path.relative(ROOT, f) + '\n' + e.stderr); }
}
ok(`syntax check: ${js.length} JavaScript files`);

// 2. manifest
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
const referenced = [
  manifest.background && manifest.background.service_worker,
  manifest.side_panel && manifest.side_panel.default_path,
  ...Object.values(manifest.icons || {}),
  ...Object.values((manifest.action && manifest.action.default_icon) || {}),
  ...(manifest.content_scripts || []).flatMap((c) => c.js || [])
].filter(Boolean);
for (const r of referenced) if (!fs.existsSync(path.join(EXT, r))) fail('manifest references missing file: ' + r);
// scripts referenced from the side panel html
const html = fs.readFileSync(path.join(EXT, 'sidepanel/sidepanel.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png))"/g)) {
  if (!fs.existsSync(path.join(EXT, 'sidepanel', m[1]))) fail('sidepanel.html references missing file: ' + m[1]);
}
ok(`manifest: MV3, ${referenced.length} referenced files present`);

// 3. permissions
const allowedPerms = ['sidePanel', 'storage', 'scripting'];
const extra = (manifest.permissions || []).filter((p) => !allowedPerms.includes(p));
if (extra.length) fail('unexpected permissions: ' + extra.join(', '));
if ((manifest.host_permissions || []).some((h) => h === '<all_urls>' || h.startsWith('*://*') || h.includes('://*/'))) fail('host permissions must be scoped');
const opt = manifest.optional_host_permissions || [];
if (opt.some((h) => h !== 'https://*/*')) fail('optional host permissions may only be https://*/* (asked per site at runtime)');
if (/'unsafe-eval'|unsafe-inline/.test(JSON.stringify(manifest.content_security_policy || {}))) fail('CSP must not allow unsafe-eval/inline');
for (const f of js.filter((f) => f.startsWith(EXT))) {
  const src = fs.readFileSync(f, 'utf8');
  if (/\beval\s*\(|new Function\s*\(/.test(src)) fail('eval/new Function in ' + path.relative(ROOT, f));
}
ok('permissions: ' + manifest.permissions.join(', ') + ' + ' + manifest.host_permissions.length + ' scoped host patterns + optional https (per site, asked at runtime)');

// 4. secrets
const SECRET_RES = [/AKIA[0-9A-Z]{16}/, /aws_secret_access_key\s*=\s*\S{20,}/i, /sk_[a-f0-9]{40,}/, /ELEVENLABS_API_KEY=\S{10,}/];
for (const f of files) {
  if (/\.(png|jpg|ico|zip)$/.test(f) || path.basename(f) === '.env' || f === __filename) continue;
  const src = fs.readFileSync(f, 'utf8');
  for (const re of SECRET_RES) if (re.test(src)) fail('possible secret in ' + path.relative(ROOT, f));
}
ok('no secrets found in source files');

if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed.');
