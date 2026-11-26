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

test('store: sensitive excerpts are refused and URLs lose their query string (review on #6)', async () => {
  const s = C.createFakeStore();
  const c = await s.createCase('x');
  const url = 'http://localhost:5501/orders/MS-48213';
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213 · your OTP is 482913')), { code: 'SENSITIVE' });
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-48213', 'MS-48213 482913 is your OTP')), { code: 'SENSITIVE' });
  await assert.rejects(s.addFact(c.id, fact('refundAmount', '₹2,499', '₹2,499 paid from ravi@okhdfc')), { code: 'SENSITIVE' });
  await assert.rejects(s.addFact(c.id, fact('refundAmount', '₹2,499', '₹2,499 on card 4111 1111 1111 1111')), { code: 'SENSITIVE' });
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213', 'javascript:alert(1)')), { code: 'BAD_FACT' });
  const r = await s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213', url + '?token=abc#top'));
  assert.equal(r.facts[0].sourceUrl, url);
  assert.ok(r.timeline.every((e) => !e.sourceUrl || !/[?#]/.test(e.sourceUrl)));
  await s.addFact(c.id, fact('refundAmount', '₹2,499', 'Amount paid ₹2,499 (UPI)'));
  await s.addFact(c.id, fact('promisedDate', '12 Nov 2026', 'Refund by 12 Nov 2026'));
  const d = await s.setDocket(c.id, { number: 'CHP-2026-00417', portalUrl: 'http://localhost:5502/docket/CHP-2026-00417?session=1', status: 'Under review' });
  assert.equal(d.docket.portalUrl, 'http://localhost:5502/docket/CHP-2026-00417');
});

test('store: two stores on one storage (two open panels) never lose each other’s writes (review on #6)', async () => {
  const storage = C.memoryStorage();
  const a = C.createStore({ storage });
  const b = C.createStore({ storage });
  const c = await a.createCase('x');
  const notes = [];
  for (let i = 0; i < 10; i++) notes.push((i % 2 ? a : b).addEvent(c.id, { kind: 'note', text: 'note ' + i }));
  notes.push(a.addAttachment(c.id, { name: 'a.png', type: 'paymentProof', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }));
  notes.push(b.addAttachment(c.id, { name: 'b.png', type: 'receipt', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }));
  await Promise.all(notes);
  const r = await a.getCase(c.id);
  for (let i = 0; i < 10; i++) assert.ok(r.timeline.some((e) => e.text === 'note ' + i), 'note ' + i);
  assert.deepEqual(r.attachments.map((x) => x.name).sort(), ['a.png', 'b.png']);
});

test('next action names a receipt when that is what the draft reply attaches (review on #6)', async () => {
  const s = C.createFakeStore();
  const c = await s.createCase('x');
  for (const f of sample.facts) await s.addFact(c.id, f);
  await s.addAttachment(c.id, { name: 'receipt-ms48213.pdf', type: 'receipt', dataUrl: 'data:application/pdf;base64,JVBERi0=' });
  await s.setDocket(c.id, { number: 'CHP-2026-00417', portalUrl: 'http://localhost:5502/docket/CHP-2026-00417', status: 'Under review' });
  const r = await s.addEvent(c.id, { kind: 'request', text: 'Please upload proof of payment' });
  assert.equal(r.nextAction.kind, 'respond');
  assert.match(r.nextAction.text, /receipt-ms48213\.pdf/);
  assert.equal(P.draftProofReply(r, 'Please upload proof of payment').attachmentName, 'receipt-ms48213.pdf');
});

test('store: the same fact from a second page keeps the earlier source in the timeline (review on #6)', async () => {
  const s = C.createFakeStore();
  const c = await s.createCase('x');
  await s.addFact(c.id, fact('promisedDate', '12 Nov 2026', 'Refund by 12 Nov 2026'));
  const support = 'http://localhost:5501/support/MS-48213';
  let r = await s.addFact(c.id, fact('promisedDate', '12 Nov 2026', 'Your refund of ₹2,499 will reach you by 12 Nov 2026.', support));
  r = await s.addFact(c.id, fact('promisedDate', '12 Nov 2026', 'Your refund of ₹2,499 will reach you by 12 Nov 2026.', support));
  assert.equal(r.facts.length, 1);
  assert.equal(r.facts[0].sourceUrl, support, 'newest source is the fact’s');
  const earlier = r.timeline.filter((e) => e.kind === 'note' && e.text.startsWith('Also on'));
  assert.equal(earlier.length, 1, 'earlier source noted once');
  assert.equal(earlier[0].sourceUrl, 'http://localhost:5501/orders/MS-48213');
  assert.match(earlier[0].text, /“Refund by 12 Nov 2026”/);
});

test('store: an OTP anywhere in the fact is refused: value, excerpt or sourceUrl query (Codex, #6 item 1)', async () => {
  const s = C.createFakeStore();
  const c = await s.createCase('x');
  const order = 'http://localhost:5501/orders/MS-48213';
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213. OTP: 482913')), { code: 'SENSITIVE' });
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213', order + '?otp=482913')), { code: 'SENSITIVE' });
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213', order + '?q=otp%3D482913')), { code: 'SENSITIVE' });
  await assert.rejects(s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213', order + '?vpa=ravi@okhdfc')), { code: 'SENSITIVE' });
  const r = await s.addFact(c.id, fact('orderId', 'MS-48213', 'Order ID MS-48213', order + '?ref=email'));
  assert.equal(r.facts[0].sourceUrl, order, 'a harmless query is allowed and stripped');
});

test('store: each mutation takes the lock wsCase:<id>; the case list takes wsCase:index (Codex, #6 item 2)', async () => {
  const names = [];
  const storage = C.memoryStorage();
  const recording = (name, fn) => { names.push(name); return storage.lock(name, fn); };
  const s = C.createStore({ storage, lock: recording });
  const c = await s.createCase('x');
  await s.addEvent(c.id, { kind: 'note', text: 'hello' });
  await s.deleteCase(c.id);
  assert.deepEqual(names, ['wsCase:' + c.id, 'wsCase:index', 'wsCase:' + c.id, 'wsCase:' + c.id, 'wsCase:index']);
});

test('store: without Web Locks or an adapter lock, one instance still queues its own writes (fallback)', async () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const page = { navigator: {} }; // a browser without the Web Locks API
  page.globalThis = page;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'case', 'case-store.js'), 'utf8'), page);
  const storage = page.WebSaathiCase.memoryStorage();
  delete storage.lock;
  const s = page.WebSaathiCase.createStore({ storage });
  const c = await s.createCase('x');
  await Promise.all([1, 2, 3, 4, 5].map((i) => s.addEvent(c.id, { kind: 'note', text: 'n' + i })));
  assert.equal((await s.getCase(c.id)).timeline.length, 6);
});

test('fake-store.js works when loaded on its own, like a page that only includes that file (Codex, #6 item 3)', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'case', 'fake-store.js'), 'utf8');
  const page = { navigator: undefined };
  page.globalThis = page;
  vm.runInNewContext(src, page);
  assert.equal(typeof page.WebSaathiCase.createFakeStore, 'function');
  assert.equal(typeof page.WebSaathiCase.createStore, 'function');
  assert.equal(typeof page.WebSaathiCase.missingFacts, 'function');
  const store = page.WebSaathiCase.createFakeStore();
  return store.createCase('Refund for order MS-48213').then((c) => assert.equal(c.nextAction.kind, 'collect'));
});

test('fake-store.js is the store, regenerated from case-store.js (npm run sync:case)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '..', 'case');
  const fake = fs.readFileSync(path.join(dir, 'fake-store.js'), 'utf8');
  assert.ok(fake.endsWith(fs.readFileSync(path.join(dir, 'case-store.js'), 'utf8')), 'run npm run sync:case after changing case-store.js');
});
