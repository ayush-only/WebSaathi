/*
 * WebSaathi v2 — case store. Implements contract/case-store.md.
 *   createStore()                  → backed by chrome.storage.local (survives browser restart)
 *   createStore({ storage })       → any adapter with get/set/remove/onChanged (tests)
 *   createFakeStore()              → same store on an in-memory adapter
 * Needs the "storage" and "unlimitedStorage" permissions (attachments are data URLs up to 2 MB each).
 * Writes are queued, so two quick calls never overwrite each other.
 * nextAction is recomputed after every change (see nextActionFor); setNextAction overrides it until the next change.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebSaathiCase = Object.assign(root.WebSaathiCase || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const FACT_KEYS = ['orderId', 'refundAmount', 'promisedDate'];
  const EVENT_KINDS = ['fact', 'filed', 'status', 'request', 'reply', 'note'];
  const ATTACHMENT_TYPES = ['paymentProof', 'receipt', 'other'];
  const NEXT_KINDS = ['collect', 'file', 'wait', 'respond', 'done'];
  const MAX_ATTACHMENT = 2 * 1024 * 1024;
  const SECRET_RE = /\b(\d{4}[ -]?\d{4}[ -]?\d{4}(?:[ -]?\d{4})?|\d{6}\b(?=.*\b(otp|pin)\b)|[\w.-]+@(ok\w+|ybl|ibl|axl|paytm|upi))\b/i;
  const PREFIX = 'wsCase:';
  const INDEX = 'wsCase.index';
  const ACTIVE = 'wsCase.active';

  const err = (code, msg) => Object.assign(new Error(msg || code), { code });
  const rid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const normalize = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------- storage adapters
  function chromeStorage() {
    const area = root.chrome && root.chrome.storage && root.chrome.storage.local;
    if (!area) throw err('NO_STORAGE', 'chrome.storage.local is not available here');
    return {
      get: (keys) => area.get(keys),
      set: (obj) => area.set(obj),
      remove: (keys) => area.remove(keys),
      onChanged(cb) {
        const fn = (changes, name) => { if (name === 'local') cb(changes); };
        root.chrome.storage.onChanged.addListener(fn);
        return () => root.chrome.storage.onChanged.removeListener(fn);
      }
    };
  }

  function memoryStorage() {
    const data = new Map();
    const subs = new Set();
    const emit = (changes) => subs.forEach((f) => { try { f(changes); } catch (_) { /* listener error */ } });
    return {
      async get(keys) {
        const ks = keys == null ? [...data.keys()] : [].concat(keys);
        const out = {};
        for (const k of ks) if (data.has(k)) out[k] = clone(data.get(k));
        return out;
      },
      async set(obj) { const ch = {}; for (const [k, v] of Object.entries(obj)) { ch[k] = { oldValue: data.get(k), newValue: clone(v) }; data.set(k, clone(v)); } emit(ch); },
      async remove(keys) { const ch = {}; for (const k of [].concat(keys)) { ch[k] = { oldValue: data.get(k) }; data.delete(k); } emit(ch); },
      onChanged(cb) { subs.add(cb); return () => subs.delete(cb); }
    };
  }

  // ---------------------------------------------------------------- what should happen next
  function missingFacts(c) {
    const have = new Set(((c && c.facts) || []).map((f) => f.key));
    return FACT_KEYS.filter((k) => !have.has(k));
  }

  /** The default next step, from the case alone. */
  function nextActionFor(c) {
    const miss = missingFacts(c);
    if (miss.length) return { kind: 'collect', text: 'Open the seller’s order and support pages so WebSaathi can save ' + miss.map(labelOf).join(', ') + '.' };
    if (!c.docket) return { kind: 'file', text: 'File a complaint on the helpline portal. WebSaathi fills it from this case; you press Submit.' };
    if (/resolved|closed/i.test(c.docket.status || '')) return { kind: 'done', text: 'The complaint is closed. Check that the refund reached your account.' };
    const lastRequest = lastIndex(c.timeline, (e) => e.kind === 'request');
    const lastReply = lastIndex(c.timeline, (e) => e.kind === 'reply');
    if (lastRequest > lastReply) {
      const proof = (c.attachments || []).find((a) => a.type === 'paymentProof');
      return { kind: 'respond', text: proof ? `The portal needs more from you. Attach ${proof.name} and send the drafted reply.` : 'The portal needs more from you. Add your proof of payment to this case first.' };
    }
    return { kind: 'wait', text: `Complaint ${c.docket.number} is with the seller. Check the status again in a few days.` };
  }
  function lastIndex(arr, fn) { for (let i = (arr || []).length - 1; i >= 0; i--) if (fn(arr[i])) return i; return -1; }
  function labelOf(k) { return { orderId: 'the order ID', refundAmount: 'the refund amount', promisedDate: 'the promised refund date' }[k] || k; }

  // ---------------------------------------------------------------- the store
  function createStore(opts) {
    const storage = (opts && opts.storage) || chromeStorage();
    let queue = Promise.resolve();
    const serial = (fn) => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };

    const read = async (id) => (await storage.get(PREFIX + id))[PREFIX + id] || null;
    const must = async (id) => { const c = await read(id); if (!c) throw err('NO_CASE', 'no case ' + id); return c; };
    async function write(c, { keepNext } = {}) {
      c.updatedAt = Date.now();
      if (!keepNext) c.nextAction = nextActionFor(c);
      const idx = (await storage.get(INDEX))[INDEX] || [];
      await storage.set({ [PREFIX + c.id]: c, [INDEX]: idx.includes(c.id) ? idx : idx.concat(c.id) });
      return clone(c);
    }
    const event = (c, kind, text, sourceUrl) => c.timeline.push({ at: Date.now(), kind, text: String(text).slice(0, 300), sourceUrl: sourceUrl || null });
    const mutate = (id, fn, o) => serial(async () => { const c = await must(id); const r = await fn(c); const saved = await write(c, o); return r === undefined ? saved : r; });

    return {
      FACT_KEYS,
      createCase(title) {
        return serial(async () => {
          const now = Date.now();
          const c = { id: rid('case_'), title: normalize(title || 'New case').slice(0, 120), createdAt: now, updatedAt: now,
            facts: [], attachments: [], docket: null, timeline: [], nextAction: null };
          event(c, 'note', 'Case opened');
          return write(c);
        });
      },
      async getCase(id) { return clone(await read(id)); },
      async listCases() {
        const idx = (await storage.get(INDEX))[INDEX] || [];
        const all = await storage.get(idx.map((i) => PREFIX + i));
        return Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);
      },
      async getActiveCase() { const id = (await storage.get(ACTIVE))[ACTIVE]; return id ? clone(await read(id)) : null; },
      async setActiveCase(id) { if (id !== null) await must(id); await storage.set({ [ACTIVE]: id }); },

      addFact(id, fact) {
        const f = fact || {};
        for (const k of ['key', 'value', 'sourceUrl', 'excerpt']) if (!f[k] || typeof f[k] !== 'string') return Promise.reject(err('BAD_FACT', 'missing ' + k));
        const excerpt = normalize(f.excerpt).slice(0, 300);
        const value = normalize(f.value);
        if (!excerpt.includes(value)) return Promise.reject(err('BAD_FACT', 'excerpt does not contain value'));
        if (SECRET_RE.test(value)) return Promise.reject(err('SENSITIVE', 'looks like a card, UPI or OTP value'));
        return mutate(id, (c) => {
          const prev = c.facts.find((x) => x.key === f.key);
          c.facts = c.facts.filter((x) => x.key !== f.key).concat({ key: f.key, value, sourceUrl: f.sourceUrl, excerpt, capturedAt: f.capturedAt || Date.now() });
          if (!prev || prev.value !== value) event(c, 'fact', `${prev ? 'Updated' : 'Saved'} ${labelOf(f.key).replace(/^the /, '')}: ${value}`, f.sourceUrl);
        });
      },

      addAttachment(id, a) {
        if (!a || !a.name || typeof a.dataUrl !== 'string' || !/^data:[\w.+/-]+;base64,/.test(a.dataUrl)) return Promise.reject(err('BAD_ATTACHMENT'));
        if ((a.dataUrl.length - a.dataUrl.indexOf(',') - 1) * 0.75 > MAX_ATTACHMENT) return Promise.reject(err('TOO_LARGE'));
        const att = { id: rid('att_'), name: normalize(a.name).slice(0, 120), type: ATTACHMENT_TYPES.includes(a.type) ? a.type : 'other',
          mime: a.mime || a.dataUrl.slice(5, a.dataUrl.indexOf(';')), dataUrl: a.dataUrl, addedAt: Date.now() };
        return mutate(id, (c) => { c.attachments.push(att); event(c, 'note', 'Added ' + att.name); return clone(att); });
      },

      removeAttachment(id, attachmentId) {
        return mutate(id, (c) => { const a = c.attachments.find((x) => x.id === attachmentId); c.attachments = c.attachments.filter((x) => x.id !== attachmentId); if (a) event(c, 'note', 'Removed ' + a.name); });
      },

      setDocket(id, d) {
        if (!d || !d.number) return Promise.reject(err('BAD_DOCKET'));
        return mutate(id, (c) => {
          const first = !c.docket;
          const status = normalize(d.status || (c.docket && c.docket.status) || '');
          const changed = !first && status && status !== c.docket.status;
          c.docket = { number: normalize(d.number), portalUrl: d.portalUrl || (c.docket && c.docket.portalUrl) || '', status };
          if (first) event(c, 'filed', `Complaint filed. Docket ${c.docket.number}`, c.docket.portalUrl);
          else if (changed) event(c, 'status', 'Status: ' + status, c.docket.portalUrl);
        });
      },

      addEvent(id, e) {
        if (!e || !EVENT_KINDS.includes(e.kind) || !e.text) return Promise.reject(err('BAD_EVENT'));
        return mutate(id, (c) => {
          const last = c.timeline[c.timeline.length - 1];
          if (last && last.kind === e.kind && last.text === normalize(e.text)) return; // same request seen again on reload
          event(c, e.kind, normalize(e.text), e.sourceUrl);
        });
      },

      setNextAction(id, next) {
        if (next && !NEXT_KINDS.includes(next.kind)) return Promise.reject(err('BAD_NEXT'));
        return mutate(id, (c) => { c.nextAction = next ? { kind: next.kind, text: normalize(next.text) } : null; }, { keepNext: true });
      },

      deleteCase(id) {
        return serial(async () => {
          const idx = ((await storage.get(INDEX))[INDEX] || []).filter((x) => x !== id);
          const active = (await storage.get(ACTIVE))[ACTIVE];
          await storage.set(Object.assign({ [INDEX]: idx }, active === id ? { [ACTIVE]: null } : {}));
          await storage.remove(PREFIX + id);
        });
      },

      /** callback(case) after any change to a case, in this page or another extension page. Returns unsubscribe(). */
      onChange(cb) {
        return storage.onChanged((changes) => {
          for (const [k, v] of Object.entries(changes)) if (k.startsWith(PREFIX) && v.newValue) { try { cb(clone(v.newValue)); } catch (_) { /* listener error */ } }
        });
      }
    };
  }

  const createFakeStore = () => createStore({ storage: memoryStorage() });

  return { createStore, createFakeStore, memoryStorage, missingFacts, nextActionFor, normalize, FACT_KEYS };
});
