(() => {
  'use strict';
  const WS = globalThis.WebSaathi;
  const base = 'http://localhost:8787';
  let health = { ai: false, tts: false };

  async function request(path, data, timeout = 1800) {
    const options = { signal: AbortSignal.timeout(timeout) };
    if (data) Object.assign(options, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    const response = await fetch(base + path, options);
    if (!response.ok) throw new Error('Backend request failed');
    return response;
  }

  WS.api = {
    async init() {
      try { health = await (await request('/api/health')).json(); } catch (_) { /* optional backend */ }
    },
    async extract(page) {
      if (!health.ai) return [];
      try {
        const result = await (await request('/api/extract', { url: page.url, text: page.text }, 7000)).json();
        return Array.isArray(result.facts) ? result.facts : [];
      } catch (_) { return []; }
    },
    async tts(text, lang) {
      if (!health.tts) return null;
      try { return await (await request('/api/tts', { text, lang }, 3500)).blob(); }
      catch (_) { return null; }
    }
  };
})();
