'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const playbooks = require('../../apps/extension/shared/playbooks.js');
const intents = require('../../apps/extension/shared/intents.js');
const planner = require('../../apps/extension/shared/planner.js');

test('every step in every playbook exists and has text in English, Hindi and Kannada', () => {
  for (const [task, ids] of Object.entries(playbooks.TASK_STEPS)) {
    assert.ok(intents.getTask(task), 'unknown task ' + task);
    for (const id of ids) {
      assert.ok(playbooks.STEPS[id], task + ' → ' + id);
      for (const l of ['en', 'hi', 'kn']) assert.ok(playbooks.STEPS[id][l], `${id} ${l}`);
    }
  }
});

test('booking playbooks follow the task: search form first, then compare, passenger details, payment handoff', () => {
  const flight = playbooks.stepsFor('book_flight', 'en').map((s) => s.id);
  assert.deepEqual(flight.slice(0, 5), ['tripType', 'from', 'to', 'date', 'travellers']);
  assert.ok(flight.indexOf('search') < flight.indexOf('details'));
  assert.equal(flight[flight.length - 1], 'pay');
  assert.match(playbooks.stepsFor('book_flight', 'en').find((s) => s.id === 'details').text, /un-tick extras/);
});

test('the Search / Cancel steps are marked final: the user presses them, never WebSaathi', () => {
  assert.equal(playbooks.stepsFor('book_train', 'en').find((s) => s.id === 'search').final, true);
  assert.equal(playbooks.stepsFor('cancel_ticket', 'en').find((s) => s.id === 'cancelBtn').final, true);
});

test('tasks without a playbook (complaints) return no steps and use the form walker', () => {
  assert.deepEqual(playbooks.stepsFor('complaint_train', 'en'), []);
  assert.equal(playbooks.has('book_flight'), true);
  assert.equal(playbooks.has('complaint_consumer'), false);
});

test('on real sites the form walker skips unlabeled boxes and tick-boxes (promos, pre-ticked add-ons)', () => {
  const scan = { origin: 'https://www.makemytrip.com', elements: [
    { id: 'a', kind: 'checkbox', label: '', visible: true },
    { id: 'b', kind: 'checkbox', label: 'Add Price Drop Protection', visible: true },
    { id: 'c', kind: 'text', label: '', placeholder: 'Enter Mobile number', visible: true },
    { id: 'd', kind: 'text', label: 'Passenger name', visible: true }
  ], errors: [] };
  const r = planner.nextAction(scan, { mode: 'guide', lang: 'en', policy: 'guide-only' });
  assert.equal(r.action.targetElementId, 'd');
  // on the practice (assist) site the old behaviour is unchanged
  const r2 = planner.nextAction(scan, { mode: 'guide', lang: 'en', policy: 'assist' });
  assert.equal(r2.action.targetElementId, 'a');
});
