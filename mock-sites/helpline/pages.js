'use strict';
// Practice "Consumer Help Portal" (fictional, not the real National Consumer Helpline). Labels follow contract/demo.md.
const { esc, baseCss, page } = require('../shared.js');

const css = baseCss({ bg: '#f5f7fa', card: '#ffffff', raised: '#eceff4', ink: '#111827', ink2: '#4b5565', muted: '#5f6879',
  accent: '#23439a', accentInk: '#1b3479', onAccent: '#ffffff' }) + `
.intro{margin:40px 0 24px;display:grid;gap:8px;max-width:680px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.tile{padding:24px;display:grid;gap:12px;align-content:start}
form.complaint{padding:32px;display:grid;gap:24px;max-width:760px}
fieldset{border:0;margin:0;padding:0;display:grid;gap:16px}
legend{font-weight:500;font-size:16px;margin-bottom:16px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.err{color:#b42318;font-size:13px;line-height:20px}
.errbox{border:1px solid #f1c4bf;background:#fdf3f2;color:#8a1c12;border-radius:12px;padding:12px 16px;font-size:14px}
.note{font-size:13px;line-height:20px;color:var(--muted)}
.stamp{display:inline-grid;gap:2px;padding:12px 16px;border:1.5px solid var(--accent-ink);border-radius:8px;color:var(--accent-ink)}
.stamp small{font-size:12px;line-height:16px;color:var(--ink2)}
.stamp span{font-family:var(--mono);font-size:22px;line-height:28px;font-weight:500;letter-spacing:.02em}
.docket{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:24px;margin-top:24px;align-items:start}
.panel{padding:24px}
.status{display:inline-flex;align-items:center;gap:8px;font-weight:500}
.status i{width:8px;height:8px;border-radius:4px;background:var(--muted)}
.status.need i{background:#b54708}.status.ok i{background:#16a34a}
ol.tl{list-style:none;margin:16px 0 0;padding:0;position:relative}
ol.tl li{position:relative;padding:0 0 20px 28px}
ol.tl li::before{content:"";position:absolute;left:5px;top:6px;width:10px;height:10px;border-radius:5px;background:var(--card);border:2px solid var(--ink2)}
ol.tl li::after{content:"";position:absolute;left:10px;top:20px;bottom:0;width:1.5px;background:color-mix(in srgb,var(--ink) 14%,transparent)}
ol.tl li:last-child::after{display:none}
ol.tl li.need::before{border-color:#b54708;background:#b54708}
ol.tl .when{display:block;font-size:13px;color:var(--muted)}
.request{border:1px solid #f0d3b4;background:#fdf6ee;border-radius:14px;padding:20px;display:grid;gap:16px;margin-top:24px}
.request h2{font-size:18px}
dl.sum{display:grid;grid-template-columns:150px 1fr;margin:0}
dl.sum dt,dl.sum dd{margin:0;padding:10px 0;border-bottom:1px solid var(--line);font-size:14px}
dl.sum dt{color:var(--ink2)}
table.adm{width:100%;border-collapse:collapse;font-size:14px}
table.adm th,table.adm td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--line)}
table.adm th{color:var(--ink2);font-weight:500}
@media (max-width:820px){.grid2,.docket,.two{grid-template-columns:1fr}form.complaint{padding:20px}}
`;

function shell(title, inner) {
  return page({ title: title + ' · Consumer Help Portal (practice)', css, body: `
<div class="practice"><strong>Practice site.</strong> A fictional complaint portal made for the WebSaathi demo. It is not the National Consumer Helpline and nothing here is sent anywhere.</div>
<header class="top"><div class="wrap"><a class="brand" href="/">Consumer Help Portal</a><nav class="links" aria-label="Main"><a href="/file">File a complaint</a><a href="/#track">Track a complaint</a></nav></div></header>
<main class="wrap">${inner}</main>
<footer class="wrap foot">Consumer Help Portal · practice site for WebSaathi · all data is made up</footer>` });
}

function home(msg) {
  return shell('Home', `
<div class="intro"><h1>Get help with a shop that did not keep its promise</h1>
<p class="ink2" style="margin:0">File a complaint about a refund, a faulty product or a service. You get a docket number to follow it.</p></div>
<div class="grid2">
 <section class="card tile"><h2>File a complaint</h2><p class="ink2" style="margin:0">Takes about 5 minutes. Keep your order details ready.</p><div><a class="btn btn-primary" href="/file">Start a complaint</a></div></section>
 <section class="card tile" id="track"><h2>Track a complaint</h2>
  <form method="get" action="/track" style="display:grid;gap:12px">
   <label class="field">Docket number<input name="docket" autocomplete="off" placeholder="CHP-2026-00417" class="mono"></label>
   ${msg ? `<p class="err" role="alert">${esc(msg)}</p>` : ''}
   <div><button class="btn btn-quiet" type="submit">Track</button></div>
  </form></section>
</div>`);
}

const FIELDS = [
  ['name', 'Your name', 'text', 'name'], ['mobile', 'Mobile number', 'tel', 'tel'],
  ['seller', 'Seller / company name', 'text', 'organization'], ['orderId', 'Order ID', 'text', 'off'],
  ['amount', 'Amount (₹)', 'text', 'off'], ['purchaseDate', 'Date of purchase', 'date', 'off']
];

function validate(f) {
  const e = {};
  if (!f.name || f.name.trim().length < 2) e.name = 'Please enter your name.';
  if (!/^[6-9]\d{9}$/.test(String(f.mobile || '').replace(/\D/g, '').slice(-10)) || String(f.mobile || '').replace(/\D/g, '').length < 10) e.mobile = 'Please enter a 10-digit mobile number.';
  if (!f.seller || f.seller.trim().length < 2) e.seller = 'Please enter the seller or company name.';
  if (!f.orderId || f.orderId.trim().length < 3) e.orderId = 'Please enter the order ID.';
  if (!/^\d[\d,]*(\.\d{1,2})?$/.test(String(f.amount || '').replace(/[₹\s]/g, ''))) e.amount = 'Please enter the amount in rupees, for example 2499.';
  if (!f.purchaseDate) e.purchaseDate = 'Please choose the date of purchase.';
  if (!f.story || f.story.trim().length < 20) e.story = 'Please tell us what happened in at least one sentence.';
  return e;
}

function fileForm(values, errors) {
  const v = values || {}; const e = errors || {};
  const input = ([k, label, type, ac]) => `<label class="field" for="f-${k}">${label}
   <input id="f-${k}" name="${k}" type="${type}" autocomplete="${ac}" value="${esc(v[k] || '')}"${e[k] ? ` aria-invalid="true" aria-describedby="e-${k}"` : ''}>
   ${e[k] ? `<span class="err" id="e-${k}">${esc(e[k])}</span>` : ''}</label>`;
  const n = Object.keys(e).length;
  return shell('File a complaint', `
<div class="intro"><h1>File a complaint</h1><p class="ink2" style="margin:0">Tell us what happened. All fields are needed.</p></div>
<form class="card complaint" method="post" action="/file" novalidate>
 ${n ? `<div class="errbox" role="alert">Please fix ${n} ${n === 1 ? 'field' : 'fields'} below.</div>` : ''}
 <fieldset><legend>About you</legend><div class="two">${input(FIELDS[0])}${input(FIELDS[1])}</div></fieldset>
 <fieldset><legend>About the purchase</legend>${input(FIELDS[2])}<div class="two">${input(FIELDS[3])}${input(FIELDS[4])}</div>${input(FIELDS[5])}</fieldset>
 <fieldset><legend>Your complaint</legend>
  <label class="field" for="f-story">What happened?<span class="hint">Include what the seller promised and when.</span>
   <textarea id="f-story" name="story"${e.story ? ' aria-invalid="true" aria-describedby="e-story"' : ''}>${esc(v.story || '')}</textarea>
   ${e.story ? `<span class="err" id="e-story">${esc(e.story)}</span>` : ''}</label>
 </fieldset>
 <p class="note">By submitting you confirm the details are true. This is a practice portal; nothing is sent to a real authority.</p>
 <div><button class="btn btn-primary" type="submit">Submit complaint</button></div>
</form>`);
}

const money = (a) => { const n = Number(String(a).replace(/[^\d.]/g, '')); return Number.isFinite(n) ? '₹' + n.toLocaleString('en-IN') : String(a); };
const day = (iso) => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? String(iso) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const fmt = (ms) => new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function docket(d) {
  const need = d.status === 'info-needed';
  const label = { 'under-review': 'Under review', 'info-needed': 'Information needed', 'reply-received': 'Reply received, under review' }[d.status] || d.status;
  const cls = need ? 'need' : d.status === 'reply-received' ? 'ok' : '';
  const events = d.events.map((ev) => `<li class="${ev.kind === 'request' ? 'need' : ''}">${esc(ev.text)}<span class="when">${fmt(ev.at)}</span></li>`).join('');
  return shell('Docket ' + d.number, `
<div class="intro"><p class="muted" style="margin:0">Complaint against ${esc(d.form.seller)}</p>
<h1>Your complaint</h1></div>
<div class="docket">
 <section class="card panel">
  <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
   <div class="stamp"><small>Docket number</small><span>${esc(d.number)}</span></div>
   <div><div class="muted" style="font-size:13px">Status</div><div class="status ${cls}"><i aria-hidden="true"></i>${label}</div></div>
  </div>
  ${need ? `<section class="request" aria-label="Information needed">
   <h2>Please upload proof of payment</h2>
   <p style="margin:0">The seller says they have no record of your payment for order <span class="mono">${esc(d.form.orderId)}</span>. Upload a screenshot or receipt that shows the payment, then press Send.</p>
   <form id="reply" style="display:grid;gap:16px">
    <label class="field" for="r-file">Upload document<span class="hint">Image or PDF, up to 2 MB</span><input id="r-file" name="file" type="file" accept="image/*,application/pdf"></label>
    <label class="field" for="r-msg">Your reply<textarea id="r-msg" name="message" style="min-height:88px"></textarea></label>
    <p class="err" id="r-err" role="alert" hidden></p>
    <div><button class="btn btn-primary" type="submit">Send</button></div>
   </form></section>` : ''}
  <h2 style="margin-top:32px">What has happened so far</h2>
  <ol class="tl">${events}</ol>
 </section>
 <aside class="card panel" aria-label="Complaint summary">
  <h2>Summary</h2>
  <dl class="sum" style="margin-top:12px">
   <dt>Seller</dt><dd>${esc(d.form.seller)}</dd>
   <dt>Order ID</dt><dd class="mono">${esc(d.form.orderId)}</dd>
   <dt>Amount</dt><dd class="num">${esc(money(d.form.amount))}</dd>
   <dt>Date of purchase</dt><dd>${esc(day(d.form.purchaseDate))}</dd>
   <dt>Filed on</dt><dd>${fmt(d.filedAt)}</dd>
  </dl>
  <p class="note" style="margin-top:16px">Keep your docket number to track this complaint.</p>
 </aside>
</div>
${need ? `<script>
document.getElementById('reply').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = document.getElementById('r-file').files[0];
  const err = document.getElementById('r-err');
  if (!f) { err.textContent = 'Please choose a file to upload.'; err.hidden = false; return; }
  if (f.size > 2 * 1024 * 1024) { err.textContent = 'File exceeds 2 MB. Choose a smaller file.'; err.hidden = false; return; }
  const r = await fetch(location.pathname + '/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: f.name, fileSize: f.size, message: document.getElementById('r-msg').value }) });
  if (r.ok) location.reload(); else { err.textContent = 'Could not send. Please try again.'; err.hidden = false; }
});
</script>` : ''}`);
}

function admin(list) {
  const rows = list.map((d) => `<tr><td class="mono">${esc(d.number)}</td><td>${esc(d.status)}</td><td>${fmt(d.filedAt)}</td>
   <td><form method="post" action="/admin/simulate/${esc(d.number)}" style="display:inline"><button class="btn btn-quiet" type="submit" style="height:36px">Simulate reply</button></form></td></tr>`).join('');
  return shell('Practice controls', `
<div class="intro"><h1>Practice controls</h1><p class="ink2" style="margin:0">For the demo only. "Simulate reply" makes the seller ask for proof of payment right away. Otherwise it happens 2 minutes after filing.</p></div>
<section class="card panel">${list.length ? `<table class="adm"><thead><tr><th>Docket</th><th>Status</th><th>Filed</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="muted" style="margin:0">No complaints filed yet.</p>'}
 <form method="post" action="/admin/reset" style="margin-top:16px"><button class="btn btn-quiet" type="submit" style="height:36px">Delete all practice complaints</button></form></section>`);
}

module.exports = { home, fileForm, validate, docket, admin, FIELDS };
