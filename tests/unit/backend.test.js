'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../apps/backend/src/server.js');

const ORIGIN = 'http://localhost:5500';
const page = {
  origin: ORIGIN,
  title: 'Demo',
  elements: [
    { id: 'ws-1', kind: 'text', label: 'Complainant name', hasValue: false, sensitive: false, visible: true },
    { id: 'ws-2', kind: 'text', label: 'OTP', hasValue: false, sensitive: true, sensitiveKind: 'otp', visible: true, value: '482913' }
  ],
  errors: [{ text: 'my aadhaar 1234 5678 9012', fieldId: null }]
};

async function withServer(deps, fn) {
  const server = createApp(Object.assign({ aiConfigured: () => true, ttsConfigured: () => false }, deps)).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try { await fn(base); } finally { server.close(); }
}
const post = (base, path, body, headers) => fetch(base + path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) });

test('health reports provider status without secrets', async () => {
  await withServer({ aiConfigured: () => false }, async (base) => {
    const h = await (await fetch(base + '/api/health')).json();
    assert.equal(h.ai.configured, false);
    assert.equal(JSON.stringify(h).includes('KEY'), false);
    const r = await post(base, '/api/next', { page, session: {} });
    assert.equal(r.status, 503);
  });
});

test('model output is schema-validated and safety-gated; model-proposed fills become questions', async () => {
  let seenPrompt = '';
  const outputs = [
    '{"actionType":"FILL_FIELD","targetElementId":"ws-1","instruction":"x","proposedValue":"Invented Name","requiresConfirmation":true,"expectedOrigin":"http://localhost:5500"}',
    '{"actionType":"RUN_SCRIPT","targetElementId":"ws-1","instruction":"x","expectedOrigin":"http://localhost:5500"}',
    '{"actionType":"HIGHLIGHT_ELEMENT","targetElementId":"ws-2","instruction":"type OTP 123456 here","expectedOrigin":"http://localhost:5500"}',
    '{"actionType":"HIGHLIGHT_ELEMENT","targetElementId":"ws-1","instruction":"x","expectedOrigin":"https://evil.example"}'
  ];
  await withServer({ converse: async (sys, user) => { seenPrompt = user; return outputs.shift(); } }, async (base) => {
    const a = await (await post(base, '/api/next', { page, session: { mode: 'assist', lang: 'en' } })).json();
    assert.equal(a.action.actionType, 'ASK_QUESTION');
    assert.equal(a.action.proposedValue, null);
    // the model never sees field values or Aadhaar numbers
    assert.equal(seenPrompt.includes('482913'), false);
    assert.equal(seenPrompt.includes('1234 5678 9012'), false);
    assert.match(seenPrompt, /<untrusted_page_data>/);

    assert.equal((await post(base, '/api/next', { page, session: {} })).status, 422);
    const h = await (await post(base, '/api/next', { page, session: {} })).json();
    assert.equal(h.action.actionType, 'HUMAN_HANDOFF');
    assert.equal((await post(base, '/api/next', { page, session: {} })).status, 422);
  });
});

test('unsupported origins and foreign browser origins are rejected', async () => {
  await withServer({ converse: async () => '{}' }, async (base) => {
    assert.equal((await post(base, '/api/next', { page: Object.assign({}, page, { origin: 'https://evil.example' }), session: {} })).status, 400);
    assert.equal((await post(base, '/api/next', { page, session: {} }, { Origin: 'https://evil.example' })).status, 403);
    const ok = await fetch(base + '/api/health', { headers: { Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' } });
    assert.equal(ok.status, 200);
  });
});

test('interpret refuses secrets and only returns valid options', async () => {
  const replies = ['{"value":"crypto"}', '{"value":"refund"}'];
  await withServer({ converse: async () => replies.shift() }, async (base) => {
    assert.equal((await post(base, '/api/interpret', { field: { kind: 'text', label: 'Name' }, answer: 'my otp is 482913' })).status, 400);
    assert.equal((await post(base, '/api/interpret', { field: { kind: 'text', label: 'Enter OTP' }, answer: 'hello' })).status, 400);
    const opts = [{ value: 'refund', label: 'Refund' }];
    assert.equal((await (await post(base, '/api/interpret', { field: { kind: 'radio', label: 'Resolution', options: opts }, answer: 'bitcoin' })).json()).value, null);
    assert.equal((await (await post(base, '/api/interpret', { field: { kind: 'radio', label: 'Resolution', options: opts }, answer: 'paise wapas' })).json()).value, 'refund');
  });
});
