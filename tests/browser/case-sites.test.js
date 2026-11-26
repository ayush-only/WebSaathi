'use strict';
/** The practice sites behave as contract/demo.md says: labels, filing, validation, persistence, proof request, reply. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { chromePath, startSites } = require('./helpers');

const exe = chromePath();
const clean = (s) => s.replace(/\s+/g, ' ').trim();

test('practice sites follow the demo contract', { skip: exe ? false : 'Chrome not found (set CHROME_PATH)', timeout: 90000 }, async (t) => {
  const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ws-sites-')), 'dockets.json');
  let sites = startSites({ delayMs: 0, dataFile });
  const browser = await chromium.launch({ executablePath: exe });
  t.after(async () => { await browser.close(); sites.close(); });
  const page = await browser.newPage();
  const text = async () => clean(await page.evaluate(() => document.body.innerText));

  await t.test('seller pages show the facts the agent reads', async () => {
    await page.goto('http://localhost:5501/orders/MS-48213');
    const body = await text();
    for (const s of ['Order ID MS-48213', 'Amount paid ₹2,499 (UPI)', 'Refund status Approved, not received', 'Refund by 12 Nov 2026', 'Practice site']) assert.ok(body.includes(s), s);
    await page.goto('http://localhost:5501/support/MS-48213');
    assert.ok((await text()).includes('Your refund of ₹2,499 will reach you by 12 Nov 2026.'));
  });

  let docket;
  await t.test('helpline validates, files, and gives a docket number', async () => {
    await page.goto('http://localhost:5502/file');
    await page.getByRole('button', { name: 'Submit complaint' }).click();
    assert.match(await page.getByRole('alert').first().innerText(), /Please fix 7 fields below/);
    await page.getByLabel('Your name').fill('Asha Rao');
    await page.getByLabel('Mobile number').fill('9876543210');
    await page.getByLabel('Seller / company name').fill('Steelhouse');
    await page.getByLabel('Order ID').fill('MS-48213');
    await page.getByLabel('Amount (₹)').fill('2499');
    await page.getByLabel('Date of purchase').fill('2026-10-28');
    await page.getByLabel('What happened?').fill('The seller promised a refund of ₹2,499 by 12 Nov 2026. It never came.');
    await page.getByRole('button', { name: 'Submit complaint' }).click();
    await page.waitForURL(/\/docket\/CHP-2026-\d{5}$/);
    docket = page.url().split('/').pop();
    const body = await text();
    assert.ok(body.includes('Docket number ' + docket));
    assert.ok(body.includes('Amount ₹2,499') && body.includes('Date of purchase 28 Oct 2026'));
  });

  await t.test('dockets survive a server restart; then the portal asks for proof', async () => {
    sites.close();
    sites = startSites({ delayMs: 0, dataFile });
    await page.goto('http://localhost:5502/track?docket=' + docket.toLowerCase());
    await page.waitForURL(new RegExp(docket));
    const body = await text();
    assert.ok(body.includes('Status Information needed'));
    assert.ok(body.includes('Please upload proof of payment'));
    assert.ok(await page.getByLabel('Upload document').isVisible());
  });

  await t.test('Send needs a file; with the proof attached the reply is recorded', async () => {
    await page.getByRole('button', { name: 'Send' }).click();
    assert.match(await page.locator('#r-err').innerText(), /choose a file/);
    await page.getByLabel('Upload document').setInputFiles(path.join(__dirname, '..', '..', 'mock-sites', 'assets', 'upi-payment-ms48213.png'));
    await page.getByLabel('Your reply').fill('Proof of payment attached.');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.waitForFunction(() => /Reply received/.test(document.body.innerText));
    assert.ok((await text()).includes('You sent upi-payment-ms48213.png'));
  });
});
