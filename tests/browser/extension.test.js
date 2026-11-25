'use strict';
/**
 * Loads the REAL unpacked extension in Chrome and drives the REAL side panel UI against the demo portal.
 * The side panel page is opened as a tab with ?targetTab=<id> (test hook) because automation cannot
 * click the toolbar icon; everything else — manifest, service worker, content-script injection,
 * messaging, planner, safety gate, executor — is the production code path.
 * Runs without the backend, i.e. in Local Demo Mode.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { EXT, DEMO_URL, chromePath, startDemo } = require('./helpers');

const exe = chromePath();

test('extension end-to-end in Local Demo Mode', { skip: exe ? false : 'Chrome not found (set CHROME_PATH)', timeout: 120000 }, async (t) => {
  const server = await startDemo();
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'websaathi-e2e-'));
  const context = await chromium.launchPersistentContext(userDir, {
    executablePath: exe,
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run']
  });
  t.after(async () => { await context.close(); server.close(); fs.rmSync(userDir, { recursive: true, force: true }); });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(worker.url()).host;
  assert.match(extId, /^[a-p]{32}$/);

  const demo = await context.newPage();
  await demo.goto(DEMO_URL);
  const panel = await context.newPage();
  const consoleErrors = [];
  panel.on('pageerror', (e) => consoleErrors.push(String(e)));
  // The backend is intentionally not running (Local Demo Mode), so its health check failing is expected.
  panel.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_REFUSED/.test(m.text())) consoleErrors.push(m.text()); });

  // Find the demo tab id from inside the extension.
  await panel.goto(`chrome-extension://${extId}/sidepanel/sidepanel.html`);
  const tabId = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5500/*' }))[0].id);
  await panel.goto(`chrome-extension://${extId}/sidepanel/sidepanel.html?targetTab=${tabId}`);

  await t.test('side panel renders home, Local Demo Mode badge and languages', async () => {
    await panel.waitForSelector('#screen-home:not([hidden])');
    assert.equal(await panel.textContent('#engine-badge'), 'Local Demo Mode');
    await panel.selectOption('#lang', 'hi');
    assert.match(await panel.textContent('#welcome'), /नमस्ते/);
    await panel.selectOption('#lang', 'kn');
    assert.match(await panel.textContent('#welcome'), /ನಮಸ್ಕಾರ/);
    await panel.selectOption('#lang', 'en');
  });

  await t.test('launcher: typed request shows the verified websites it can help on, then a confirmation screen only', async () => {
    await panel.fill('#intent', 'I want to complain about a product that was not refunded');
    await panel.click('#intent-form button[type="submit"]');
    await panel.waitForSelector('#screen-options:not([hidden])');
    assert.match(await panel.textContent('#options-title'), /complaint/i);
    await panel.click('#options-list .opt[data-portal="nch"]');
    await panel.waitForSelector('#screen-route:not([hidden])');
    assert.equal(await panel.textContent('#route-domain'), 'consumerhelpline.gov.in');
    await panel.click('#route-cancel'); // back to the options, not the start
    await panel.waitForSelector('#screen-options:not([hidden])');
    await panel.click('#options-back');
    await panel.waitForSelector('#screen-home:not([hidden])');
  });

  await t.test('launcher: category tiles, "which kind?" step, and travel sites are guide-only', async () => {
    assert.equal(await panel.locator('#category-tiles .task').count(), 4);
    await panel.click('#category-tiles [data-category="book"]');
    await panel.waitForSelector('#screen-kinds:not([hidden])');
    assert.equal(await panel.locator('#kinds-list .pick').count(), 4);
    await panel.click('#kinds-list [data-task="book_flight"]');
    await panel.waitForSelector('#screen-options:not([hidden])');
    const ids = await panel.$$eval('#options-list .opt', (n) => n.map((x) => x.dataset.portal));
    assert.deepEqual(ids, ['makemytrip', 'goibibo', 'yatra', 'ixigo']);
    assert.match(await panel.textContent('#options-list'), /Private travel company website/);
    assert.match(await panel.textContent('#options-list'), /Guide Mode/);
    assert.doesNotMatch(await panel.textContent('#options-list'), /Practice site: I can fill/);
    assert.ok(await panel.locator('#ready-list li').count() >= 2);
    await panel.click('#options-list .opt[data-portal="makemytrip"]');
    await panel.waitForSelector('#screen-route:not([hidden])');
    assert.equal(await panel.textContent('#route-domain'), 'www.makemytrip.com');
    assert.match(await panel.textContent('#route-kind'), /Private travel company/);
    await panel.click('#route-cancel');
    await panel.click('#options-back');
    await panel.waitForSelector('#screen-home:not([hidden])');
  });

  await t.test('launcher: a vague request asks which kind; a brand name goes first; banking is declined honestly', async () => {
    await panel.fill('#intent', 'I want to book a ticket');
    await panel.click('#intent-form button[type="submit"]');
    await panel.waitForSelector('#screen-kinds:not([hidden])');
    assert.match(await panel.textContent('#kinds-heard'), /I want to book a ticket/);
    await panel.click('#screen-kinds [data-go-home]');
    await panel.fill('#intent', 'book a flight on ixigo');
    await panel.click('#intent-form button[type="submit"]');
    await panel.waitForSelector('#screen-options:not([hidden])');
    assert.equal(await panel.$eval('#options-list .opt', (n) => n.dataset.portal), 'ixigo');
    await panel.click('#options-back');
    await panel.fill('#intent', 'transfer money using net banking');
    await panel.click('#intent-form button[type="submit"]');
    assert.match(await panel.textContent('#intent-msg'), /Banking is not supported yet/);
    await panel.waitForSelector('#screen-home:not([hidden])');
    await panel.fill('#intent', '');
    await panel.evaluate(() => { document.querySelector('#intent-msg').textContent = ''; });
  });

  await t.test('launcher works in Hindi', async () => {
    await panel.selectOption('#lang', 'hi');
    await panel.fill('#intent', 'ट्रेन कहाँ है');
    await panel.click('#intent-form button[type="submit"]');
    await panel.waitForSelector('#screen-options:not([hidden])');
    assert.match(await panel.textContent('#options-title'), /ट्रेन कहाँ/);
    assert.equal(await panel.$eval('#options-list .opt', (n) => n.dataset.portal), 'ntes');
    await panel.click('#options-back');
    await panel.selectOption('#lang', 'en');
    await panel.fill('#intent', '');
  });

  await t.test('assist mode fills the real demo form through the UI with confirmation', async () => {
    await panel.click('#help-page');
    await panel.waitForSelector('#screen-session:not([hidden])');
    assert.match(await panel.textContent('#site-policy'), /Practice site/);
    await panel.waitForSelector('#question');
    assert.equal(await panel.textContent('#question'), 'What is your full name?');

    // answer → confirm card → fill
    await panel.fill('#answer', 'My name is Sita Devi');
    await panel.click('#card form button[type="submit"]');
    await panel.waitForSelector('.card-confirm');
    assert.equal(await panel.textContent('.value-preview'), 'Sita Devi');
    assert.equal(await demo.inputValue('#name'), '', 'nothing is written before the user confirms');
    await panel.click('#confirm-yes');
    await demo.waitForFunction(() => document.querySelector('#name').value === 'Sita Devi');

    // email: give a wrong one → the site error is explained
    await panel.waitForFunction(() => document.querySelector('#question') && document.querySelector('#question').textContent.includes('email'));
    await panel.fill('#answer', 'sita at the rate example');
    await panel.click('#card form button[type="submit"]');
    await panel.click('#confirm-yes');
    await panel.waitForSelector('.card-error', { timeout: 10000 });
    assert.match(await panel.textContent('#card'), /email address is not written correctly/);
    await panel.click('#error-ok');
    await panel.waitForFunction(() => document.querySelector('#question') && /email/.test(document.querySelector('#question').textContent));
    await panel.fill('#answer', 'sita.devi@example.com');
    await panel.click('#card form button[type="submit"]');
    await panel.click('#confirm-yes');
    await demo.waitForFunction(() => document.querySelector('#email').value === 'sita.devi@example.com');

    // category via a big option button
    await panel.waitForSelector('#card .choice');
    await panel.click('#card .choice >> text=Banking');
    await panel.click('#confirm-yes');
    await demo.waitForFunction(() => document.querySelector('#category').value === 'banking');
    assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  });

  await t.test('pause stops guidance and clears the highlight', async () => {
    await panel.click('#ctl-pause');
    await panel.waitForFunction(() => document.querySelector('#card').textContent.includes('Paused'));
    await panel.click('#ctl-pause');
    await panel.waitForSelector('#question');
  });

  await t.test('after the user reaches the OTP step the panel shows HUMAN HANDOFF', async () => {
    // The user fills the rest by hand and presses Continue themselves.
    await demo.fill('#company', 'Example Bank');
    await demo.fill('#description', 'An unknown charge appeared on my account in October.');
    await demo.check('input[value="refund"]');
    await demo.check('#consent');
    await demo.click('button[type="submit"]');
    await demo.waitForSelector('#otp', { state: 'visible' });
    await panel.waitForSelector('.card-handoff', { timeout: 10000 });
    assert.match(await panel.textContent('.card-handoff'), /OTP/);
    assert.equal(await demo.inputValue('#otp'), '');
    assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  });
});
