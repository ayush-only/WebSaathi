'use strict';
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:http');
const test = require('node:test');
const { llm } = require('../src/config');
const { createApp } = require('../src/server');

async function listen(t, handler) {
  const server = createServer(handler).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

test('optional extraction redacts model input and falls back without a key or after a rate limit', async (t) => {
  const saved = { ...llm };
  t.after(() => Object.assign(llm, saved));
  const calls = [];
  const providerUrl = await listen(t, async (req, res) => {
    const parts = [];
    for await (const part of req) parts.push(part);
    calls.push({ path: req.url, authorization: req.headers.authorization, body: JSON.parse(Buffer.concat(parts)) });
    res.writeHead(calls.length === 1 ? 200 : 429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '{"facts":[]}' } }] }));
  });
  Object.assign(llm, { provider: 'compatible', baseUrl: providerUrl + '/v1/', apiKey: '', model: 'fixture-model' });
  const appUrl = await listen(t, createApp());

  async function extract() {
    const response = await fetch(appUrl + '/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'http://localhost:5501/orders/MS-48213',
        text: 'Order ID MS-48213 · UPI ID fictional@bank · OTP 482913 ' + 'ಕ'.repeat(10000)
      })
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.facts.find((fact) => fact.key === 'orderId').value, 'MS-48213');
    return result.source;
  }

  assert.equal(await extract(), 'local');
  assert.equal(calls.length, 0);
  llm.apiKey = 'test-key';
  assert.equal(await extract(), 'compatible');
  assert.equal(await extract(), 'local');
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.path, '/v1/chat/completions');
    assert.equal(call.authorization, 'Bearer test-key');
    assert.equal(call.body.model, 'fixture-model');
    const page = JSON.parse(call.body.messages.find(({ role }) => role === 'user').content).untrustedPage;
    assert.match(page.text, /Order ID MS-48213/);
    assert.doesNotMatch(page.text, /fictional@bank|482913/);
  }
});
