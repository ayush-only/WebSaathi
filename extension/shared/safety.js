/**
 * WebSaathi — Deterministic Safety Gate.
 *
 * The AI proposes; this code disposes. No model output, webpage text or user
 * setting can switch these rules off. The same module runs in the side panel
 * (before asking the user), in the content script (immediately before touching
 * the DOM) and on the backend (before returning a model action).
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode
    ? { schema: require('./schema.js'), redact: require('./redact.js') }
    : { schema: root.WebSaathi.schema, redact: root.WebSaathi.redact };
  const mod = factory(deps);
  if (isNode) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.safety = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  /** Order matters: the first matching rule names the kind shown to the user. */
  const SENSITIVE_RULES = [
    { kind: 'captcha', re: /captcha|recaptcha|hcaptcha|turnstile|कैप्चा|ಕ್ಯಾಪ್ಚಾ/i },
    { kind: 'password', re: /pass\s?word|passcode|passwd|पासवर्ड|ಪಾಸ್‌?ವರ್ಡ್/i },
    { kind: 'otp', re: /\botp\b|one[\s-]?time|verification\s?code|security\s?code|ओटीपी|ಒಟಿಪಿ/i },
    { kind: 'card', re: /card\s?(number|no\b|num)|cc-?(number|num|csc|exp)|\bcvv\b|\bcvc\b|expiry|valid\s?thru|कार्ड\s?नंबर|ಕಾರ್ಡ್\s?ಸಂಖ್ಯೆ/i },
    { kind: 'upi', re: /\bupi\b|\bvpa\b|\bm-?pin\b|यूपीआई|ಯುಪಿಐ/i },
    { kind: 'pin', re: /\b(atm\s?)?pin\b(?!\s?-?code)/i },
    { kind: 'aadhaar', re: /aadha+r|adhaar|आधार|ಆಧಾರ್|\buidai\b/i },
    { kind: 'bank', re: /account\s?(number|no\b)|\bifsc\b|bank\s?account|खाता\s?संख्या|ಖಾತೆ\s?ಸಂಖ್ಯೆ/i }
  ];

  /** Buttons/links that commit something. WebSaathi never clicks anything, but it tells the user to review before pressing these. */
  const IRREVERSIBLE_RE = /\b(submit|send|pay|payment|confirm|book|login|continue|proceed|place order|proceed to pay|lodge|register (complaint|grievance)|sign in|log ?in|delete|transfer|buy)\b|सबमिट|जमा करें|भुगतान|पुष्टि|ಸಲ್ಲಿಸು|ಪಾವತಿ|ದೃಢೀಕರಿಸು/i;

  const FILLABLE_KINDS = Object.freeze(['text', 'email', 'tel', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date', 'url', 'search']);
  const DOM_ACTIONS = new Set(['HIGHLIGHT_ELEMENT', 'FILL_FIELD', 'ASK_QUESTION']);

  /**
   * Classify a scanned element descriptor.
   * @param {{tag?:string,type?:string,kind?:string,autocomplete?:string,name?:string,idAttr?:string,label?:string,placeholder?:string,text?:string,src?:string}} d
   * @returns {{sensitive: boolean, sensitiveKind: string|null, irreversible: boolean}}
   */
  function classifyElement(d) {
    const type = String(d.type || '').toLowerCase();
    const ac = String(d.autocomplete || '').toLowerCase();
    const hay = [d.name, d.idAttr, d.label, d.placeholder, ac, d.src, d.tag === 'iframe' || d.tag === 'img' ? d.text : '']
      .filter(Boolean).join(' ');

    let kind = null;
    if (type === 'password' || /current-password|new-password/.test(ac)) kind = 'password';
    else if (ac === 'one-time-code') kind = 'otp';
    else if (/^cc-/.test(ac)) kind = 'card';
    else {
      for (const rule of SENSITIVE_RULES) {
        if (rule.re.test(hay)) { kind = rule.kind; break; }
      }
    }
    const isButton = d.kind === 'button' || d.tag === 'button' || type === 'submit';
    // A button is not a field the user types a secret into; mark it irreversible instead.
    if (isButton) {
      const label = [d.text, d.label, d.name].filter(Boolean).join(' ');
      return { sensitive: false, sensitiveKind: null, irreversible: IRREVERSIBLE_RE.test(label) };
    }
    return { sensitive: kind !== null, sensitiveKind: kind, irreversible: false };
  }

  function result(decision, code, action) {
    return { ok: decision === 'allow' || decision === 'handoff' || decision === 'downgrade', decision, code, action: action || null };
  }

  /**
   * Validate a proposed action against the current page context.
   * @param {object} proposed  raw proposed action (from the model or local planner)
   * @param {{origin: string, policy: 'assist'|'guide-only'|null, elements: Record<string, any>, confirmed?: boolean}} ctx
   * @returns {{ok: boolean, decision: 'allow'|'block'|'handoff'|'downgrade'|'needs-confirmation', code: string, action: object|null}}
   */
  function validateAction(proposed, ctx) {
    const parsed = deps.schema.validateProposedAction(proposed);
    if (!parsed.ok) return result('block', 'INVALID_ACTION:' + parsed.errors.join(','));
    const action = parsed.value;

    if (!ctx || !ctx.origin) return result('block', 'NO_CONTEXT');
    if (action.expectedOrigin !== ctx.origin) return result('block', 'ORIGIN_MISMATCH');
    if (!ctx.policy) return result('block', 'UNSUPPORTED_ORIGIN');

    if (!DOM_ACTIONS.has(action.actionType) && action.actionType !== 'HUMAN_HANDOFF' && action.actionType !== 'EXPLAIN_ERROR') {
      return result('allow', 'OK', action); // WAIT_FOR_USER, COMPLETE_GUIDANCE: no page effect
    }

    let el = null;
    if (action.targetElementId) {
      el = ctx.elements ? ctx.elements[action.targetElementId] : null;
      if (!el) return result('block', 'TARGET_NOT_FOUND');
      if (el.visible === false) return result('block', 'TARGET_NOT_VISIBLE');
    }
    if (action.actionType === 'HUMAN_HANDOFF' || action.actionType === 'EXPLAIN_ERROR') return result('allow', 'OK', action);

    // Any action that points at a sensitive control becomes a human handoff.
    if (el && el.sensitive) {
      return result('handoff', 'SENSITIVE_TARGET:' + el.sensitiveKind, {
        ...action, actionType: 'HUMAN_HANDOFF', proposedValue: null, riskLevel: 'high', requiresConfirmation: false
      });
    }
    if (action.riskLevel === 'high' && action.actionType === 'FILL_FIELD') {
      return result('handoff', 'HIGH_RISK', { ...action, actionType: 'HUMAN_HANDOFF', proposedValue: null, requiresConfirmation: false });
    }

    if (action.actionType !== 'FILL_FIELD') return result('allow', 'OK', action);

    // ---- FILL_FIELD rules ----
    const toHighlight = (code) => result('downgrade', code, {
      ...action, actionType: 'HIGHLIGHT_ELEMENT', proposedValue: null, requiresConfirmation: false
    });
    if (ctx.policy !== 'assist') return toHighlight('GUIDE_ONLY_PORTAL');
    if (el.disabled) return result('block', 'TARGET_DISABLED');
    if (!FILLABLE_KINDS.includes(el.kind)) return toHighlight('UNSUPPORTED_WIDGET:' + el.kind);
    if (deps.redact.containsSensitiveValue(action.proposedValue)) return result('block', 'SENSITIVE_VALUE');
    if ((el.kind === 'select' || el.kind === 'radio') && Array.isArray(el.options)) {
      const ok = el.options.some((o) => o.value === action.proposedValue);
      if (!ok) return result('block', 'INVALID_OPTION');
    }
    if (el.kind === 'checkbox' && !['true', 'false'].includes(action.proposedValue)) return result('block', 'INVALID_CHECKBOX_VALUE');
    if (!ctx.confirmed) return { ok: false, decision: 'needs-confirmation', code: 'NEEDS_CONFIRMATION', action };
    return result('allow', 'OK', action);
  }

  return { SENSITIVE_RULES, FILLABLE_KINDS, classifyElement, validateAction, IRREVERSIBLE_RE };
});
