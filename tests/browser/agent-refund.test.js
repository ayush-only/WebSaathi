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
  function launch() {
    return chromium.launchPersistentContext(profile, {
      executablePath: executable,
      headless: false,
      args: ['--headless=new', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run']
    });
  }
  browser = await launch();
  if (!servers) {
    // Contract fixtures let Person 1 test before Person 2's mock server lands.
    await browser.route(seller + '/orders/MS-48213', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      '<h1>Practice order</h1><dl><dt>Order ID</dt><dd>MS-48213</dd><dt>Amount paid</dt><dd>₹2,499</dd></dl><p hidden>Refund by 99 Nothing 2050</p>'
    }));
    await browser.route(seller + '/support/MS-48213', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      '<h1>Practice support</h1><p>Your refund of ₹2,499 will reach you by 12 Nov 2026.</p>'
    }));
  }
  async function openPage(url) {
    const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker', { timeout: 10000 });
    const ext = 'chrome-extension://' + new URL(worker.url()).host;
    const site = await browser.newPage();
    await site.goto(url);
    const panel = await browser.newPage();
    panel.setDefaultTimeout(10000);
    await panel.goto(ext + '/sidepanel/index.html');
    const id = await panel.evaluate(async (pageUrl) => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((tab) => tab.url === pageUrl).id;
    }, site.url());
    await panel.goto(ext + '/sidepanel/index.html?targetTab=' + id);
    return { panel, site };
  }

  return {
    ...await openPage(seller + '/orders/MS-48213'),
    async restart(url) {
      await browser.close();
      browser = await launch();
      return openPage(url);
    }
  };
}

if (require.main === module) test('seller evidence keeps its sources and rejects an invented excerpt', { skip: !executable, timeout: 35000 }, async (t) => {
  const { panel, site } = await openDemo(t);
  await panel.evaluate(() => {
    globalThis.WebSaathi.api.extract = async () => [{
      key: 'promisedDate', value: '10 Dec 2026', excerpt: 'The refund arrives 10 Dec 2026.'
    }];
  });
  await panel.locator('#intent').fill('my refund never came');
  await panel.locator('#start-case').click();
  const timeline = panel.locator('#timeline');
  const amount = timeline.getByText('₹2,499', { exact: true });
  await amount.waitFor().catch(async (err) => {
    throw new Error(await panel.locator('#status').innerText() + '\n' + await site.locator('body').innerText(), { cause: err });
  });
  await timeline.getByText('MS-48213', { exact: true }).waitFor();
  assert.ok(await timeline.locator('button[title="' + seller + '/orders/MS-48213"]').count());
  assert.doesNotMatch(await timeline.innerText(), /10 Dec 2026|99 Nothing/);

  await panel.locator('#support').click();
  await site.waitForURL(seller + '/support/MS-48213');
  await panel.locator('#capture').click();
  await timeline.locator('button[title="' + seller + '/support/MS-48213"]').waitFor();
  await timeline.getByText(/Your refund of ₹2,499 will reach you by 12 Nov 2026/).waitFor();
  assert.equal(await timeline.locator('button[data-fact]').count(), 3);

  const otherPanel = await panel.context().newPage();
  await otherPanel.goto(panel.url());
  await otherPanel.evaluate(async () => {
    const writer = globalThis.WebSaathiCase.createStore();
    const activeCase = await writer.getActiveCase();
    await writer.addEvent(activeCase.id, { kind: 'note', text: 'Saved from another panel' });
  });
  await timeline.getByRole('listitem').filter({ hasText: 'Saved from another panel' }).waitFor();
  await otherPanel.close();
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
      if (field === 'mobile') {
        await panel.locator('#field-answer').fill('OTP 482913');
        await panel.getByRole('button', { name: 'Review answer' }).click();
        await panel.getByText('Enter only the requested information.').waitFor();
        assert.equal(await panel.locator('#field-answer').inputValue(), '');
        assert.equal(await site.locator('#f-mobile').inputValue(), '');
      }
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

if (require.main === module) test('filing confirms each value and records the docket only after the user submits',
  { skip: !executable || !hasMockSites, timeout: 35000 }, async (t) => {
    const { panel, site } = await openDemo(t);
    await panel.locator('#intent').fill('my refund never came');
    await panel.locator('#start-case').click();
    await panel.locator('#open-filing').click();
    await site.waitForURL(helpline + '/file');
    await panel.locator('#lang').selectOption('hi');
    await panel.getByRole('heading', { name: 'अभ्यास शिकायत दर्ज करें' }).waitFor();
    await panel.locator('#lang').selectOption('kn');
    await panel.getByRole('heading', { name: 'ಅಭ್ಯಾಸ ದೂರು ಸಲ್ಲಿಸಿ' }).waitFor();
    await panel.locator('#lang').selectOption('en');
    await panel.getByRole('heading', { name: 'File the practice complaint' }).waitFor();
    await fillComplaint(panel, site);
    await panel.getByRole('button', { name: 'Point to Submit complaint' }).waitFor();
    assert.equal(site.url(), helpline + '/file');
    assert.equal(await panel.locator('#timeline .wsc-stamp span').count(), 0);
    await site.getByRole('button', { name: 'Submit complaint' }).click();
    await site.waitForURL(/\/docket\//);
    await panel.locator('#timeline .wsc-stamp span').waitFor();
    assert.equal(await panel.locator('#timeline .wsc-stamp span').innerText(), new URL(site.url()).pathname.split('/').at(-1));
    assert.equal(await panel.locator('#timeline .wsc-filed').getByText('Under review', { exact: true }).innerText(), 'Under review');
  });

module.exports = { openDemo, fillComplaint, executable, hasMockSites, helpline };
