'use strict';
// Practice portal storage: dockets survive a damaged file and saves are atomic (review on #6).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startSites } = require('./browser/helpers');

const HELP = 'http://127.0.0.1:15602';

async function withSites(dataFile, fn) {
  const s = startSites({ sellerPort: 15601, helplinePort: 15602, delayMs: 120000, dataFile });
  await Promise.all([s.seller, s.helpline].map((x) => new Promise((r) => (x.listening ? r() : x.once('listening', r)))));
  try { await fn(); } finally { s.close(); }
}
const file = (body) => fetch(HELP + '/file', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(Object.assign({ name: 'Ananya Rao', mobile: '9000000000', seller: 'Steelhouse', orderId: 'MS-48213', amount: '2499',
    story: 'My refund of ₹2,499 never came.', purchaseDate: '2026-10-28' }, body)).toString() });

test('a damaged docket file is not replaced with an empty one', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-sites-'));
  const data = path.join(dir, 'dockets.json');
  try {
    await withSites(data, async () => {
      const r = await file({});
      assert.equal(r.status, 303);
      assert.match(r.headers.get('location'), /CHP-2026-00417/);
      assert.deepEqual(fs.readdirSync(dir), ['dockets.json'], 'no temporary file left behind');
      const good = fs.readFileSync(data, 'utf8');
      fs.writeFileSync(data, good.slice(0, 40)); // a half-written file
      assert.equal((await file({})).status, 500);
      assert.equal(fs.readFileSync(data, 'utf8'), good.slice(0, 40), 'the damaged file was left for a human, not wiped');
      fs.writeFileSync(data, good);
      const again = await file({});
      assert.match(again.headers.get('location'), /CHP-2026-00418/, 'older docket kept, numbering continues');
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
