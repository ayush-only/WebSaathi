'use strict';
/**
 * Two behaviours the new travel/status sites depend on, tested in real Chrome:
 *  1. On-demand injection: those sites have host permission but NO always-on content script, so the
 *     side panel must inject the content script itself when the user asks for help.
 *     (Tested with a copy of the extension whose manifest has no content_scripts at all.)
 *  2. Opening a new tab sends the side panel back to "what would you like to do?".
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { EXT, DEMO_URL, chromePath, startDemo } = require('./helpers');

const exe = chromePath();

test('on-demand injection and new-tab launcher', { skip: exe ? false : 'Chrome not found (set CHROME_PATH)', timeout: 120000 }, async (t) => {
  const server = await startDemo();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'websaathi-launcher-'));
  const extCopy = path.join(work, 'ext');
  fs.cpSync(EXT, extCopy, { recursive: true });
  const manifestPath = path.join(extCopy, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  delete manifest.content_scripts;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const context = await chromium.launchPersistentContext(path.join(work, 'profile'), {
    executablePath: exe,
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${extCopy}`, `--load-extension=${extCopy}`, '--no-first-run']
  });
  t.after(async () => { await context.close(); server.close(); fs.rmSync(work, { recursive: true, force: true }); });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = new URL(worker.url()).host;
  const panelUrl = `chrome-extension://${extId}/sidepanel/sidepanel.html`;

  await t.test('the panel injects the content script itself when there is no always-on one', async () => {
    const demo = await context.newPage();
    await demo.goto(DEMO_URL);
    const probe = await context.newPage();
    await probe.goto(panelUrl);
    const tabId = await probe.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5500/*' }))[0].id);
    // Nothing injected yet: the page has no WebSaathi overlay host and no content script.
    await probe.close();

    const panel = await context.newPage();
    await panel.goto(`${panelUrl}?targetTab=${tabId}`);
    await panel.waitForSelector('#screen-home:not([hidden])');
    await panel.click('#help-page');
    await panel.waitForSelector('#screen-session:not([hidden])');
    await panel.waitForSelector('#question', { timeout: 10000 });
    assert.equal(await panel.textContent('#question'), 'What is your full name?');
    await panel.click('#ctl-stop');
    await panel.close();
    await demo.close();
  });

  await t.test('opening a new tab sends the panel back to "what would you like to do?"', async () => {
    const panel = await context.newPage();
    await panel.goto(panelUrl); // no targetTab: follows whatever tab is active, like the real side panel
    await panel.waitForSelector('#screen-home:not([hidden])');
    await panel.fill('#intent', 'book a train ticket');
    await panel.click('#intent-form button[type="submit"]');
    await panel.waitForSelector('#screen-options:not([hidden])');

    const fresh = await context.newPage();
    await fresh.goto('about:blank');
    await panel.waitForFunction(() => !document.querySelector('#screen-home').hidden, null, { polling: 100, timeout: 10000 });
    assert.equal(await panel.$eval('#screen-options', (n) => n.hidden), true);
  });
});
