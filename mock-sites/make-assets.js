'use strict';
// Renders the fictional proof-of-payment image used in the demo (run once; output is committed).
// node mock-sites/make-assets.js   (needs Chrome; set CHROME_PATH if not found)
const path = require('node:path');
const { chromium } = require('playwright-core');
const { chromePath } = require('../tests/browser/helpers.js');

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;width:540px;height:760px;display:grid;place-items:center;background:#eef1f4;font:400 16px/24px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111827}
.card{width:440px;background:#fff;border-radius:20px;padding:32px;box-shadow:0 8px 24px rgba(0,0,0,.06);display:grid;gap:20px}
.ok{width:56px;height:56px;border-radius:28px;background:#16a34a;display:grid;place-items:center;margin:0 auto}
h1{font-weight:500;font-size:20px;line-height:28px;margin:0;text-align:center}
.amt{font-size:40px;line-height:44px;font-weight:500;text-align:center;font-variant-numeric:tabular-nums}
dl{display:grid;grid-template-columns:140px 1fr;margin:0}dt,dd{margin:0;padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px}dt{color:#4b5565}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace}
.tag{font-size:12px;line-height:16px;color:#7a2e0e;background:#fdf0e6;border-radius:6px;padding:6px 10px;text-align:center}
</style><div class="card">
<div class="ok"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></div>
<h1>Payment successful</h1><div class="amt">₹2,499</div>
<dl><dt>Paid to</dt><dd>Steelhouse</dd><dt>For</dt><dd>Order <span class="mono">MS-48213</span></dd><dt>Date</dt><dd>28 Oct 2026, 11:04</dd><dt>Method</dt><dd>UPI</dd><dt>Transaction ID</dt><dd class="mono">PRACTICE-0001</dd></dl>
<div class="tag">Practice image for the WebSaathi demo. Not a real payment.</div></div>`;

(async () => {
  const browser = await chromium.launch({ executablePath: chromePath(), headless: true });
  const page = await browser.newPage({ viewport: { width: 540, height: 760 } });
  await page.setContent(html);
  const out = path.join(__dirname, 'assets', 'upi-payment-ms48213.png');
  await page.screenshot({ path: out });
  await browser.close();
  console.log('wrote', out);
})();
