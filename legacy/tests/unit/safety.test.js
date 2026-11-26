'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const safety = require('../../apps/extension/shared/safety.js');
const schema = require('../../apps/extension/shared/schema.js');

const ORIGIN = 'http://localhost:5500';
const elements = {
  'ws-1': { id: 'ws-1', kind: 'text', label: 'Complainant name', visible: true, sensitive: false },
  'ws-2': { id: 'ws-2', kind: 'text', label: 'Enter the 6-digit OTP', visible: true, sensitive: true, sensitiveKind: 'otp' },
  'ws-3': { id: 'ws-3', kind: 'select', label: 'Category', visible: true, sensitive: false, options: [{ value: 'banking', label: 'Banking' }] },
  'ws-4': { id: 'ws-4', kind: 'file', label: 'Document', visible: true, sensitive: false },
  'ws-5': { id: 'ws-5', kind: 'checkbox', label: 'I confirm', visible: true, sensitive: false },
  'ws-6': { id: 'ws-6', kind: 'text', label: 'Hidden', visible: false, sensitive: false }
};
const ctx = (over) => Object.assign({ origin: ORIGIN, policy: 'assist', elements, confirmed: false }, over);
const fill = (over) => Object.assign({ actionType: 'FILL_FIELD', targetElementId: 'ws-1', instruction: 'Fill name',
  proposedValue: 'Ravi Kumar', requiresConfirmation: true, riskLevel: 'low', expectedOrigin: ORIGIN }, over);

test('classifies sensitive fields', () => {
  const cases = [
    [{ type: 'password', name: 'pwd' }, 'password'],
    [{ autocomplete: 'one-time-code', name: 'code' }, 'otp'],
    [{ label: 'Enter OTP' }, 'otp'],
    [{ label: 'Type the characters (CAPTCHA)' }, 'captcha'],
    [{ tag: 'iframe', src: 'https://www.google.com/recaptcha/api2/anchor' }, 'captcha'],
    [{ label: 'Card Number' }, 'card'],
    [{ autocomplete: 'cc-csc' }, 'card'],
    [{ label: 'UPI PIN' }, 'upi'],
    [{ label: 'Aadhaar number' }, 'aadhaar'],
    [{ label: 'आधार संख्या' }, 'aadhaar'],
    [{ label: 'Bank account number' }, 'bank'],
    [{ label: 'ATM PIN' }, 'pin']
  ];
  for (const [d, kind] of cases) assert.equal(safety.classifyElement(d).sensitiveKind, kind, JSON.stringify(d));
  for (const d of [{ label: 'Full name' }, { label: 'PIN code', name: 'pincode' }, { label: 'Email address', type: 'email' }, { label: 'Company name' }]) {
    assert.equal(safety.classifyElement(d).sensitive, false, JSON.stringify(d));
  }
});

test('marks commit buttons as irreversible but not sensitive', () => {
  assert.deepEqual(safety.classifyElement({ kind: 'button', text: 'Submit complaint' }), { sensitive: false, sensitiveKind: null, irreversible: true });
  assert.equal(safety.classifyElement({ kind: 'button', text: 'Proceed to Pay' }).irreversible, true);
  assert.equal(safety.classifyElement({ kind: 'button', text: 'Show more' }).irreversible, false);
});

test('fill requires explicit confirmation', () => {
  const v = safety.validateAction(fill(), ctx());
  assert.equal(v.decision, 'needs-confirmation');
  assert.equal(v.ok, false);
  assert.equal(safety.validateAction(fill(), ctx({ confirmed: true })).decision, 'allow');
});

test('schema rejects a fill that claims not to need confirmation', () => {
  assert.equal(safety.validateAction(fill({ requiresConfirmation: false }), ctx({ confirmed: true })).decision, 'block');
});

test('anything aimed at a sensitive field becomes HUMAN_HANDOFF and loses its value', () => {
  const v = safety.validateAction(fill({ targetElementId: 'ws-2', proposedValue: '482913' }), ctx({ confirmed: true }));
  assert.equal(v.decision, 'handoff');
  assert.equal(v.action.actionType, 'HUMAN_HANDOFF');
  assert.equal(v.action.proposedValue, null);
  const h = safety.validateAction({ actionType: 'HIGHLIGHT_ELEMENT', targetElementId: 'ws-2', instruction: 'x', expectedOrigin: ORIGIN }, ctx());
  assert.equal(h.decision, 'handoff');
});

test('guide-only portals never fill (IRCTC etc.) — fill is downgraded to a highlight', () => {
  const v = safety.validateAction(fill({ expectedOrigin: 'https://www.irctc.co.in' }),
    { origin: 'https://www.irctc.co.in', policy: 'guide-only', elements, confirmed: true });
  assert.equal(v.decision, 'downgrade');
  assert.equal(v.action.actionType, 'HIGHLIGHT_ELEMENT');
  assert.equal(v.action.proposedValue, null);
});

test('unknown action types, origin mismatch, unsupported origins and missing targets are blocked', () => {
  assert.equal(safety.validateAction(fill({ actionType: 'RUN_JAVASCRIPT' }), ctx({ confirmed: true })).decision, 'block');
  assert.equal(safety.validateAction(fill({ actionType: 'CLICK' }), ctx({ confirmed: true })).decision, 'block');
  assert.equal(safety.validateAction(fill({ expectedOrigin: 'https://evil.example' }), ctx({ confirmed: true })).code, 'ORIGIN_MISMATCH');
  assert.equal(safety.validateAction(fill(), ctx({ confirmed: true, policy: null })).code, 'UNSUPPORTED_ORIGIN');
  assert.equal(safety.validateAction(fill({ targetElementId: 'ws-99' }), ctx({ confirmed: true })).code, 'TARGET_NOT_FOUND');
  assert.equal(safety.validateAction(fill({ targetElementId: 'ws-6' }), ctx({ confirmed: true })).code, 'TARGET_NOT_VISIBLE');
  assert.equal(safety.validateAction(fill({ targetElementId: '#name' }), ctx({ confirmed: true })).decision, 'block');
  assert.equal(safety.validateAction(null, ctx()).decision, 'block');
});

test('values that look like secrets are never filled, even into a normal field', () => {
  for (const value of ['1234 5678 9012', '4111 1111 1111 1111', 'my otp is 482913', '482913']) {
    assert.equal(safety.validateAction(fill({ proposedValue: value }), ctx({ confirmed: true })).code, 'SENSITIVE_VALUE', value);
  }
});

test('select/checkbox values must be valid; unsupported widgets fall back to guidance', () => {
  assert.equal(safety.validateAction(fill({ targetElementId: 'ws-3', proposedValue: 'banking' }), ctx({ confirmed: true })).decision, 'allow');
  assert.equal(safety.validateAction(fill({ targetElementId: 'ws-3', proposedValue: 'crypto' }), ctx({ confirmed: true })).code, 'INVALID_OPTION');
  assert.equal(safety.validateAction(fill({ targetElementId: 'ws-5', proposedValue: 'maybe' }), ctx({ confirmed: true })).code, 'INVALID_CHECKBOX_VALUE');
  const f = safety.validateAction(fill({ targetElementId: 'ws-4', proposedValue: 'C:/fake.pdf' }), ctx({ confirmed: true }));
  assert.equal(f.decision, 'downgrade');
});

test('prompt-injection style output: extra keys are stripped, not executed', () => {
  const out = schema.parseModelAction('Sure! {"actionType":"HIGHLIGHT_ELEMENT","targetElementId":"ws-1","instruction":"Click here",' +
    '"expectedOrigin":"http://localhost:5500","script":"document.forms[0].submit()","url":"https://evil.example"} thanks');
  assert.equal(out.ok, true);
  assert.equal(out.value.script, undefined);
  assert.equal(out.value.url, undefined);
  assert.equal(schema.parseModelAction('no json here').ok, false);
  assert.equal(schema.parseModelAction('{"actionType":"HIGHLIGHT_ELEMENT"').ok, false);
});

test('CLICK_ELEMENT: only Search/Apply, only on assist sites, only after confirmation; payment-like buttons never', () => {
  const btn = (id, text) => ({ [id]: { id, kind: 'button', text, label: text, visible: true, disabled: false, sensitive: false } });
  const act = (id) => ({ actionType: 'CLICK_ELEMENT', targetElementId: id, instruction: 'press', requiresConfirmation: true, riskLevel: 'low', expectedOrigin: 'https://www.makemytrip.com' });
  const ctx = (elements, extra) => Object.assign({ origin: 'https://www.makemytrip.com', policy: 'assist', elements, confirmed: false }, extra);
  assert.equal(safety.validateAction(act('ws-1'), ctx(btn('ws-1', 'SEARCH'))).decision, 'needs-confirmation');
  assert.equal(safety.validateAction(act('ws-1'), ctx(btn('ws-1', 'SEARCH'), { confirmed: true })).decision, 'allow');
  assert.equal(safety.validateAction(act('ws-1'), ctx(btn('ws-1', 'APPLY'), { confirmed: true })).decision, 'allow');
  for (const label of ['PAY NOW', 'Book Now', 'Continue', 'Proceed to payment', 'Confirm', 'Cancel booking', 'Verify OTP', 'Search with UPI']) {
    assert.equal(safety.validateAction(act('ws-1'), ctx(btn('ws-1', label), { confirmed: true })).decision, 'downgrade', label);
  }
  assert.equal(safety.validateAction(act('ws-1'), ctx(btn('ws-1', 'SEARCH'), { policy: 'guide-only', confirmed: true })).decision, 'downgrade');
});
