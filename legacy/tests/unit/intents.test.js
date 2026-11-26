'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const intents = require('../../apps/extension/shared/intents.js');
const registry = require('../../apps/extension/shared/registry.js');

const taskOf = (text) => { const r = intents.match(text); return r.kind === 'intent' ? r.task.id : r.kind; };

test('clear requests map to the right task (English, Hinglish, Hindi, Kannada)', () => {
  const cases = {
    'I want to book a train from Bengaluru to Mysuru': 'book_train',
    'Tatkal ticket kaise book kare': 'book_train',
    'मुझे ट्रेन टिकट बुक करना है': 'book_train',
    'ರೈಲು ಟಿಕೆಟ್ ಬುಕ್ ಮಾಡಬೇಕು': 'book_train',
    'book a flight to Delhi': 'book_flight',
    'mujhe flight book karni hai': 'book_flight',
    'ವಿಮಾನ ಟಿಕೆಟ್ ಬುಕ್ ಮಾಡಿ': 'book_flight',
    'book bus ticket to Hubli': 'book_bus',
    'I need a hotel room in Goa': 'book_hotel',
    'होटल बुक करना है': 'book_hotel',
    'check my PNR status': 'status_pnr',
    'where is my train': 'status_train',
    'train running status': 'status_train',
    'ट्रेन कहाँ है': 'status_train',
    'what is the status of my complaint': 'status_complaint',
    'I want to file a railway complaint': 'complaint_train',
    'the coach toilet was dirty, I want to complain': 'complaint_train',
    'my baggage was lost, airline complaint': 'complaint_flight',
    'I want to complain about a product that was not refunded': 'complaint_consumer',
    'refund not received for my online booking': 'complaint_consumer',
    'Mujhe consumer complaint register karni hai': 'complaint_consumer',
    'ಮರುಪಾವತಿ ಸಿಗಲಿಲ್ಲ ಗ್ರಾಹಕ ದೂರು': 'complaint_consumer',
    'My pension is delayed by the department': 'complaint_govt',
    'ಸರ್ಕಾರಿ ಇಲಾಖೆ ದೂರು': 'complaint_govt',
    'cancel my ticket': 'cancel_ticket',
    'I want a refund for my cancelled booking': 'cancel_ticket',
    'let me try the practice demo': 'practice'
  };
  for (const [text, id] of Object.entries(cases)) assert.equal(taskOf(text), id, text);
});

test('a verb without a noun asks which kind (clarify), never guesses', () => {
  const r = intents.match('I want to book a ticket');
  assert.equal(r.kind, 'clarify');
  assert.deepEqual(r.options.map((t) => t.id), ['book_train', 'book_flight', 'book_bus', 'book_hotel']);
  assert.equal(intents.match('I want to complain').kind, 'clarify');
  assert.equal(intents.match('check status').kind, 'clarify');
});

test('a brand named by the user moves to the front of the options', () => {
  const r = intents.match('book a flight on ixigo');
  assert.equal(r.task.id, 'book_flight');
  const ids = intents.optionsFor(r.task, r.preferred).map((o) => o.portal.id);
  assert.equal(ids[0], 'ixigo');
  assert.equal(intents.match('open makemytrip').kind, 'portal');
});

test('banking and other uncovered topics are reported as unsupported, not routed', () => {
  assert.deepEqual(intents.match('transfer money in net banking'), { kind: 'unsupported', topic: 'bank' });
  assert.equal(intents.match('apply for a passport').kind, 'unsupported');
  assert.equal(intents.match('what is the weather').kind, 'none');
  assert.equal(intents.match('').kind, 'none');
});

test('every task points only at registry portals, official site first, and is guide-only for government and railway sites', () => {
  for (const task of intents.TASKS) {
    assert.ok(task.portals.length, task.id);
    for (const l of ['en', 'hi', 'kn']) {
      assert.ok(task.label[l], task.id + ' label ' + l);
      if (task.id !== 'practice') assert.ok(intents.readyList(task, l).length, task.id + ' ready ' + l);
    }
    for (const o of intents.optionsFor(task)) {
      assert.ok(o.portal, task.id);
      assert.equal(o.level, o.portal.demo || o.portal.kind === 'travel' ? 'assist' : 'guide');
    }
  }
  assert.equal(intents.optionsFor(intents.getTask('book_train'))[0].portal.id, 'irctc');
  assert.equal(intents.optionsFor(intents.getTask('complaint_flight'))[0].portal.id, 'airsewa');
});

test('the four launcher categories each lead to at least one task', () => {
  for (const c of intents.CATEGORIES) assert.ok(intents.tasksIn(c.id).length >= 1, c.id);
  assert.ok(registry.getPortal('makemytrip') && registry.getPortal('goibibo') && registry.getPortal('yatra') && registry.getPortal('ixigo'));
});
