'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../../apps/extension/shared/registry.js');

test('routes goals in English, Hindi, Hinglish and Kannada to the right official portal', () => {
  const cases = {
    'I want to book a train from Bengaluru to Mysuru': 'irctc',
    'Tatkal ticket kaise book kare': 'irctc',
    'मुझे ट्रेन टिकट बुक करना है': 'irctc',
    'I want to file a railway complaint': 'railmadad',
    'The coach toilet was dirty, I want to complain': 'railmadad',
    "I want to complain about a product that hasn't been refunded": 'nch',
    'Mujhe consumer complaint register karni hai': 'nch',
    'ಮರುಪಾವತಿ ಸಿಗಲಿಲ್ಲ ಗ್ರಾಹಕ ದೂರು': 'nch',
    'My pension is delayed by the department': 'cpgrams',
    'ಸರ್ಕಾರಿ ಇಲಾಖೆ ದೂರು': 'cpgrams',
    'let me try the practice demo': 'demo'
  };
  for (const [text, id] of Object.entries(cases)) {
    const r = registry.routeIntent(text);
    assert.ok(r, 'no route for: ' + text);
    assert.equal(r.portal.id, id, text);
  }
  assert.equal(registry.routeIntent('what is the weather'), null);
  assert.equal(registry.routeIntent(''), null);
});

test('navigation is allowed only to exact registry origins over https', () => {
  for (const p of registry.PORTALS) assert.equal(registry.checkNavigation(p.url).ok, true, p.url);
  assert.equal(registry.checkNavigation('https://www.irctc.co.in.evil.com/').ok, false);
  assert.equal(registry.checkNavigation('https://irctc-booking.in/').ok, false);
  assert.equal(registry.checkNavigation('http://www.irctc.co.in/').ok, false);
  assert.equal(registry.checkNavigation('https://user:pw@www.irctc.co.in/').reason, 'CREDENTIALS_IN_URL');
  assert.equal(registry.checkNavigation('javascript:alert(1)').ok, false);
  assert.equal(registry.checkNavigation('not a url').reason, 'INVALID_URL');
});

test('Assist Mode only on the local demo and private travel sites; government and railway portals stay guide-only', () => {
  for (const p of registry.PORTALS) assert.equal(p.policy, p.demo || p.kind === 'travel' ? 'assist' : 'guide-only', p.id);
  assert.equal(registry.portalForOrigin('https://www.irctc.co.in').policy, 'guide-only');
  assert.equal(registry.portalForOrigin('http://localhost:5500').id, 'demo');
  assert.equal(registry.portalForOrigin('http://localhost:8787'), null);
});

test('every portal has names and purposes in all three languages', () => {
  for (const p of registry.PORTALS) for (const l of ['en', 'hi', 'kn']) { assert.ok(p.name[l]); assert.ok(p.purpose[l]); }
});
