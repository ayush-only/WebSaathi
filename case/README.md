# case/ — Person 2
- `case-store.js` — the case store on chrome.storage.local (`createStore()`); `createFakeStore()` is the same store in memory.
- `fake-store.js` — older in-memory stand-in with the contract API.
- `proof.js` — excerptOnPage, isRequestForProof, draftProofReply, explainRequest (en/hi/kn).
- `timeline.js` — renderTimeline(container, case, { lang, onSourceClick, onAttachmentClick }) for the side panel.
- `fixtures/sample-case.json` — a finished demo case for building UI.

After any change here run `npm run sync:case` so the extension gets the new copy.
