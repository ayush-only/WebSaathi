'use strict';
// Practice seller site "Steelhouse" (fictional). Visible labels are part of contract/demo.md.
const { esc, baseCss, page } = require('../shared.js');

const ORDER = {
  id: 'MS-48213', item: 'Steel water bottle, 1 litre (set of 2)', qty: 1,
  orderedOn: '28 Oct 2026', amount: '₹2,499', method: 'UPI',
  returnedOn: '3 Nov 2026', approvedOn: '5 Nov 2026', refundBy: '12 Nov 2026'
};

const css = baseCss({ bg: '#f7f4ee', card: '#fdfbf7', raised: '#efe9df', ink: '#1f1b16', ink2: '#5e554a', muted: '#736a5e',
  accent: '#7a4e10', accentInk: '#5f3c0b', onAccent: '#fdfbf7' }) + `
.crumbs{font-size:13px;color:var(--muted);margin:32px 0 12px}.crumbs a{color:var(--ink2);text-decoration:none}
.order{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:24px;margin-top:24px;align-items:start}
.product{padding:24px;display:grid;gap:20px}
.shelf{background:linear-gradient(#f1ece3,#e9e2d6);border-radius:12px;height:300px;display:grid;place-items:end center;padding-bottom:28px;position:relative;overflow:hidden}
.shelf::after{content:"";position:absolute;left:0;right:0;bottom:20px;height:8px;background:#d9d0c1}
.shelf svg{position:relative;z-index:1;width:220px;height:auto}
.details{padding:8px 24px}
dl.facts{margin:0;display:grid;grid-template-columns:140px 1fr}
dl.facts>div{display:contents}
dl.facts dt,dl.facts dd{padding:14px 0;border-bottom:1px solid var(--line);margin:0}
dl.facts>div:last-child dt,dl.facts>div:last-child dd{border-bottom:0}
dl.facts dt{color:var(--ink2);font-size:14px}
dl.facts dd{font-weight:500}
.state{display:inline-flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;border-radius:4px;background:#b45309;flex:none}
.steps{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.steps li{display:grid;grid-template-columns:16px 1fr auto;gap:12px;align-items:center;font-size:14px}
.steps .tick{width:16px;height:16px;border-radius:8px;border:1.5px solid var(--ink2)}
.steps .done .tick{background:var(--ink2)}
.steps .late{color:#9a3412}.steps .late .tick{border-color:#9a3412}
.actions{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap}
.list{margin-top:24px;display:grid;gap:12px}
.row{display:grid;grid-template-columns:72px 1fr auto;gap:16px;align-items:center;padding:16px 20px;text-decoration:none;color:inherit}
.row:hover{background:var(--raised)}
.thumb{width:72px;height:72px;border-radius:10px;background:#ece5da;display:grid;place-items:center}
.thumb svg{width:40px;height:auto}
.chat{margin-top:24px;padding:24px;display:grid;gap:16px;max-width:760px}
.msg{max-width:78%;display:grid;gap:4px}
.msg .meta{font-size:12px;line-height:16px;color:var(--muted)}
.msg .bubble{padding:12px 16px;border-radius:14px;background:var(--raised)}
.msg.you{justify-self:end;text-align:right}.msg.you .bubble{background:#e6dccb;text-align:left}
.closed{font-size:13px;color:var(--muted);border-top:1px solid var(--line);padding-top:16px}
@media (max-width:820px){.order{grid-template-columns:1fr}.shelf{height:240px}.shelf svg{width:160px}dl.facts{grid-template-columns:120px 1fr}}
`;

const bottles = `<svg viewBox="0 0 220 260" role="img" aria-label="Two steel water bottles">
<defs>
<linearGradient id="st" x1="0" x2="1"><stop offset="0" stop-color="#8d949b"/><stop offset=".28" stop-color="#e4e7ea"/><stop offset=".5" stop-color="#b9bfc5"/><stop offset=".78" stop-color="#f1f3f5"/><stop offset="1" stop-color="#7f868d"/></linearGradient>
<linearGradient id="cap" x1="0" x2="1"><stop offset="0" stop-color="#2c2a27"/><stop offset=".45" stop-color="#57534d"/><stop offset="1" stop-color="#23211f"/></linearGradient>
</defs>
<g transform="translate(30 20)"><rect x="18" y="0" width="34" height="26" rx="6" fill="url(#cap)"/><path d="M14 30 Q14 22 24 22 H46 Q56 22 56 30 L62 52 Q70 60 70 74 V216 Q70 232 54 232 H16 Q0 232 0 216 V74 Q0 60 8 52 Z" fill="url(#st)"/><rect x="0" y="96" width="70" height="2" fill="#000" opacity=".08"/></g>
<g transform="translate(118 44) scale(.9)"><rect x="18" y="0" width="34" height="26" rx="6" fill="url(#cap)"/><path d="M14 30 Q14 22 24 22 H46 Q56 22 56 30 L62 52 Q70 60 70 74 V216 Q70 232 54 232 H16 Q0 232 0 216 V74 Q0 60 8 52 Z" fill="url(#st)"/><rect x="0" y="96" width="70" height="2" fill="#000" opacity=".08"/></g>
<ellipse cx="110" cy="254" rx="96" ry="5" fill="#000" opacity=".10"/></svg>`;

function shell(title, current, inner) {
  const nav = [['/', 'Shop'], ['/orders', 'Orders'], ['/support/' + ORDER.id, 'Help']]
    .map(([h, l]) => `<a href="${h}"${l === current ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  return page({ title: title + ' · Steelhouse (practice)', css, body: `
<div class="practice"><strong>Practice site.</strong> Steelhouse is a fictional store made for the WebSaathi demo. No real orders or payments.</div>
<header class="top"><div class="wrap"><a class="brand" href="/">Steelhouse</a><nav class="links" aria-label="Main">${nav}</nav></div></header>
<main class="wrap">${inner}</main>
<footer class="wrap foot">Steelhouse · practice site for WebSaathi · all data is made up</footer>` });
}

function orders() {
  return shell('Your orders', 'Orders', `
<div class="crumbs">Account / Orders</div>
<h1>Your orders</h1>
<div class="list card">
 <a class="row" href="/orders/${ORDER.id}"><span class="thumb">${bottles}</span>
  <span><span style="display:block;font-weight:500">${esc(ORDER.item)}</span><span class="muted">Order <span class="mono">${ORDER.id}</span> · ${ORDER.orderedOn}</span></span>
  <span class="state"><span class="dot" aria-hidden="true"></span>Refund pending</span></a>
</div>`);
}

function order(id) {
  if (id !== ORDER.id) return null;
  return shell('Order ' + ORDER.id, 'Orders', `
<div class="crumbs"><a href="/orders">Orders</a> / <span class="mono">${ORDER.id}</span></div>
<h1>Order <span class="mono">${ORDER.id}</span></h1>
<p class="ink2" style="margin:8px 0 0">Returned on ${ORDER.returnedOn}. The refund has not reached your account.</p>
<div class="order">
 <section class="card product" aria-label="Item">
  <div class="shelf">${bottles}</div>
  <div><h2>${esc(ORDER.item)}</h2><p class="ink2" style="margin:4px 0 0">Quantity ${ORDER.qty} · <span class="num">${ORDER.amount}</span></p></div>
 </section>
 <section class="card details" aria-label="Order details">
  <dl class="facts">
   <div><dt>Order ID</dt><dd class="mono">${ORDER.id}</dd></div>
   <div><dt>Ordered on</dt><dd>${ORDER.orderedOn}</dd></div>
   <div><dt>Amount paid</dt><dd><span class="num">${ORDER.amount}</span> (${ORDER.method})</dd></div>
   <div><dt>Returned on</dt><dd>${ORDER.returnedOn}</dd></div>
   <div><dt>Refund status</dt><dd><span class="state"><span class="dot" aria-hidden="true"></span>Approved, not received</span></dd></div>
   <div><dt>Refund by</dt><dd>${ORDER.refundBy}</dd></div>
  </dl>
  <div style="padding:20px 0 24px;border-top:1px solid var(--line)">
   <ol class="steps" aria-label="Refund progress">
    <li class="done"><span class="tick" aria-hidden="true"></span>Return picked up<span class="muted">${ORDER.returnedOn}</span></li>
    <li class="done"><span class="tick" aria-hidden="true"></span>Refund approved<span class="muted">${ORDER.approvedOn}</span></li>
    <li class="late"><span class="tick" aria-hidden="true"></span>Money in your account<span>Due ${ORDER.refundBy}</span></li>
   </ol>
   <div class="actions"><a class="btn btn-primary" href="/support/${ORDER.id}">Talk to support</a><a class="btn btn-quiet" href="/orders">All orders</a></div>
  </div>
 </section>
</div>`);
}

const CHAT = [
  ['you', '5 Nov 2026, 10:12', `When will I get my refund for order ${ORDER.id}?`],
  ['them', '5 Nov 2026, 10:20', `Hi, this is Priya from Steelhouse support. Your refund of ${ORDER.amount} will reach you by ${ORDER.refundBy}.`],
  ['you', '15 Nov 2026, 18:41', 'It is 15 Nov and I still have not received the money.'],
  ['them', '16 Nov 2026, 09:05', 'We have raised this with our payments team. Please wait 7 more working days.'],
  ['you', '25 Nov 2026, 20:30', 'Still nothing. Please tell me where my refund is.']
];

function support(id) {
  if (id !== ORDER.id) return null;
  const msgs = CHAT.map(([who, at, text]) => `<div class="msg ${who}"><span class="meta">${who === 'you' ? 'You' : 'Steelhouse support'} · ${at}</span><div class="bubble">${esc(text)}</div></div>`).join('');
  return shell('Support for ' + ORDER.id, 'Help', `
<div class="crumbs"><a href="/orders/${ORDER.id}">Order <span class="mono">${ORDER.id}</span></a> / Support</div>
<h1>Support chat</h1>
<p class="ink2" style="margin:8px 0 0">About order <span class="mono">${ORDER.id}</span> · ${esc(ORDER.item)}</p>
<section class="card chat" aria-label="Conversation">${msgs}
 <p class="closed">No reply since 16 Nov 2026. This conversation was closed automatically.</p>
</section>`);
}

module.exports = { ORDER, orders, order, support };
