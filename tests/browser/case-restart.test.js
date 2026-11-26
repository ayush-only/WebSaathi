'use strict';
/* global store, WebSaathiCase */
/**
 * The case survives closing and reopening Chrome (chrome.storage.local in a real extension profile),
 * other extension pages see changes, and the timeline renders the saved case with the proof reply ready.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { ROOT, chromePath } = require('./helpers');

const exe = chromePath();
const PROOF = path.join(ROOT, 'mock-sites', 'assets', 'upi-payment-ms48213.png');

/** A throwaway extension that loads only the case/ code, so this test doesn't depend on Person 1's extension. */
function makeExtension() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-case-ext-'));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'case test', version: '0.0.1', permissions: ['storage', 'unlimitedStorage'],
    background: { service_worker: 'sw.js' }
  }));
  fs.writeFileSync(path.join(dir, 'sw.js'), '');
  for (const f of ['case-store.js', 'proof.js', 'timeline.js']) fs.copyFileSync(path.join(ROOT, 'case', f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'page.html'), `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;width:360px;background:#fff">
<div id="view"></div><script src="case-store.js"></script><script src="proof.js"></script><script src="timeline.js"></script>
<script src="init.js"></script></body>`);
  // MV3 extension pages block inline <script>, so the setup must be its own file.
  fs.writeFileSync(path.join(dir, 'init.js'), 'window.store = WebSaathiCase.createStore(); window.ready = true;');
  return dir;
}

async function launch(userDir, ext) {
  const ctx = await chromium.launchPersistentContext(userDir, { executablePath: exe, headless: false,
    args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-first-run'] });
  let [w] = ctx.serviceWorkers();
  if (!w) w = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const url = `chrome-extension://${new URL(w.url()).host}/page.html`;
  const open = async () => { const p = await ctx.newPage(); await p.goto(url); await p.waitForFunction(() => window.ready, null, { timeout: 10000 }); return p; };
  return { ctx, open };
}

test('case survives a browser restart', { skip: exe ? false : 'Chrome not found', timeout: 120000 }, async (t) => {
  const ext = makeExtension();
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-case-profile-'));
  t.after(() => { fs.rmSync(userDir, { recursive: true, force: true }); fs.rmSync(ext, { recursive: true, force: true }); });
  const proofUrl = 'data:image/png;base64,' + fs.readFileSync(PROOF).toString('base64');

  await t.test('session 1: build the case; a second page sees each change', async (st) => {
    const { ctx, open } = await launch(userDir, ext);
    st.after(() => ctx.close().catch(() => {})); // close Chrome even when an assertion fails, so the run never hangs
    const a = await open();
    const b = await open();
    await b.evaluate(() => { window.seen = []; store.onChange((c) => window.seen.push(c.nextAction.kind)); });
    await a.evaluate(async (proof) => {
      const c = await store.createCase('Refund for order MS-48213');
      await store.setActiveCase(c.id);
      await store.addFact(c.id, { key: 'orderId', value: 'MS-48213', excerpt: 'Order ID\nMS-48213', sourceUrl: 'http://localhost:5501/orders/MS-48213' });
      await store.addFact(c.id, { key: 'refundAmount', value: '₹2,499', excerpt: 'Amount paid\t₹2,499 (UPI)', sourceUrl: 'http://localhost:5501/orders/MS-48213' });
      await store.addFact(c.id, { key: 'promisedDate', value: '12 Nov 2026', excerpt: 'Your refund of ₹2,499 will reach you by 12 Nov 2026.', sourceUrl: 'http://localhost:5501/support/MS-48213' });
      await store.addAttachment(c.id, { name: 'upi-payment-ms48213.png', type: 'paymentProof', dataUrl: proof });
      await store.setDocket(c.id, { number: 'CHP-2026-00417', portalUrl: 'http://localhost:5502/docket/CHP-2026-00417', status: 'Under review' });
    }, proofUrl);
    await b.waitForFunction(() => window.seen.includes('wait'), null, { timeout: 10000 });
    const seen = await b.evaluate(() => window.seen);
    assert.ok(seen.includes('collect') && seen.includes('file') && seen.includes('wait'), seen.join(','));

    // BOTH pages write to the same case at the same moment. Each page has its own store instance, so only the
    // Web Lock 'wsCase:<id>' (shared by extension pages) keeps every write.
    const caseId = await a.evaluate(async () => (await store.getActiveCase()).id);
    const write = (p, who) => p.evaluate(async ([id, w]) => {
      await new Promise((r) => setTimeout(r, 300 - (Date.now() % 300))); // line both pages up on the same tick
      await Promise.all([1, 2, 3, 4, 5].map((i) => store.addEvent(id, { kind: 'note', text: `note ${w}${i}` }))
        .concat(store.addAttachment(id, { name: `receipt-${w}.png`, type: 'receipt', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' })));
    }, [caseId, who]);
    await Promise.all([write(a, 'a'), write(b, 'b')]);
    const after = await b.evaluate(async (id) => {
      const c = await store.getCase(id);
      return { notes: c.timeline.filter((e) => /^note [ab]\d$/.test(e.text)).map((e) => e.text).sort(), files: c.attachments.map((x) => x.name).sort() };
    }, caseId);
    assert.deepEqual(after.notes, ['note a1', 'note a2', 'note a3', 'note a4', 'note a5', 'note b1', 'note b2', 'note b3', 'note b4', 'note b5']);
    assert.deepEqual(after.files, ['receipt-a.png', 'receipt-b.png', 'upi-payment-ms48213.png']);
    await ctx.close();
  });

  await t.test('session 2: Chrome reopened; the case is there and the proof request can be answered', async (st) => {
    const { ctx, open } = await launch(userDir, ext);
    st.after(() => ctx.close().catch(() => {})); // close Chrome even when an assertion fails, so the run never hangs
    const p = await open();
    const r = await p.evaluate(async () => {
      const c = await store.getActiveCase();
      const after = await store.addEvent(c.id, { kind: 'request', text: 'Portal asks: Please upload proof of payment', sourceUrl: c.docket.portalUrl });
      await store.setDocket(c.id, { number: c.docket.number, status: 'Information needed' });
      const now = await store.getActiveCase();
      WebSaathiCase.renderTimeline(document.getElementById('view'), now, { lang: 'en' });
      return { facts: now.facts.length, att: now.attachments[0].name, next: after.nextAction.kind,
        draft: WebSaathiCase.draftProofReply(now, 'Please upload proof of payment'),
        hi: WebSaathiCase.explainRequest(now, 'Please upload proof of payment', 'hi'), text: document.getElementById('view').innerText };
    });
    assert.equal(r.facts, 3);
    assert.equal(r.att, 'upi-payment-ms48213.png');
    assert.equal(r.next, 'respond');
    assert.match(r.draft.text, /MS-48213/);
    assert.match(r.hi, /upi-payment-ms48213\.png/);
    for (const s of ['Next step', 'Attach upi-payment-ms48213.png', 'CHP-2026-00417', 'Information needed', 'localhost:5501/orders/MS-48213', '“Order ID MS-48213”']) assert.ok(r.text.includes(s), s);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
    await ctx.close();
  });
});
