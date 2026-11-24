/**
 * WebSaathi — Local rule-based planner ("Local Demo Mode").
 *
 * Deterministic: it picks the next step from the scanned page using fixed rules.
 * It is NOT AI and the UI labels it as such. It uses the same scan, the same
 * action schema and the same safety gate as Live AI mode, and is also the
 * fallback whenever the AI backend is unreachable.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode
    ? { i18n: require('./i18n.js'), errors: require('./errors.js'), safety: require('./safety.js') }
    : { i18n: root.WebSaathi.i18n, errors: root.WebSaathi.errors, safety: root.WebSaathi.safety };
  const mod = factory(deps);
  if (isNode) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.planner = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';
  const { t } = deps.i18n;

  /** Friendlier questions for fields we know (matched on the field's name attribute). */
  const KNOWN_QUESTIONS = {
    complainantName: { en: 'What is your full name?', hi: 'आपका पूरा नाम क्या है?', kn: 'ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಏನು?' },
    email: { en: 'What is your email address?', hi: 'आपका ईमेल पता क्या है?', kn: 'ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸ ಏನು?' },
    category: { en: 'What is the complaint about?', hi: 'शिकायत किस बारे में है?', kn: 'ದೂರು ಯಾವುದರ ಬಗ್ಗೆ?' },
    company: { en: 'Which company is the complaint against?', hi: 'शिकायत किस कंपनी के ख़िलाफ़ है?', kn: 'ಯಾವ ಕಂಪನಿಯ ವಿರುದ್ಧ ದೂರು?' },
    description: { en: 'What happened? Tell me in a few sentences.', hi: 'क्या हुआ? कुछ वाक्यों में बताइए।', kn: 'ಏನಾಯಿತು? ಕೆಲವು ವಾಕ್ಯಗಳಲ್ಲಿ ಹೇಳಿ.' },
    resolution: { en: 'What would you like the company to do?', hi: 'आप कंपनी से क्या चाहते हैं?', kn: 'ಕಂಪನಿ ಏನು ಮಾಡಬೇಕೆಂದು ಬಯಸುತ್ತೀರಿ?' },
    consent: { en: 'Do you confirm that these details are true?', hi: 'क्या आप पुष्टि करते हैं कि ये जानकारी सही है?', kn: 'ಈ ವಿವರಗಳು ಸತ್ಯವೆಂದು ನೀವು ದೃಢೀಕರಿಸುತ್ತೀರಾ?' }
  };

  const FIELD_KINDS = new Set([...deps.safety.FILLABLE_KINDS, 'file']);

  function isField(el) {
    return el.visible !== false && !el.disabled && FIELD_KINDS.has(el.kind);
  }

  function progress(scan) {
    const fields = (scan.elements || []).filter((e) => isField(e) && !e.sensitive);
    return { done: fields.filter((e) => e.hasValue).length, total: fields.length };
  }

  function base(scan, extra) {
    return Object.assign({ expectedOrigin: scan.origin, requiresConfirmation: false, riskLevel: 'low', reason: 'local-rules' }, extra);
  }

  function questionFor(el, lang) {
    const known = KNOWN_QUESTIONS[el.name];
    if (known) return known[lang] || known.en;
    if (el.kind === 'checkbox') return t(lang, 'askCheck', { label: el.label });
    if ((el.kind === 'select' || el.kind === 'radio') && el.options) {
      return t(lang, 'askChoice', { label: el.label, options: el.options.map((o) => o.label).join(', ') });
    }
    return t(lang, 'askGeneric', { label: el.label });
  }

  function guideTextFor(el, lang) {
    const key = { select: 'guideSelect', radio: 'guideRadio', checkbox: 'guideCheck', file: 'guideFile' }[el.kind] || 'guideClick';
    return t(lang, key, { label: el.label });
  }

  /**
   * Decide the next step.
   * @param {{origin:string, elements:any[], errors:{text:string, fieldId:string|null}[]}} scan
   * @param {{mode:'guide'|'assist', lang:string, policy:string, skipped?:string[], handoffDone?:string[], explained?:string[]}} st
   * @returns {{action: object, meta: object}}
   */
  function nextAction(scan, st) {
    const lang = st.lang || 'en';
    const mode = st.policy === 'assist' ? st.mode : 'guide';
    const els = scan.elements || [];
    const byId = Object.fromEntries(els.map((e) => [e.id, e]));
    const skipped = new Set(st.skipped || []);
    const handoffDone = new Set(st.handoffDone || []);
    const explained = new Set(st.explained || []);
    const prog = progress(scan);

    // 1. Website errors first.
    for (const err of scan.errors || []) {
      const key = (err.fieldId || '') + '|' + err.text;
      const field = err.fieldId ? byId[err.fieldId] : null;
      if (field && field.sensitive) continue; // never discuss values of sensitive fields
      if (explained.has(key)) {
        // Already explained: in Assist Mode re-ask that field so the user can correct it.
        if (mode === 'assist' && field && isField(field) && field.kind !== 'file' && !skipped.has(field.id)) {
          return { action: base(scan, { actionType: 'ASK_QUESTION', targetElementId: field.id, instruction: questionFor(field, lang) }),
            meta: { field, progress: prog, retry: true } };
        }
        continue;
      }
      const ex = deps.errors.explainError(err.text, lang);
      return {
        action: base(scan, { actionType: 'EXPLAIN_ERROR', targetElementId: field ? field.id : null, instruction: ex.explanation + ' ' + ex.fix }),
        meta: { errorKey: key, raw: err.text, explanation: ex, field, progress: prog }
      };
    }

    // 2. Sensitive steps → human handoff.
    const sensitive = els.find((e) => e.sensitive && e.visible !== false && !handoffDone.has(e.id));
    if (sensitive) {
      const kind = t(lang, 'sensitiveKinds')[sensitive.sensitiveKind] || sensitive.sensitiveKind;
      return {
        action: base(scan, { actionType: 'HUMAN_HANDOFF', targetElementId: sensitive.id, riskLevel: 'high',
          instruction: t(lang, 'handoffBody', { kind }) }),
        meta: { field: sensitive, kind, progress: prog }
      };
    }

    // 3. Next empty field.
    const field = els.find((e) => isField(e) && !e.sensitive && !e.hasValue && !skipped.has(e.id));
    if (field) {
      if (mode === 'assist' && field.kind !== 'file') {
        return { action: base(scan, { actionType: 'ASK_QUESTION', targetElementId: field.id, instruction: questionFor(field, lang) }),
          meta: { field, progress: prog } };
      }
      return { action: base(scan, { actionType: 'HIGHLIGHT_ELEMENT', targetElementId: field.id, instruction: guideTextFor(field, lang) }),
        meta: { field, progress: prog, guideOnly: field.kind === 'file' } };
    }

    // 4. Everything filled: point at the commit button, but never press it.
    const button = els.find((e) => e.kind === 'button' && e.visible !== false && !e.disabled && (e.irreversible || e.type === 'submit'));
    if (button && !handoffDone.has(button.id)) {
      return {
        action: base(scan, { actionType: 'HIGHLIGHT_ELEMENT', targetElementId: button.id, riskLevel: 'medium',
          instruction: t(lang, 'reviewBeforeSubmit', { button: button.label || button.text }) }),
        meta: { field: button, final: true, progress: prog }
      };
    }
    return { action: base(scan, { actionType: 'COMPLETE_GUIDANCE', targetElementId: null, instruction: t(lang, 'allDone') }), meta: { progress: prog } };
  }

  const END = '(?=$|[\\s.,!।])';
  const YES = new RegExp('^(yes|y|yeah|ok|okay|sure|agree|i agree|haan|han|ha|ji|haanji|हाँ|हां|जी|ठीक है|ಹೌದು|ಸರಿ|ಒಪ್ಪುತ್ತೇನೆ)' + END, 'i');
  const NO = new RegExp('^(no|n|nope|nahin|nahi|नहीं|ना|ಇಲ್ಲ|ಬೇಡ)' + END, 'i');
  const SYNONYMS = {
    refund: ['refund', 'money back', 'paise wapas', 'पैसे वापस', 'रिफंड', 'ಮರುಪಾವತಿ', 'ಹಣ ವಾಪಸ್'],
    replacement: ['replace', 'replacement', 'new one', 'badal', 'बदल', 'ಬದಲಿ'],
    repair: ['repair', 'fix', 'theek', 'ठीक', 'मरम्मत', 'ರಿಪೇರಿ', 'ದುರಸ್ತಿ'],
    ecommerce: ['online', 'e-commerce', 'ecommerce', 'amazon', 'flipkart', 'shopping', 'ऑनलाइन', 'ಆನ್‌ಲೈನ್'],
    banking: ['bank', 'banking', 'बैंक', 'ಬ್ಯಾಂಕ್'],
    telecom: ['mobile', 'sim', 'telecom', 'recharge', 'internet', 'मोबाइल', 'ಮೊಬೈಲ್'],
    electricity: ['electricity', 'power', 'bijli', 'बिजली', 'ವಿದ್ಯುತ್']
  };

  function matchOption(options, answer) {
    const a = answer.trim().toLowerCase();
    if (!a) return null;
    const idx = parseInt(a, 10);
    if (String(idx) === a && options[idx - 1]) return options[idx - 1];
    return options.find((o) => o.label.toLowerCase() === a || o.value.toLowerCase() === a)
      || options.find((o) => a.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(a))
      || options.find((o) => (SYNONYMS[o.value.toLowerCase()] || []).some((s) => a.includes(s.toLowerCase())))
      || null;
  }

  /**
   * Turn a spoken/typed answer into the value to fill. Never invents data.
   * @returns {{ok: true, value: string, display: string} | {ok: false, problem: string}}
   */
  function interpretAnswer(field, answer) {
    let a = String(answer || '').replace(/\s+/g, ' ').trim();
    if (!a) return { ok: false, problem: 'EMPTY' };
    switch (field.kind) {
      case 'select':
      case 'radio': {
        const opt = matchOption(field.options || [], a);
        return opt ? { ok: true, value: opt.value, display: opt.label } : { ok: false, problem: 'NO_MATCHING_OPTION' };
      }
      case 'checkbox':
        if (YES.test(a)) return { ok: true, value: 'true', display: '✓' };
        if (NO.test(a)) return { ok: true, value: 'false', display: '✗' };
        return { ok: false, problem: 'YES_OR_NO' };
      case 'email':
        a = a.toLowerCase().replace(/\s+at the rate\s+|\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s+/g, '');
        return { ok: true, value: a, display: a };
      case 'number':
      case 'tel': {
        const digits = a.replace(/[^\d+]/g, '');
        return digits ? { ok: true, value: digits, display: digits } : { ok: false, problem: 'NO_DIGITS' };
      }
      default:
        if (field.name === 'complainantName' || /name/i.test(field.label || '')) {
          a = a.replace(/^(my name is|my name's|i am|i'm|this is|mera naam|मेरा नाम|ನನ್ನ ಹೆಸರು)\s*/i, '')
            .replace(/\s*(hai|है|ಆಗಿದೆ)[.।]?$/i, '').trim();
        }
        return a ? { ok: true, value: a, display: a } : { ok: false, problem: 'EMPTY' };
    }
  }

  return { nextAction, interpretAnswer, progress, questionFor, KNOWN_QUESTIONS };
});
