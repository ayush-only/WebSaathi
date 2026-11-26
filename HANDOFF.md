# Handoff (Person 2 / case & demo) — state on branch p2/case

Done and tested
- `mock-sites/` practice seller (:5501) and helpline (:5502), dockets persist, proof request, reply. `npm run sites`. Test: `tests/browser/case-sites.test.js` (passes).
- `case/case-store.js` real store (chrome.storage.local, queued writes, auto nextAction, onChange). `createFakeStore()` = same store in memory.
- `case/proof.js` excerptOnPage, isRequestForProof, draftProofReply, explainRequest (en/hi/kn).
- `case/timeline.js` renderTimeline(container, case, { lang, onSourceClick, onAttachmentClick }).
- Unit tests `tests/case-store.test.js` (pass).

- `tests/browser/case-restart.test.js`: browser-restart proof, passes (no WIP gate). The old hang was the test page's
  inline `<script>`: MV3 extension pages block inline scripts, so `window.ready` never got set. Setup now lives in `init.js`.
  Needs Chrome for Testing / Chromium (branded Chrome 137+ ignores `--load-extension`): `npx playwright-core install chromium`,
  then set CHROME_PATH to the "Google Chrome for Testing" binary under ~/Library/Caches/ms-playwright.

Next
1. Polish the timeline look (screenshot: SHOT=/tmp/timeline.png with the restart test).
2. Update contract/case-store.md: new functions removeAttachment, deleteCase, nextActionFor, proof helpers; unlimitedStorage permission.
3. Demo script in docs/demo.md (four scenes), README setup steps.
4. Merge p2/case into v2 (fast-forward; gh CLI was not authenticated, so no PR).
