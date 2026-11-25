'use strict';
/**
 * After the search form the panel must follow the booking: results (options + offers explained),
 * traveller details (choose or add a traveller), then payment (hand-off). It only reads public page
 * text, never field values, and never clicks, ticks or types.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { EXT, DEMO_URL, chromePath, startDemo } = require('./helpers');

const exe = chromePath();
const stepText = (panel, re) => panel.waitForFunction((src) => new RegExp(src).test((document.querySelector('#pb-text') || {}).textContent || ''), re.source, { timeout: 10000 });

test('panel follows results → travellers → payment', { skip: exe ? false : 'Chrome not found (set CHROME_PATH)', timeout: 120000 }, async (t) => {
  const server = await startDemo();
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'websaathi-stages-'));
  const context = await chromium.launchPersistentContext(userDir, {
    executablePath: exe, headless: false,
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run']
  });
  t.after(async () => { await context.close(); server.close(); fs.rmSync(userDir, { recursive: true, force: true }); });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const panelUrl = `chrome-extension://${new URL(worker.url()).host}/sidepanel/sidepanel.html`;

  const page = await context.newPage();
  await page.goto(DEMO_URL + 'flights-results.html');
  await page.evaluate(() => { window.__clicks = 0; document.addEventListener('click', () => { window.__clicks += 1; }, true); });
  const probe = await context.newPage();
  await probe.goto(panelUrl);
  const tabId = await probe.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5500/*' }))[0].id);
  const stage = () => probe.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'WS_STAGE' }), tabId);

  await t.test('stage detection and offers read only public text', async () => {
    const r = await stage();
    assert.equal(r.stage, 'results');
    assert.deepEqual(r.offers.map((o) => o.code).slice(0, 2), ['MMTSECURE', 'TKMSALE']);
    assert.ok(r.offers.every((o) => !/SECRETVALUE/.test(JSON.stringify(o))), 'never reads field values');
  });

  const panel = await context.newPage();
  await panel.goto(`${panelUrl}?targetTab=${tabId}&task=book_flight`);
  await panel.waitForSelector('#screen-home:not([hidden])');

  await t.test('results page: jumps to the results step and lists offers', async () => {
    await panel.click('#help-page');
    await stepText(panel, /total price.*refundable/);
    assert.match(await panel.textContent('#progress-text'), /Step 7 of 10/);
    const offers = await panel.textContent('.offers');
    assert.match(offers, /MMTSECURE/);
    assert.match(offers, /yourself/);
  });

  await t.test('traveller page: choose or add a traveller', async () => {
    await page.goto(DEMO_URL + 'flights-details.html');
    await stepText(panel, /Add new adult/);
    assert.match(await panel.textContent('#progress-text'), /Step 8 of 10/);
  });

  await t.test('payment page: hands off', async () => {
    await page.goto(DEMO_URL + 'flights-pay.html');
    await stepText(panel, /At payment I stop/);
    assert.match(await panel.textContent('#progress-text'), /Step 10 of 10/);
  });

  await t.test('no literal "null" in the card and nothing was clicked', async () => {
    assert.doesNotMatch(await panel.textContent('#card'), /null|undefined/);
    assert.equal(await page.evaluate(() => window.__clicks || 0), 0);
  });
});
