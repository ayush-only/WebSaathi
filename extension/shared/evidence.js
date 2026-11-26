(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./redact.js') : root.WebSaathi.redact);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebSaathi.evidence = api;
})(globalThis, function (redact) {
  'use strict';

  const SELLER = 'http://localhost:5501';
  const HELPLINE = 'http://localhost:5502';
  const MAX_TEXT = 12000;
  // Demo scope: evidence is collected only for practice order MS-48213.
  const ORDER = 'MS-48213';
  const orderPath = '/orders/' + ORDER;
  const supportPath = '/support/' + ORDER;
  const factPatterns = {
    orderId: /^MS-\d{5}$/,
    refundAmount: /^₹\s*\d[\d,]*(?:\.\d{2})?$/,
    promisedDate: /^\d{1,2} [A-Za-z]{3,9} \d{4}$/
  };

  function pageKind(url) {
    try {
      const { origin, pathname } = new URL(url);
      if (origin === SELLER && pathname === orderPath) return 'order';
      if (origin === SELLER && pathname === supportPath) return 'support';
      if (origin === HELPLINE && pathname === '/file') return 'file';
      if (origin === HELPLINE && /^\/docket\/NCH-\d{4}-\d+$/.test(pathname)) return 'docket';
    } catch (_) { /* invalid URL */ }
    return null;
  }

  function safeUrl(url) {
    if (!pageKind(url)) return null;
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  }

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  }

  function redactSnapshot(text) {
    return redact.redactText(cleanText(text)).text
      .replace(/\b(?:upi|vpa)\s*(?:id)?\s*[:=]?\s+[\w.-]+@[\w.-]+/gi, '[REDACTED_UPI]')
      .replace(/\b[\w.-]+@[\w.-]+\b/g, '[REDACTED_ADDRESS]');
  }

  function validateFact(fact, page) {
    if (!fact || !page || !['order', 'support'].includes(pageKind(page.url))) return null;
    const { key, value, excerpt } = fact;
    const pattern = Object.hasOwn(factPatterns, key) && factPatterns[key];
    if (!pattern || typeof value !== 'string' || !pattern.test(value) || value.length > 64) return null;
    if (key === 'orderId' && value !== ORDER) return null;
    if (typeof excerpt !== 'string' || excerpt.length > 300 || !excerpt.includes(value)
      || !page.text.includes(excerpt) || redactSnapshot(excerpt) !== excerpt) return null;
    return { key, value, excerpt, sourceUrl: safeUrl(page.url) };
  }

  function localFacts(page) {
    const kind = pageKind(page.url);
    const picks = kind === 'order' ? [
      ['orderId', /\bOrder ID\s*:?\s*(MS-\d{5})\b/i],
      ['refundAmount', /\bAmount paid\s*:?\s*(₹\s*\d[\d,]*(?:\.\d{2})?)/i],
      ['promisedDate', /\bRefund by\s*:?\s*(\d{1,2} [A-Za-z]{3,9} \d{4})\b/i]
    ] : kind === 'support' ? [
      ['refundAmount', /Your refund of\s+(₹\s*\d[\d,]*(?:\.\d{2})?)\s+will reach you by\s+\d{1,2} [A-Za-z]{3,9} \d{4}\.?/i],
      ['promisedDate', /Your refund of\s+₹\s*\d[\d,]*(?:\.\d{2})?\s+will reach you by\s+(\d{1,2} [A-Za-z]{3,9} \d{4})\.?/i]
    ] : [];
    return picks.flatMap(([key, pattern]) => {
      const m = pattern.exec(page.text);
      const fact = m && validateFact({ key, value: m[1], excerpt: m[0] }, page);
      return fact ? [fact] : [];
    });
  }

  return { SELLER, HELPLINE, ORDER, orderPath, supportPath, MAX_TEXT, pageKind, safeUrl, cleanText, redactSnapshot, validateFact, localFacts };
});
