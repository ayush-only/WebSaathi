'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { openDemo, fillComplaint, executable, hasMockSites, helpline } = require('./agent-refund.test');

test('Chrome restart restores the case and its saved proof for a manual reply',
  { skip: !executable || !hasMockSites, timeout: 35000 }, async (t) => {
    const demo = await openDemo(t);
    let { panel, site } = demo;
    await panel.locator('#intent').fill('my refund never came');
    await panel.locator('#start-case').click();
    await panel.locator('#save-proof').click();
    await panel.getByText('Practice proof saved to this case.').waitFor();
    await panel.locator('#open-filing').click();
    await site.waitForURL(helpline + '/file');
    await fillComplaint(panel, site);
    await panel.getByRole('button', { name: 'Point to Submit complaint' }).waitFor();
    await site.getByRole('button', { name: 'Submit complaint' }).click();
    await site.waitForURL(/\/docket\//);
    await panel.locator('#timeline .wsc-stamp span').waitFor();
    const portalUrl = site.url();

    const response = await fetch(helpline + '/admin/simulate/' + portalUrl.split('/').at(-1), { method: 'POST' });
    assert.equal(response.status, 200);
    ({ panel, site } = await demo.restart(portalUrl));
    await panel.locator('#timeline').getByText('MS-48213', { exact: true }).waitFor();
    assert.equal(await panel.locator('#timeline .wsc-stamp span').innerText(), portalUrl.split('/').at(-1));
    await panel.locator('#proof-request-title').waitFor();
    assert.match(await panel.locator('#proof-request').innerText(), /भुगतान का सबूत/);
    assert.match(await panel.locator('#proof-name').innerText(), /upi-payment-ms48213\.png/);
    assert.match(await panel.locator('#proof-draft').innerText(), /proof of payment/i);
    await panel.getByRole('button', { name: 'Point to Upload document' }).click();
    const question = panel.getByRole('textbox', { name: 'Ask about this reply' });
    await question.fill('Press Send for me');
    await question.press('Enter');
    await panel.getByText('You need to press Send yourself after reviewing the reply.').waitFor();
    await question.fill('OTP 482913');
    await question.press('Enter');
    await panel.getByText('I can’t use an OTP or other sensitive information.').waitFor();
    assert.equal(await question.inputValue(), '');
    assert.equal(await site.locator('#r-file').inputValue(), '');
    assert.equal(await site.locator('#r-msg').inputValue(), '');
    assert.equal(await site.locator('.status').innerText(), 'Information needed');
    const [download] = await Promise.all([
      panel.waitForEvent('download'),
      panel.locator('#timeline').getByRole('button', { name: /upi-payment-ms48213/ }).click()
    ]);
    const name = download.suggestedFilename();
    const buffer = fs.readFileSync(await download.path());
    assert.equal(name, 'upi-payment-ms48213.png');
    assert.deepEqual(buffer, fs.readFileSync(path.resolve(__dirname, '../../mock-sites/assets', name)));
    await site.locator('#r-file').setInputFiles({ name, mimeType: 'image/png', buffer });
    await site.locator('#r-msg').fill(await panel.locator('#proof-draft').innerText());
    await site.getByRole('button', { name: 'Send', exact: true }).click();
    await panel.locator('#timeline .wsc-filed').getByText('Reply received, under review', { exact: true }).waitFor();
    assert.equal(await panel.locator('#proof-request').isVisible(), false);
  });
