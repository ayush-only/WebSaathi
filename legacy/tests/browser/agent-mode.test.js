'use strict';
/**
 * Agent mode ("any other website"): on a site that is NOT in the registry, the user states a goal and switches
 * WebSaathi on for that site. The backend's model (a scripted stand-in here; real Bedrock is not used in tests)
 * proposes ONE action at a time from the live page. Every fill/press still needs the user's tap and goes
 * through the same safety gate. Pay/OTP/password stay with the human.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { EXT, chromePath } = require('./helpers');
const { createApp } = require('../../apps/backend/src/server.js');

const exe = chromePath();
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Cab booking (practice)</title></head><body style="font:16px system-ui">
<h1>Book a cab</h1>
<div id="pickup" style="cursor:pointer;border:1px solid #333;padding:8px;width:200px"><span>Pickup</span></div>
<label>Drop <input id="drop" type="text"></label>
<label>Card number <input id="card" type="text" autocomplete="cc-number"></label>
<div id="go" role="button" tabindex="0" style="display:inline-block;background:#1b5fbf;color:#fff;padding:10px 24px;cursor:pointer">Search</div>
<div id="pay" role="button" tabindex="0" style="display:inline-block;background:#080;color:#fff;padding:10px 24px;cursor:pointer">Pay now</div>
<script>
  window.__clicks = []; document.addEventListener('click', (e) => window.__clicks.push(e.target.id || e.target.tagName), true);
  document.getElementById('pickup').addEventListener('click', () => {
    if (document.getElementById('pop')) return;
    const pop = document.createElement('div'); pop.id = 'pop'; pop.style.cssText = 'position:fixed;left:20px;top:200px;background:#fff;border:2px solid #333;padding:10px';
    const i = document.createElement('input'); i.type = 'text'; i.placeholder = 'Search pickup'; pop.append(i); document.body.append(pop); i.focus();
    i.addEventListener('input', () => { document.querySelector('#pickup span').textContent = i.value; });
  });
  document.getElementById('go').addEventListener('click', () => { window.__searched = true; });
  document.getElementById('pay').addEventListener('click', () => { window.__paid = true; });
</script></body></html>`;

/** A scripted stand-in for the model: reads the untrusted page JSON and proposes one action. No network. */
function fakeModel(system, user) {
  const page = JSON.parse(user.slice(user.indexOf('<untrusted_page_data>') + 21, user.indexOf('</untrusted_page_data>')));
  const hist = ((user.match(/History \(earlier actions\): (.*)/) || [])[1] || '[]');
  const origin = page.origin;
  const out = (o) => JSON.stringify(Object.assign({ riskLevel: 'low', requiresConfirmation: false, expectedOrigin: origin, reason: 'test' }, o));
  const pickup = (page.clickables || []).find((c) => /^Pickup/.test(c.label) || c.label === 'Pickup');
  if (pickup && !/ASK_QUESTION Pickup/.test(hist)) return out({ actionType: 'ASK_QUESTION', targetElementId: pickup.id, instruction: 'Where should the cab pick you up?' });
  const drop = page.elements.find((e) => e.label === 'Drop' && !e.hasValue);
  if (drop) return out({ actionType: 'ASK_QUESTION', targetElementId: drop.id, instruction: 'Where do you want to go?' });
  const card = page.elements.find((e) => e.sensitive);
  if (card && !/HUMAN_HANDOFF/.test(hist)) return out({ actionType: 'HUMAN_HANDOFF', targetElementId: card.id, instruction: 'Type your card yourself.' });
  const search = page.elements.find((e) => e.kind === 'button' && /^Search$/i.test(e.text || e.label) && !(JSON.parse(user.match(/Skipped ids: (.*)/)[1]) || []).includes(e.id));
  if (search && !/CLICK_ELEMENT/.test(hist)) return out({ actionType: 'CLICK_ELEMENT', targetElementId: search.id, requiresConfirmation: true, instruction: 'Press Search.' });
  return out({ actionType: 'COMPLETE_GUIDANCE', targetElementId: null, instruction: 'All done. Choose a cab yourself.' });
}

test('agent mode on a site that is not in the registry', { skip: exe ? false : 'Chrome not found (set CHROME_PATH)', timeout: 150000 }, async (t) => {
  const site = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGE); });
  await new Promise((r) => site.listen(5600, '127.0.0.1', r));
  const api = createApp({ converse: async (s, u) => fakeModel(s, u), aiConfigured: () => true, ttsConfigured: () => false });
  const backend = await new Promise((r) => { const sv = api.listen(8787, '127.0.0.1', () => r(sv)); });
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'websaathi-agent-'));
  const context = await chromium.launchPersistentContext(userDir, {
    executablePath: exe, headless: false,
    args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run']
  });
  t.after(async () => { await context.close(); site.close(); backend.close(); fs.rmSync(userDir, { recursive: true, force: true }); });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const panelUrl = `chrome-extension://${new URL(worker.url()).host}/sidepanel/sidepanel.html`;

  const page = await context.newPage();
  await page.goto('http://localhost:5600/');
  const probe = await context.newPage();
  await probe.goto(panelUrl);
  const tabId = await probe.evaluate(async () => (await chrome.tabs.query({ url: 'http://localhost:5600/*' }))[0].id);
  await probe.close();

  const panel = await context.newPage();
  await panel.goto(`${panelUrl}?targetTab=${tabId}`);
  await panel.waitForSelector('#screen-home:not([hidden])');

  await t.test('it needs a goal first, then starts on this unknown site', async () => {
    await panel.click('#help-page');
    assert.match(await panel.textContent('#intent-msg'), /tell me what you want to do/i);
    await panel.fill('#intent', 'book a cab to the airport');
    await panel.click('#help-page');
    await panel.waitForSelector('#screen-session:not([hidden])');
    assert.match(await panel.textContent('#site-name'), /localhost:5600/);
  });

  await t.test('asks, then types into a custom widget and a normal box only after confirmation', async () => {
    await panel.waitForSelector('#answer', { timeout: 15000 });
    assert.match(await panel.textContent('#question'), /pick you up/);
    await panel.fill('#answer', 'MG Road'); await panel.press('#answer', 'Enter');
    assert.equal(await page.evaluate(() => document.querySelector('#pickup span').textContent), 'Pickup', 'nothing typed before the tap');
    await panel.click('#confirm-yes');
    await page.waitForFunction(() => document.querySelector('#pickup span').textContent === 'MG Road');
    await panel.waitForFunction(() => /where do you want to go/i.test((document.querySelector('#question') || {}).textContent || ''), null, { timeout: 15000 });
    await panel.fill('#answer', 'Airport'); await panel.press('#answer', 'Enter');
    await panel.click('#confirm-yes');
    await page.waitForFunction(() => document.querySelector('#drop').value === 'Airport');
  });

  await t.test('card number is a human hand-off; Search is pressed only after a tap; Pay is never touched', async () => {
    await panel.waitForFunction(() => /card/i.test(document.querySelector('#card').textContent) && /yourself|your turn/i.test(document.querySelector('#card').textContent), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => document.querySelector('#card').value), '');
    // move past the hand-off the way a user would
    await panel.click('#handoff-done');
    await panel.waitForSelector('#confirm-yes', { timeout: 15000 });
    assert.match(await panel.textContent('#card'), /Search/);
    assert.equal(await page.evaluate(() => window.__searched || false), false, 'not pressed before the tap');
    await panel.click('#confirm-yes');
    await page.waitForFunction(() => window.__searched === true);
    assert.equal(await page.evaluate(() => window.__paid || false), false);
    assert.ok(!(await page.evaluate(() => window.__clicks)).includes('pay'));
  });
});
