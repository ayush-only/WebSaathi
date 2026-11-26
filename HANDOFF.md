# Handoff (Person 2 / case & demo) — state on branch p2/case

Done and tested
- `mock-sites/` practice seller (:5501) and helpline (:5502), dockets persist, proof request, reply. `npm run sites`. Test: `tests/browser/case-sites.test.js` (passes).
- `case/case-store.js` real store (chrome.storage.local, queued writes, auto nextAction, onChange). `createFakeStore()` = same store in memory.
- `case/proof.js` excerptOnPage, isRequestForProof, draftProofReply, explainRequest (en/hi/kn).
- `case/timeline.js` renderTimeline(container, case, { lang, onSourceClick, onAttachmentClick }).
- Unit tests `tests/case-store.test.js` (pass).

In progress
- `tests/browser/case-restart.test.js` (run with `WIP=1`): the browser-restart proof. Session 1 times out waiting for the
  second extension page to receive onChange events. Check that chrome.storage.onChanged fires in page `b`
  (maybe the listener in createStore's chromeStorage adapter, or page b needs focus); then session 2 should pass.

Next
1. Fix the restart test, screenshot the timeline (SHOT=/tmp/timeline.png) and polish its look.
2. Update contract/case-store.md: new functions removeAttachment, deleteCase, nextActionFor, proof helpers; unlimitedStorage permission.
3. Demo script in docs/demo.md (four scenes), README setup steps.
4. Merge p2/case into v2 (fast-forward; gh CLI was not authenticated, so no PR).
