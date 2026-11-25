'use strict';
/**
 * Assist on travel sites, run on the practice pages: ask → confirm → fill From/To/date/travellers,
 * press Search after a confirm, rank the results by what the user cares about, explain offers,
 * and apply a coupon after a confirm. Payment is never touched.
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

test('assist flow on the practice flight pages', { skip: exe ? false : 'Chrome not found (set CHROME_PATH)', timeout: 150000 }, async (t) => {
  const server = await startDemo();
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'websaathi-assist-'));
  const context = await chromium.launchPersistentContext(userDir, {
    executablePath: exe, headless: false,
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run']
  });
  t.after(async () => { await context.close(); server.close(); fs.rmSync(userDir, { recursive: true, force: true }); });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const panelUrl = `chrome-extension://${new URL(worker.url()).host}/sidepanel/sidepanel.html`;

  const page = await context.newPage();
  await page.goto(DEMO_URL + 'flights.html');
  const probe = await context.newPage();
  await probe.goto(panelUrl);
  const tabId = await probe.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5500/*' }))[0].id);
  await probe.close();

  const panel = await context.newPage();
  await panel.goto(`${panelUrl}?targetTab=${tabId}&task=book_flight`);
  await panel.waitForSelector('#screen-home:not([hidden])');
  await panel.click('#help-page');
  await panel.waitForSelector('#pb-text', { timeout: 10000 });
  await panel.click('.mode[data-mode="assist"]');

  const answer = async (value) => {
    await panel.waitForSelector('#answer', { timeout: 10000 });
    await panel.fill('#answer', value);
    await panel.press('#answer', 'Enter');
    await panel.click('#confirm-yes');
    await panel.waitForSelector('#pb-next', { timeout: 10000 });
    await panel.click('#pb-next');
  };
  const cardText = (n) => page.evaluate((i) => document.querySelectorAll('.card strong')[i].textContent, n);

  await t.test('asks, confirms, then types From / To / date / travellers', async () => {
    await stepText(panel, /One Way or Round Trip/);
    await panel.click('#pb-next');
    await stepText(panel, /leaving from/);
    await panel.fill('#answer', 'Pune'); await panel.press('#answer', 'Enter');
    await stepText(panel, /Type “Pune”/);
    assert.notEqual(await cardText(0), 'Pune', 'nothing is typed before the user confirms');
    await panel.click('#confirm-yes');
    await panel.waitForSelector('#pb-next');
    assert.equal(await cardText(0), 'Pune');
    await panel.click('#pb-next');
    await stepText(panel, /Where are you going/);
    await panel.fill('#answer', 'Delhi'); await panel.press('#answer', 'Enter');
    await panel.click('#confirm-yes'); await panel.waitForSelector('#pb-next');
    assert.equal(await cardText(1), 'Delhi');
    await panel.click('#pb-next');
    await answer('tomorrow');
    assert.match(await cardText(2), /^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
    await answer('2');
    assert.equal(await cardText(3), '2');
  });

  await t.test('presses Search only after a confirm, then moves to the results', async () => {
    await stepText(panel, /press SEARCH/);
    await panel.click('#confirm-yes');
    await page.waitForURL(/flights-results/);
    await panel.waitForSelector('#pb-show', { timeout: 10000 });
    assert.match(await panel.textContent('#progress-text'), /Step 7 of 12/);
  });

  await t.test('ranks the options by the user preference and points at one', async () => {
    await panel.selectOption('#pref-by', 'cheapest');
    await panel.click('#pb-show');
    await panel.waitForSelector('.best li');
    assert.match(await panel.textContent('.best li:first-child'), /₹4,102/);
    await panel.check('#pref-nonstop');
    await panel.click('#pb-show');
    await panel.waitForFunction(() => /₹4,512/.test((document.querySelector('.best li') || {}).textContent || ''));
    await panel.click('.best li:first-child button');
    assert.equal(await page.evaluate(() => document.querySelector('websaathi-overlay').style.display), 'block');
  });

  await t.test('coupon: lists offers with when-it-works hints and applies one after a confirm', async () => {
    await page.goto(DEMO_URL + 'flights-details.html');
    await stepText(panel, /Add new adult/);
    await panel.click('#pb-next');
    await stepText(panel, /Extras/);
    await panel.click('#pb-next');
    await panel.waitForSelector('#pb-no');
    await panel.click('#pb-no');
    await panel.waitForSelector('.offer-list li');
    assert.match(await panel.textContent('.offer-list'), /ICICIFEST[\s\S]*bank card/);
    await panel.click('.offer-list li:first-child button');
    await panel.click('#confirm-yes');
    await panel.waitForFunction(() => /pressed Apply/.test(document.querySelector('#card').textContent));
    assert.equal(await page.evaluate(() => window.__applied), 'MMTSECURE');
    assert.equal(await page.evaluate(() => window.__paid || false), false, 'payment is never touched');
  });
});
