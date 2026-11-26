'use strict';
// Shared test helpers for v2. Both people may import; Person 2 maintains.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const EXT = path.join(ROOT, 'extension');

/** Path to a local Chrome or Chromium. Override with CHROME_PATH. */
function chromePath() {
  const c = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
  return c.find((p) => p && fs.existsSync(p)) || null;
}

/** Starts both practice sites on the given ports with a throwaway data file. */
function startSites({ sellerPort = 5501, helplinePort = 5502, delayMs = 120000, dataFile } = {}) {
  process.env.DOCKET_DELAY_MS = String(delayMs);
  if (dataFile) process.env.DATA_FILE = dataFile;
  delete require.cache[require.resolve('../../mock-sites/server.js')];
  return require('../../mock-sites/server.js').start({ sellerPort, helplinePort });
}

module.exports = { ROOT, EXT, chromePath, startSites };
