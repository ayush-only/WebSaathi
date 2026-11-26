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
  t.after(async () => {
    await browser?.close();
    fs.rmSync(profile, { recursive: true, force: true });
  });
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: executable,
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run']
  });
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker', { timeout: 10000 });
  const ext = 'chrome-extension://' + new URL(worker.url()).host;
  const sellerServer = await fetch(seller + '/orders/MS-48213', { signal: AbortSignal.timeout(600) }).catch(() => null);
  if (!sellerServer?.ok) {
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
