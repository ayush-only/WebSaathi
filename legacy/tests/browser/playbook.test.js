'use strict';
/**
 * The bug this covers: on a busy travel page the old "next empty box" walk pointed at an app-download
 * mobile-number box and a pre-ticked add-on. With a chosen task (book_flight) the panel must follow the
 * task instead — From, To, date, travellers, Search — find those spots by their visible words, ignore the
 * noise, and never click or type anything on the page.
 * Uses the practice flight page (apps/demo-portal/public/flights.html) with the real extension in Chrome.
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

test('task playbook on a noisy travel page', { skip: exe ? false : 'Chrome not found (set CHROME_PATH)', timeout: 120000 }, async (t) => {
  const server = await startDemo();
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'websaathi-playbook-'));
  const context = await chromium.launchPersistentContext(userDir, {
    executablePath: exe,
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run']
  });
  t.after(async () => { await context.close(); server.close(); fs.rmSync(userDir, { recursive: true, force: true }); });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(worker.url()).host;
  const panelUrl = `chrome-extension://${extId}/sidepanel/sidepanel.html`;

  const page = await context.newPage();
  await page.goto(DEMO_URL + 'flights.html');
  await page.evaluate(() => { window.__clicks = 0; document.addEventListener('click', () => { window.__clicks += 1; }, true); });

  const probe = await context.newPage();
  await probe.goto(panelUrl);
  const tabId = await probe.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5500/flights.html' }))[0].id);
  const find = (keys, button) => probe.evaluate(([id, k, b]) => chrome.tabs.sendMessage(id, { type: 'WS_FIND', keys: k, button: b }), [tabId, keys, button]);

  await t.test('the finder locates the real search words and ignores the promo noise', async () => {
    assert.equal((await find(['from', 'leaving from', 'origin'], false)).label, 'from');
    assert.equal((await find(['to', 'destination', 'going to'], false)).label, 'to');
    assert.equal((await find(['departure', 'depart', 'journey date', 'travel date', 'date'], false)).label, 'departure');
    assert.equal((await find(['travellers', 'travelers', 'passengers', 'adults'], false)).label, 'travellers');
    const search = await find(['search flights', 'search'], true);
    assert.equal(search.label, 'search');
    assert.equal(search.tag, 'div');
    assert.equal((await find(['pnr number', 'pnr'], false)).ok, false, 'a word that is not on the page is not found');
    // no flight-search step looks for "mobile" or "protection", so the noise is never a target
    for (const step of ['tripType', 'from', 'to', 'date', 'travellers', 'search']) {
      const keys = require('../../apps/extension/shared/playbooks.js').STEPS[step].keys;
      const r = await find(keys, step === 'search');
      assert.ok(r.ok && !/mobile|protection|app/.test(r.label), step);
    }
  });
  await probe.close();

  const panel = await context.newPage();
  await panel.goto(`${panelUrl}?targetTab=${tabId}&task=book_flight`);
  await panel.waitForSelector('#screen-home:not([hidden])');

  await t.test('follows the flight task step by step instead of walking random boxes', async () => {
    await panel.click('#help-page');
    await panel.waitForSelector('#pb-text', { timeout: 10000 });
    await panel.click('.mode[data-mode="guide"]'); // this test covers Guide mode; assist-travel.test.js covers Assist
    const expected = [/One Way or Round Trip/, /FROM/, /TO\./, /travel date/, /how many people/, /press this button yourself/];
    for (let i = 0; i < expected.length; i++) {
      await stepText(panel, expected[i]);
      assert.match(await panel.textContent('#progress-text'), new RegExp(`Step ${i + 1} of 12`));
      if (i > 0 && i < 5) assert.equal(await page.evaluate(() => document.querySelector('websaathi-overlay').style.display), 'block', 'a spot is highlighted at step ' + (i + 1));
      if (i < expected.length - 1) await panel.click('#pb-next');
    }
    // the Search step is final: the user presses it
    assert.ok(await panel.locator('.card-confirm').count());
  });

  await t.test('later steps explain the results, warn about add-ons, and stop at payment', async () => {
    await panel.click('#pb-next');
    await stepText(panel, /total price.*refundable/);
    await panel.click('#pb-next');
    await stepText(panel, /un-tick extras you do not want/);
    await panel.click('#pb-next');
    await stepText(panel, /lock the price/);
    await panel.click('#pb-next');
    await stepText(panel, /do you have a coupon code/i);
    await panel.click('#pb-next');
    await stepText(panel, /once more/);
    await panel.click('#pb-next');
    await stepText(panel, /At payment I stop/);
    assert.equal(await panel.textContent('#pb-next'), 'Finish');
    await panel.click('#pb-back');
    await stepText(panel, /once more/);
    await panel.click('#pb-next');
    await stepText(panel, /At payment I stop/);
    await panel.click('#pb-next');
    await panel.waitForFunction(() => document.querySelector('#card').textContent.includes('last step'));
  });

  await t.test('nothing was clicked, ticked or typed on the page', async () => {
    assert.equal(await page.evaluate(() => window.__clicks), 0);
    assert.equal(await page.evaluate(() => document.querySelector('#promo').checked), false);
    assert.equal(await page.evaluate(() => document.querySelector('input[type=text]').value), '');
  });

  await t.test('the playbook speaks the user language', async () => {
    await panel.selectOption('#lang', 'hi');
    await panel.click('#ctl-repeat');
    await panel.waitForFunction(() => /यह आख़िरी कदम/.test(document.querySelector('#card').textContent));
  });
});
