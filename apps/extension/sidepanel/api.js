/**
 * WebSaathi — client for the optional backend (apps/backend).
 * The extension never holds AWS or ElevenLabs keys; only the backend does.
 * Every payload is redacted before it leaves the browser.
 */
(function (root) {
  'use strict';
  const WS = root.WebSaathi;
  const DEFAULT_BASE = 'http://localhost:8787';
  let base = DEFAULT_BASE;
  let health = { reachable: false, ai: false, tts: false };

  async function call(path, body, timeoutMs, asBlob) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
    try {
      const res = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return asBlob ? await res.blob() : await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Only the fields the model needs; no values, ever. */
  function sanitizeScan(scan) {
    const elements = (scan.elements || []).map((e) => ({
      id: e.id, kind: e.kind, label: e.label, name: e.name, required: e.required, disabled: e.disabled,
      hasValue: e.hasValue, sensitive: e.sensitive, sensitiveKind: e.sensitiveKind, irreversible: e.irreversible,
      options: e.sensitive ? undefined : e.options, error: e.sensitive ? undefined : e.error, text: e.kind === 'button' ? e.text : undefined
    }));
    return WS.redact.redactDeep({
      origin: scan.origin, title: scan.title, headings: scan.headings, policy: scan.policy, elements, errors: scan.errors
    });
  }

  const api = {
    async init() {
      try {
        const stored = await chrome.storage.local.get('backendUrl');
        if (stored.backendUrl) base = stored.backendUrl;
      } catch (_) { /* storage unavailable */ }
      return api.checkHealth();
    },
    async checkHealth() {
      try {
        const h = await call('/api/health', null, 1500);
        health = { reachable: true, ai: !!(h.ai && h.ai.configured), tts: !!(h.tts && h.tts.configured), model: h.ai && h.ai.model };
      } catch (_) {
        health = { reachable: false, ai: false, tts: false };
      }
      return health;
    },
    get health() { return health; },
    sanitizeScan,
    /** Ask the AI for the next proposed action. Returns null on any failure (caller falls back to local rules). */
    async next(scan, session) {
      if (!health.ai) return null;
      try {
        const out = await call('/api/next', {
          page: sanitizeScan(scan),
          session: {
            mode: session.mode, lang: session.lang, task: WS.redact.redactText(session.task || '').text,
            skipped: session.skipped, handoffDone: session.handoffDone, explained: session.explained.map((k) => k.split('|')[0])
          }
        }, 12000);
        return out && out.action ? out : null;
      } catch (_) {
        return null;
      }
    },
    async interpret(field, answer, lang) {
      if (!health.ai) return null;
      const red = WS.redact.redactText(answer);
      if (red.redacted.length) return null; // never send anything that looks like a secret
      try {
        return await call('/api/interpret', {
          field: { kind: field.kind, label: field.label, name: field.name, options: field.options }, answer: red.text, lang
        }, 10000);
      } catch (_) { return null; }
    },
    async tts(text, lang) {
      if (!health.tts) return null;
      try { return await call('/api/tts', { text: WS.redact.redactText(text).text.slice(0, 600), lang }, 15000, true); } catch (_) { return null; }
    }
  };
  WS.api = api;
})(globalThis);
