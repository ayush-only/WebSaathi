'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');

const extension = path.resolve(__dirname, '../../extension');
const executable = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find((candidate) => candidate && fs.existsSync(candidate));
const seller = 'http://localhost:5501';

async function openDemo(t) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'websaathi-agent-'));
  let browser;
  let servers;
  const mock = path.resolve(__dirname, '../../mock-sites/server.js');
  t.after(async () => {
    await browser?.close();
    servers?.close();
    fs.rmSync(profile, { recursive: true, force: true });
  });
  if (fs.existsSync(mock)) {
    process.env.DATA_FILE = path.join(profile, 'dockets.json');
    servers = require(mock).start();
    await Promise.all([servers.seller, servers.helpline].map((server) => new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    })));
  }
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: executable,
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run']
  });
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker', { timeout: 10000 });
  const ext = 'chrome-extension://' + new URL(worker.url()).host;
  if (!servers) {
    // Contract fixtures let Person 1 test before Person 2's mock server lands.
    await browser.route(seller + '/orders/MS-48213', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      '<h1>Practice order</h1><dl><dt>Order ID</dt><dd>MS-48213</dd><dt>Amount paid</dt><dd>₹2,499</dd></dl><p hidden>Refund by 99 Nothing 2050</p>'
    }));
    await browser.route(seller + '/support/MS-48213', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      '<h1>Practice support</h1><p>Your refund of ₹2,499 will reach you by 12 Nov 2026.</p>'
    }));
  }
  const site = await browser.newPage();
  await site.goto(seller + '/orders/MS-48213');
  const panel = await browser.newPage();
  panel.setDefaultTimeout(10000);
  await panel.goto(ext + '/sidepanel/index.html');
  const id = await panel.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: url + '/*' });
    return tab.id;
  }, seller);
  await panel.goto(ext + '/sidepanel/index.html?targetTab=' + id);
  return { panel, site };
}

test('seller evidence keeps its sources and rejects an invented excerpt', { skip: !executable, timeout: 35000 }, async (t) => {
  const { panel, site } = await openDemo(t);
  await panel.evaluate(() => {
    globalThis.WebSaathi.api.extract = async () => [{
      key: 'promisedDate', value: '10 Dec 2026', excerpt: 'The refund arrives 10 Dec 2026.'
    }];
  });
  await panel.locator('#intent').fill('my refund never came');
  await panel.locator('#start-case').click();
  await panel.locator('[data-fact="refundAmount"]').waitFor().catch(async (err) => {
    throw new Error(await panel.locator('#status').innerText() + '\n' + await site.locator('body').innerText(), { cause: err });
  });
  assert.match(await panel.locator('[data-fact="orderId"]').innerText(), /MS-48213/);
  assert.equal(await panel.locator('[data-fact="refundAmount"] a').getAttribute('href'), seller + '/orders/MS-48213');
  assert.doesNotMatch(await panel.locator('#facts').innerText(), /10 Dec 2026|99 Nothing/);

  await panel.locator('#support').click();
  await site.waitForURL(seller + '/support/MS-48213');
  await panel.locator('#capture').click();
  await panel.locator('[data-fact="promisedDate"] a[href*="/support/"]').waitFor();
  assert.match(await panel.locator('[data-fact="promisedDate"] cite').innerText(), /Your refund of ₹2,499 will reach you by 12 Nov 2026/);
  assert.equal(await panel.locator('#facts li').count(), 3);
});

const helpline = 'http://localhost:5502';
const hasMockSites = fs.existsSync(path.resolve(__dirname, '../../mock-sites/server.js'));

async function fillComplaint(panel, site) {
  const values = [
    ['name', 'Ananya Rao', 'Ananya Rao'],
    ['mobile', '9000000000', '9000000000'],
    ['seller', 'Steelhouse', 'Steelhouse'],
    ['orderId', null, 'MS-48213'],
    ['amount', null, '₹2,499'],
    ['purchaseDate', '2026-10-28', '2026-10-28'],
    ['story', null, /₹2,499.*MS-48213.*12 Nov 2026/]
  ];
  for (const [field, answer, expected] of values) {
    if (answer) {
      await panel.locator('#field-answer').fill(answer);
      await panel.getByRole('button', { name: 'Review answer' }).click();
    }
    await panel.locator('#proposed-value').waitFor();
    const actual = site.locator('#f-' + field);
    assert.equal(await actual.inputValue(), '', field + ' wrote before approval');
    const preview = await panel.locator('#proposed-value').innerText();
    if (typeof expected === 'string') assert.equal(preview, expected);
    else assert.match(preview, expected);
    await panel.locator('#confirm-fill').click();
    await site.waitForFunction(([name, value]) => document.getElementById('f-' + name).value === value, [field, preview]);
  }
}

test('filing confirms each value and records the docket only after the user submits',
  { skip: !executable || !hasMockSites, timeout: 35000 }, async (t) => {
    const { panel, site } = await openDemo(t);
    await panel.locator('#intent').fill('my refund never came');
    await panel.locator('#start-case').click();
    await panel.locator('#open-filing').click();
    await site.waitForURL(helpline + '/file');
    await fillComplaint(panel, site);
    await panel.getByRole('button', { name: 'Point to Submit complaint' }).waitFor();
    assert.equal(site.url(), helpline + '/file');
    assert.equal(await panel.locator('#docket-number').count(), 0);
    await site.getByRole('button', { name: 'Submit complaint' }).click();
    await site.waitForURL(/\/docket\//);
    await panel.locator('#docket-number').waitFor();
    assert.equal(await panel.locator('#docket-number').innerText(), 'Docket ' + new URL(site.url()).pathname.split('/').at(-1));
    assert.equal(await panel.locator('#docket-status').innerText(), 'Under review');
  });
