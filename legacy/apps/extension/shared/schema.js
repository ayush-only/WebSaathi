/**
 * WebSaathi — Proposed Action schema.
 * The model (or the local rule planner) may only *propose* one of these objects.
 * Anything that does not validate is rejected (fail closed).
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  root.WebSaathi = root.WebSaathi || {};
  root.WebSaathi.schema = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ACTION_TYPES = Object.freeze([
    'HIGHLIGHT_ELEMENT',
    'ASK_QUESTION',
    'FILL_FIELD',
    'CLICK_ELEMENT',
    'EXPLAIN_ERROR',
    'HUMAN_HANDOFF',
    'WAIT_FOR_USER',
    'COMPLETE_GUIDANCE'
  ]);
  const RISK_LEVELS = Object.freeze(['low', 'medium', 'high']);
  const NEEDS_TARGET = new Set(['HIGHLIGHT_ELEMENT', 'FILL_FIELD', 'CLICK_ELEMENT', 'ASK_QUESTION']);
  const ID_RE = /^ws-\d{1,5}$/;

  const LIMITS = { instruction: 400, reason: 400, proposedValue: 2000, expectedOrigin: 200 };

  /**
   * @param {any} input
   * @returns {{ok: true, value: object} | {ok: false, errors: string[]}}
   */
  function validateProposedAction(input) {
    const errors = [];
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['NOT_AN_OBJECT'] };

    const actionType = input.actionType;
    if (!ACTION_TYPES.includes(actionType)) errors.push('UNKNOWN_ACTION_TYPE');

    const targetElementId = input.targetElementId == null ? null : input.targetElementId;
    if (targetElementId !== null && (typeof targetElementId !== 'string' || !ID_RE.test(targetElementId))) errors.push('BAD_TARGET_ID');
    if (NEEDS_TARGET.has(actionType) && !targetElementId) errors.push('TARGET_REQUIRED');

    const str = (k, required) => {
      const v = input[k];
      if (v == null) { if (required) errors.push(k.toUpperCase() + '_REQUIRED'); return null; }
      if (typeof v !== 'string') { errors.push(k.toUpperCase() + '_NOT_STRING'); return null; }
      if (v.length > LIMITS[k]) { errors.push(k.toUpperCase() + '_TOO_LONG'); return null; }
      return v;
    };
    const instruction = str('instruction', true);
    const reason = str('reason', false);
    const proposedValue = str('proposedValue', actionType === 'FILL_FIELD');
    const expectedOrigin = str('expectedOrigin', true);

    if (actionType !== 'FILL_FIELD' && proposedValue != null) errors.push('VALUE_ONLY_FOR_FILL');

    const requiresConfirmation = input.requiresConfirmation == null ? true : input.requiresConfirmation;
    if (typeof requiresConfirmation !== 'boolean') errors.push('BAD_REQUIRES_CONFIRMATION');
    // Fills always need confirmation, whatever the proposer says.
    if ((actionType === 'FILL_FIELD' || actionType === 'CLICK_ELEMENT') && requiresConfirmation === false) errors.push('FILL_MUST_REQUIRE_CONFIRMATION');

    const riskLevel = input.riskLevel == null ? 'low' : input.riskLevel;
    if (!RISK_LEVELS.includes(riskLevel)) errors.push('BAD_RISK_LEVEL');

    if (errors.length) return { ok: false, errors };
    // Return a clean copy: unknown keys (e.g. "script", "selector") are dropped.
    return {
      ok: true,
      value: { actionType, targetElementId, instruction, reason, proposedValue, requiresConfirmation, riskLevel, expectedOrigin }
    };
  }

  /** Extract the first JSON object from model text and validate it. */
  function parseModelAction(text) {
    if (typeof text !== 'string') return { ok: false, errors: ['NO_TEXT'] };
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return { ok: false, errors: ['NO_JSON'] };
    let obj;
    try { obj = JSON.parse(text.slice(start, end + 1)); } catch (_) { return { ok: false, errors: ['BAD_JSON'] }; }
    return validateProposedAction(obj);
  }

  return { ACTION_TYPES, RISK_LEVELS, validateProposedAction, parseModelAction };
});
