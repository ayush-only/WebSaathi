/*
 * WebSaathi v2 — FAKE case store (in memory). Same API as contract/case-store.md.
 * Person 1 uses this until Person 2 merges case/case-store.js (chrome.storage.local, survives restart).
 * UMD: globalThis.WebSaathiCase.createFakeStore() in the extension, require() in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.WebSaathiCase = Object.assign(root.WebSaathiCase || {}, api); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FACT_KEYS = ['orderId', 'refundAmount', 'promisedDate'];
  const MAX_ATTACHMENT = 2 * 1024 * 1024;
  const err = (code, msg) => Object.assign(new Error(msg || code), { code });
  const rid = (p) => p + Math.random().toString(36).slice(2, 10);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function createFakeStore() {
    const cases = new Map();
    let active = null;
    const listeners = new Set();
    const get = (id) => { const c = cases.get(id); if (!c) throw err('NO_CASE', 'no case ' + id); return c; };
    const touch = (c) => { c.updatedAt = Date.now(); const out = clone(c); listeners.forEach((f) => { try { f(out); } catch (_) { /* ignore */ } }); return clone(c); };
    const event = (c, kind, text, sourceUrl) => c.timeline.push({ at: Date.now(), kind, text, sourceUrl: sourceUrl || null });

    return {
      async createCase(title) {
        const now = Date.now();
        const c = { id: rid('case_'), title: String(title || 'New case'), createdAt: now, updatedAt: now,
          facts: [], attachments: [], docket: null, timeline: [], nextAction: null };
        event(c, 'note', 'Case opened');
        cases.set(c.id, c);
        return touch(c);
      },
      async getCase(id) { return cases.has(id) ? clone(cases.get(id)) : null; },
      async listCases() { return [...cases.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(clone); },
      async getActiveCase() { return active && cases.has(active) ? clone(cases.get(active)) : null; },
      async setActiveCase(id) { get(id); active = id; },
      async addFact(id, fact) {
        const c = get(id);
        const f = fact || {};
        for (const k of ['key', 'value', 'sourceUrl', 'excerpt']) if (!f[k] || typeof f[k] !== 'string') throw err('BAD_FACT', 'missing ' + k);
        if (!f.excerpt.includes(f.value)) throw err('BAD_FACT', 'excerpt does not contain value');
        const saved = { key: f.key, value: f.value, sourceUrl: f.sourceUrl, excerpt: f.excerpt.slice(0, 300), capturedAt: f.capturedAt || Date.now() };
        c.facts = c.facts.filter((x) => x.key !== f.key).concat(saved);
        event(c, 'fact', `Saved ${f.key}: ${f.value}`, f.sourceUrl);
        return touch(c);
      },
      async addAttachment(id, a) {
        const c = get(id);
        if (!a || !a.name || !a.dataUrl) throw err('BAD_ATTACHMENT');
        if (a.dataUrl.length * 0.75 > MAX_ATTACHMENT) throw err('TOO_LARGE');
        const att = { id: rid('att_'), name: a.name, type: a.type || 'other', mime: a.mime || '', dataUrl: a.dataUrl, addedAt: Date.now() };
        c.attachments.push(att);
        event(c, 'note', 'Attached ' + a.name);
        touch(c);
        return clone(att);
      },
      async setDocket(id, d) {
        const c = get(id);
        if (!d || !d.number) throw err('BAD_DOCKET');
        const first = !c.docket;
        c.docket = { number: d.number, portalUrl: d.portalUrl || '', status: d.status || '' };
        event(c, first ? 'filed' : 'status', first ? `Complaint filed, docket ${d.number}` : `Status: ${d.status}`, d.portalUrl);
        return touch(c);
      },
      async addEvent(id, e) {
        const c = get(id);
        if (!e || !e.kind || !e.text) throw err('BAD_EVENT');
        event(c, e.kind, e.text, e.sourceUrl);
        return touch(c);
      },
      async setNextAction(id, next) { const c = get(id); c.nextAction = next ? { kind: next.kind, text: next.text } : null; return touch(c); },
      onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
      FACT_KEYS
    };
  }

  /** Keys still needed before filing. */
  function missingFacts(c) { const have = new Set((c && c.facts || []).map((f) => f.key)); return FACT_KEYS.filter((k) => !have.has(k)); }

  return { createFakeStore, missingFacts, FACT_KEYS };
});
