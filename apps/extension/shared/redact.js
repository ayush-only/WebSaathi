/**
 * WebSaathi — Sensitive value redaction.
 * Runs before ANY text leaves the browser for the backend / model, and again on the backend.
 * Conservative by design: it is better to redact a harmless number than to leak an OTP.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.redact = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULES = [
    // 13–19 digit card numbers, optionally grouped by spaces/dashes
    { kind: 'card', re: /\b(?:\d[ -]?){12,18}\d\b/g },
    // Aadhaar: 12 digits, optionally 4-4-4
    { kind: 'aadhaar', re: /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g },
    // OTP / PIN / CVV mentioned with a short code
    { kind: 'otp', re: /(\b(otp|pin|mpin|cvv|cvc|passcode)\b|ओटीपी|पिन|ಒಟಿಪಿ|ಪಿನ್)\D{0,20}\d{3,12}/gi },
    // "my password is …" — redact the word that follows
    { kind: 'password', re: /(\bpass(word|code)\b|पासवर्ड|ಪಾಸ್\u200c?ವರ್ಡ್)\s*(is|:|=|hai|है|ಆಗಿದೆ)?\s*\S+/gi },
    // A message that is nothing but a 4–8 digit code is treated as a possible OTP/PIN
    { kind: 'code', re: /^\s*\d{4,8}\s*$/g }
  ];

  /** @returns {{text: string, redacted: string[]}} */
  function redactText(input) {
    let text = String(input == null ? '' : input);
    const redacted = [];
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(text)) {
        redacted.push(rule.kind);
        rule.re.lastIndex = 0;
        text = text.replace(rule.re, '[REDACTED_' + rule.kind.toUpperCase() + ']');
      }
    }
    return { text, redacted };
  }

  function containsSensitiveValue(input) {
    return redactText(input).redacted.length > 0;
  }

  /** Deep-redact every string inside a JSON-like object (used for model payloads). */
  function redactDeep(value, depth) {
    const d = depth || 0;
    if (d > 8) return null;
    if (typeof value === 'string') return redactText(value).text;
    if (Array.isArray(value)) return value.slice(0, 200).map((v) => redactDeep(v, d + 1));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        // Field values are never part of a model payload.
        if (k === 'value' || k === 'password' || k === 'otp') continue;
        out[k] = redactDeep(v, d + 1);
      }
      return out;
    }
    return value;
  }

  return { redactText, containsSensitiveValue, redactDeep };
});
