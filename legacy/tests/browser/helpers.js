'use strict';
/** Shared helpers for browser tests (Playwright is a dev/test tool only, never part of the runtime). */
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../../apps/demo-portal/server.js');

const ROOT = path.join(__dirname, '..', '..');
const EXT = path.join(ROOT, 'apps', 'extension');
const DEMO_URL = 'http://localhost:5500/';

function chromePath() {
  const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function startDemo() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(5500, '127.0.0.1', resolve); });
  return server;
}

module.exports = { ROOT, EXT, DEMO_URL, chromePath, startDemo };
