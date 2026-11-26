'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const planner = require('../../apps/extension/shared/planner.js');
const errors = require('../../apps/extension/shared/errors.js');
const redact = require('../../apps/extension/shared/redact.js');
const i18n = require('../../apps/extension/shared/i18n.js');

const ORIGIN = 'http://localhost:5500';
const field = (id, extra) => Object.assign({ id, kind: 'text', label: id, visible: true, disabled: false, hasValue: false, sensitive: false }, extra);
const scanOf = (elements, errs) => ({ origin: ORIGIN, policy: 'assist', elements, errors: errs || [] });
const st = (over) => Object.assign({ mode: 'assist', lang: 'en', policy: 'assist', skipped: [], handoffDone: [], explained: [] }, over);

test('assist mode asks for the next empty field with a friendly question', () => {
  const scan = scanOf([field('ws-1', { name: 'complainantName', hasValue: true }), field('ws-2', { name: 'email', kind: 'email' })]);
  const { action } = planner.nextAction(scan, st());
  assert.equal(action.actionType, 'ASK_QUESTION');
  assert.equal(action.targetElementId, 'ws-2');
  assert.equal(action.instruction, 'What is your email address?');
  assert.equal(planner.nextAction(scan, st({ lang: 'hi' })).action.instruction, 'आपका ईमेल पता क्या है?');
});

test('guide mode highlights instead of asking; guide-only policy forces guide mode', () => {
  const scan = scanOf([field('ws-1', { label: 'From station' })]);
  assert.equal(planner.nextAction(scan, st({ mode: 'guide' })).action.actionType, 'HIGHLIGHT_ELEMENT');
  assert.equal(planner.nextAction(scan, st({ policy: 'guide-only' })).action.actionType, 'HIGHLIGHT_ELEMENT');
});

test('website errors are explained before anything else, then the field is re-asked', () => {
  const scan = scanOf([field('ws-1', { name: 'email', kind: 'email', hasValue: true })], [{ text: 'Invalid email address.', fieldId: 'ws-1' }]);
  const first = planner.nextAction(scan, st());
  assert.equal(first.action.actionType, 'EXPLAIN_ERROR');
  assert.equal(first.meta.explanation.ruleId, 'email');
  const second = planner.nextAction(scan, st({ explained: [first.meta.errorKey] }));
  assert.equal(second.action.actionType, 'ASK_QUESTION');
  assert.equal(second.meta.retry, true);
});

test('a visible sensitive field triggers HUMAN_HANDOFF before other work', () => {
  const scan = scanOf([field('ws-1'), field('ws-2', { sensitive: true, sensitiveKind: 'otp', label: 'OTP' })]);
  const r = planner.nextAction(scan, st());
  assert.equal(r.action.actionType, 'HUMAN_HANDOFF');
  assert.equal(r.action.targetElementId, 'ws-2');
  assert.match(r.action.instruction, /OTP/);
  assert.equal(planner.nextAction(scan, st({ handoffDone: ['ws-2'] })).action.targetElementId, 'ws-1');
});

test('when all fields are done it points at the submit button but never presses it', () => {
  const scan = scanOf([field('ws-1', { hasValue: true }), { id: 'ws-9', kind: 'button', text: 'Continue to verification', label: 'Continue to verification', type: 'submit', visible: true, irreversible: false }]);
  const r = planner.nextAction(scan, st());
  assert.equal(r.action.actionType, 'HIGHLIGHT_ELEMENT');
  assert.equal(r.meta.final, true);
  assert.match(r.action.instruction, /press “Continue to verification” yourself/);
});

test('file inputs are guide-only even in assist mode', () => {
  const r = planner.nextAction(scanOf([field('ws-1', { kind: 'file', label: 'Document' })]), st());
  assert.equal(r.action.actionType, 'HIGHLIGHT_ELEMENT');
  assert.equal(r.meta.guideOnly, true);
});

test('interpretAnswer cleans answers without inventing data', () => {
  assert.equal(planner.interpretAnswer({ kind: 'text', name: 'complainantName', label: 'Name' }, 'My name is Ravi Kumar').value, 'Ravi Kumar');
  assert.equal(planner.interpretAnswer({ kind: 'text', name: 'complainantName', label: 'Name' }, 'मेरा नाम सीता देवी है').value, 'सीता देवी');
  assert.equal(planner.interpretAnswer({ kind: 'email' }, 'ravi dot kumar at the rate example dot com').value, 'ravi.kumar@example.com');
  const opts = [{ value: 'refund', label: 'Refund' }, { value: 'replacement', label: 'Replacement' }, { value: 'repair', label: 'Repair' }];
  assert.equal(planner.interpretAnswer({ kind: 'radio', options: opts }, 'mujhe paise wapas chahiye').ok, true);
  assert.equal(planner.interpretAnswer({ kind: 'radio', options: opts }, 'पैसे वापस चाहिए').value, 'refund');
  assert.equal(planner.interpretAnswer({ kind: 'radio', options: opts }, '2').value, 'replacement');
  assert.equal(planner.interpretAnswer({ kind: 'radio', options: opts }, 'a pizza').ok, false);
  assert.equal(planner.interpretAnswer({ kind: 'checkbox' }, 'haan').value, 'true');
  assert.equal(planner.interpretAnswer({ kind: 'checkbox' }, 'ಹೌದು').value, 'true');
  assert.equal(planner.interpretAnswer({ kind: 'checkbox' }, 'nahi').value, 'false');
  assert.equal(planner.interpretAnswer({ kind: 'text', label: 'x' }, '   ').ok, false);
});

test('error translator covers common messages in three languages', () => {
  const cases = { 'This field is required.': 'required', 'Invalid email address.': 'email', 'File size exceeds 200KB': 'file-size',
    'Description must be at least 20 characters.': 'min-length', 'Invalid PNR format': 'pnr', 'Please select a valid date': 'date',
    'Please enter a valid 10 digit mobile number': 'mobile', 'Incorrect captcha': 'captcha', 'Your session has expired': 'session' };
  for (const [msg, id] of Object.entries(cases)) for (const lang of ['en', 'hi', 'kn']) assert.equal(errors.explainError(msg, lang).ruleId, id, msg + ' ' + lang);
  assert.match(errors.explainError('File size exceeds 200KB', 'en').explanation, /200 KB/);
  assert.equal(errors.explainError('Something odd happened', 'en').ruleId, 'generic');
});

test('redaction removes Aadhaar, card numbers and OTPs before anything leaves the browser', () => {
  assert.deepEqual(redact.redactText('my aadhaar is 1234 5678 9012').redacted, ['aadhaar']);
  assert.ok(redact.redactText('card 4111-1111-1111-1111').redacted.includes('card'));
  assert.ok(redact.redactText('OTP: 482913').redacted.includes('otp'));
  assert.equal(redact.redactText('Ravi Kumar, ravi@example.com').redacted.length, 0);
  const deep = redact.redactDeep({ label: 'x', value: 'secret', nested: [{ text: 'otp 123456' }] });
  assert.equal(deep.value, undefined);
  assert.match(deep.nested[0].text, /REDACTED/);
});

test('every UI string exists in Hindi and Kannada', () => {
  for (const key of Object.keys(i18n.STRINGS.en)) for (const l of ['hi', 'kn']) assert.ok(i18n.STRINGS[l][key] != null, l + ':' + key);
});
