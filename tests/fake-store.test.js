'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeStore, missingFacts } = require('../case/fake-store.js');

test('fake store follows the contract', async () => {
  const s = createFakeStore();
  const seen = [];
  s.onChange((c) => seen.push(c.updatedAt));
  const c = await s.createCase('Refund for order MS-48213');
  await s.setActiveCase(c.id);
  assert.equal((await s.getActiveCase()).id, c.id);
  assert.deepEqual(missingFacts(c), ['orderId', 'refundAmount', 'promisedDate']);
  await assert.rejects(s.addFact(c.id, { key: 'orderId', value: 'MS-1', sourceUrl: 'x', excerpt: 'Order ID MS-48213' }), { code: 'BAD_FACT' });
  let r = await s.addFact(c.id, { key: 'orderId', value: 'MS-48213', sourceUrl: 'http://localhost:5501/orders/MS-48213', excerpt: 'Order ID MS-48213' });
  assert.equal(r.facts.length, 1);
  r = await s.setDocket(c.id, { number: 'CHP-2026-00417', portalUrl: 'http://localhost:5502/docket/CHP-2026-00417', status: 'Under review' });
  assert.equal(r.timeline.at(-1).kind, 'filed');
  r = await s.setDocket(c.id, { number: 'CHP-2026-00417', status: 'Information needed' });
  assert.equal(r.timeline.at(-1).kind, 'status');
  assert.ok(seen.length >= 4);
});
