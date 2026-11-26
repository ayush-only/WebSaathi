'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../case/case-store.js');
const P = require('../case/proof.js');
const sample = require('../case/fixtures/sample-case.json');

const fact = (key, value, excerpt, url = 'http://localhost:5501/orders/MS-48213') => ({ key, value, excerpt, sourceUrl: url });

test('store: persistence through a shared storage adapter (two stores = two extension pages, or before/after restart)', async () => {
  const storage = C.memoryStorage();
  const a = C.createStore({ storage });
  const c = await a.createCase('Refund for order MS-48213');
  await a.setActiveCase(c.id);
  await a.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID\nMS-48213'));
  const b = C.createStore({ storage }); // a "new session" reading the same storage
  const back = await b.getActiveCase();
  assert.equal(back.id, c.id);
  assert.equal(back.facts[0].excerpt, 'Order ID MS-48213', 'whitespace normalised');
  assert.equal(back.nextAction.kind, 'collect');
  assert.equal((await b.listCases()).length, 1);
});

test('store: rules from the contract', async () => {
  const s = C.createFakeStore();
  const c = await s.createCase('x');
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-1', 'Order ID MS-48213')), { code: 'BAD_FACT' });
  await assert.rejects(s.addFact(c.id, fact('orderId', '4111 1111 1111 1111', 'card 4111 1111 1111 1111')), { code: 'SENSITIVE' });
  await assert.rejects(s.addAttachment(c.id, { name: 'x.png', dataUrl: 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024) }), { code: 'TOO_LARGE' });
  await assert.rejects(s.addEvent(c.id, { kind: 'hack', text: 'x' }), { code: 'BAD_EVENT' });
  await assert.rejects(s.getCase('nope').then((x) => { if (!x) throw Object.assign(new Error(), { code: 'NONE' }); }), { code: 'NONE' });
});

test('store: writes are queued, so parallel calls all land', async () => {
  const s = C.createFakeStore();
  const c = await s.createCase('x');
  await Promise.all([
    s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213')),
    s.addFact(c.id, fact('refundAmount', '₹2,499', 'Amount paid ₹2,499 (UPI)')),
    s.addFact(c.id, fact('promisedDate', '12 Nov 2026', 'Your refund of ₹2,499 will reach you by 12 Nov 2026.', 'http://localhost:5501/support/MS-48213'))
  ]);
  const r = await s.getCase(c.id);
  assert.equal(r.facts.length, 3);
  assert.deepEqual(C.missingFacts(r), []);
  assert.equal(r.nextAction.kind, 'file');
});

test('next action follows the refund story: collect → file → wait → respond → wait', async () => {
  const s = C.createFakeStore();
  const seen = [];
  s.onChange((x) => seen.push(x.nextAction.kind));
  const c = await s.createCase('x');
  for (const f of sample.facts) await s.addFact(c.id, f);
  await s.addAttachment(c.id, { name: 'upi-payment-ms48213.png', type: 'paymentProof', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
  await s.setDocket(c.id, { number: 'CHP-2026-00417', portalUrl: 'http://localhost:5502/docket/CHP-2026-00417', status: 'Under review' });
  let r = await s.setDocket(c.id, { number: 'CHP-2026-00417', status: 'Under review' });
  assert.equal(r.timeline.filter((e) => e.kind === 'status').length, 0, 'same status twice adds nothing');
  assert.equal(r.nextAction.kind, 'wait');
  await s.addEvent(c.id, { kind: 'request', text: 'Please upload proof of payment' });
  r = await s.addEvent(c.id, { kind: 'request', text: 'Please upload proof of payment' });
  assert.equal(r.timeline.filter((e) => e.kind === 'request').length, 1, 'same request on reload is not repeated');
  assert.equal(r.nextAction.kind, 'respond');
  assert.match(r.nextAction.text, /upi-payment-ms48213\.png/);
  r = await s.addEvent(c.id, { kind: 'reply', text: 'Sent upi-payment-ms48213.png' });
  assert.equal(r.nextAction.kind, 'wait');
  assert.ok(seen.includes('collect') && seen.includes('file') && seen.includes('respond'));
});

test('proof helpers', () => {
  assert.equal(P.excerptOnPage('Order ID\tMS-48213\nOrdered on 28 Oct', 'Order ID MS-48213'), true);
  assert.equal(P.excerptOnPage('Order ID MS-48213', 'Order ID MS-99999'), false);
  assert.equal(P.isRequestForProof('Please upload proof of payment'), true);
  assert.equal(P.isRequestForProof('Upload a screenshot of the payment'), true);
  assert.equal(P.isRequestForProof('Your complaint is under review'), false);
  const d = P.draftProofReply(sample, 'Please upload proof of payment');
  assert.equal(d.attachmentId, 'att_demo0001');
  assert.match(d.text, /MS-48213.*₹2,499.*12 Nov 2026/);
  assert.equal(P.draftProofReply(sample, 'Status: under review'), null);
  assert.equal(P.draftProofReply(Object.assign({}, sample, { attachments: [] }), 'Please upload proof of payment'), null);
  assert.match(P.explainRequest(sample, 'Please upload proof of payment', 'hi'), /सबूत.*upi-payment-ms48213\.png/);
  assert.match(P.explainRequest(sample, 'Please upload proof of payment', 'kn'), /ಪುರಾವೆ/);
});
