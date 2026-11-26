'use strict';
/*
 * Practice sites for the WebSaathi demo. Two origins on purpose:
 *   seller   http://localhost:5501   (Steelhouse, fictional store)
 *   helpline http://localhost:5502   (Consumer Help Portal, fictional)
 * Dockets persist in mock-sites/data/dockets.json so a browser restart keeps them.
 * Usage: node mock-sites/server.js   ·   env: SELLER_PORT, HELPLINE_PORT, DOCKET_DELAY_MS, DATA_FILE
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const seller = require('./seller/pages.js');
const help = require('./helpline/pages.js');

const SELLER_PORT = Number(process.env.SELLER_PORT || 5501);
const HELPLINE_PORT = Number(process.env.HELPLINE_PORT || 5502);
const DELAY = Number(process.env.DOCKET_DELAY_MS || 120000);
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data', 'dockets.json');
const ASSETS = path.join(__dirname, 'assets');

// ---------------------------------------------------------------- docket storage
function load() { try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch (_) { return { next: 417, dockets: {} }; } }
function save(db) { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }
function tick(d) {
  if (d.status === 'under-review' && Date.now() - d.filedAt >= DELAY) askForProof(d);
  return d;
}
function askForProof(d) {
  d.status = 'info-needed';
  d.events.push({ at: Date.now(), kind: 'request', text: 'Seller asked for proof of payment' });
}

// ---------------------------------------------------------------- tiny http helpers
const send = (res, code, body, type = 'text/html; charset=utf-8', extra = {}) => {
  res.writeHead(code, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, extra));
  res.end(body);
};
const redirect = (res, to) => send(res, 303, '', 'text/plain', { Location: to });
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const form = (s) => Object.fromEntries(new URLSearchParams(s));
function asset(res, name) {
  const file = path.join(ASSETS, path.basename(name));
  if (!fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
  const type = { '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' }[path.extname(file)] || 'application/octet-stream';
  send(res, 200, fs.readFileSync(file), type);
}
const notFound = (res) => send(res, 404, '<!doctype html><title>Not found</title><p>Page not found.</p>');

// ---------------------------------------------------------------- seller
async function sellerApp(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  if (p === '/' || p === '/orders') return send(res, 200, seller.orders());
  let m;
  if ((m = p.match(/^\/orders\/([\w-]+)$/))) { const h = seller.order(m[1]); return h ? send(res, 200, h) : notFound(res); }
  if ((m = p.match(/^\/support\/([\w-]+)$/))) { const h = seller.support(m[1]); return h ? send(res, 200, h) : notFound(res); }
  if (p.startsWith('/assets/')) return asset(res, p.slice(8));
  return notFound(res);
}

// ---------------------------------------------------------------- helpline
async function helplineApp(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  let m;
  if (req.method === 'GET' && p === '/') return send(res, 200, help.home());
  if (req.method === 'GET' && p === '/file') return send(res, 200, help.fileForm());
  if (req.method === 'POST' && p === '/file') {
    const f = form(await readBody(req));
    const errors = help.validate(f);
    if (Object.keys(errors).length) return send(res, 422, help.fileForm(f, errors));
    const db = load();
    const number = `CHP-2026-${String(db.next++).padStart(5, '0')}`;
    const keep = Object.fromEntries(['name', 'mobile', 'seller', 'orderId', 'amount', 'purchaseDate', 'story'].map((k) => [k, String(f[k] || '').slice(0, 2000)]));
    db.dockets[number] = { number, status: 'under-review', filedAt: Date.now(), form: keep,
      events: [{ at: Date.now(), kind: 'filed', text: 'Complaint filed' }, { at: Date.now(), kind: 'sent', text: `Sent to ${keep.seller} for a reply` }] };
    save(db);
    return redirect(res, '/docket/' + number);
  }
  if (req.method === 'GET' && p === '/track') {
    const n = String(u.searchParams.get('docket') || '').trim().toUpperCase();
    if (load().dockets[n]) return redirect(res, '/docket/' + n);
    return send(res, 404, help.home('No complaint found with that docket number.'));
  }
  if ((m = p.match(/^\/docket\/([\w-]+)$/)) && req.method === 'GET') {
    const db = load(); const d = db.dockets[m[1]];
    if (!d) return notFound(res);
    tick(d); save(db);
    return send(res, 200, help.docket(d));
  }
  if ((m = p.match(/^\/docket\/([\w-]+)\/reply$/)) && req.method === 'POST') {
    const db = load(); const d = db.dockets[m[1]];
    if (!d || d.status !== 'info-needed') return send(res, 409, JSON.stringify({ ok: false }), 'application/json');
    let body; try { body = JSON.parse(await readBody(req)); } catch (_) { return send(res, 400, JSON.stringify({ ok: false }), 'application/json'); }
    if (!body.fileName) return send(res, 400, JSON.stringify({ ok: false }), 'application/json');
    d.status = 'reply-received';
    d.reply = { fileName: String(body.fileName).slice(0, 200), fileSize: Number(body.fileSize) || 0, message: String(body.message || '').slice(0, 2000) };
    d.events.push({ at: Date.now(), kind: 'reply', text: `You sent ${d.reply.fileName}` });
    save(db);
    return send(res, 200, JSON.stringify({ ok: true }), 'application/json');
  }
  if (req.method === 'GET' && p === '/admin') return send(res, 200, help.admin(Object.values(load().dockets).map(tick).sort((a, b) => b.filedAt - a.filedAt)));
  if ((m = p.match(/^\/admin\/simulate\/([\w-]+)$/)) && req.method === 'POST') {
    const db = load(); const d = db.dockets[m[1]];
    if (d && d.status === 'under-review') { askForProof(d); save(db); }
    return redirect(res, '/admin');
  }
  if (p === '/admin/reset' && req.method === 'POST') { save({ next: 417, dockets: {} }); return redirect(res, '/admin'); }
  return notFound(res);
}

function serve(app) {
  return (req, res) => app(req, res).catch(() => { if (!res.headersSent) send(res, 500, 'Something went wrong', 'text/plain'); });
}

function start({ sellerPort = SELLER_PORT, helplinePort = HELPLINE_PORT, host = '127.0.0.1' } = {}) {
  const a = http.createServer(serve(sellerApp)).listen(sellerPort, host);
  const b = http.createServer(serve(helplineApp)).listen(helplinePort, host);
  return { seller: a, helpline: b, close: () => { a.close(); b.close(); } };
}

if (require.main === module) {
  start({ host: process.env.HOST || '127.0.0.1' });
  console.log(`Seller (Steelhouse)        http://localhost:${SELLER_PORT}/orders/MS-48213`);
  console.log(`Helpline (practice portal) http://localhost:${HELPLINE_PORT}/   ·   practice controls: /admin`);
}

module.exports = { start };
