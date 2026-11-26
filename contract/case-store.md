# Contract: the case store API

Person 2 owns the implementation (`case/case-store.js`). Person 1 only calls these functions.

- `WebSaathiCase.createStore()` — backed by `chrome.storage.local`; survives a browser restart. The extension manifest needs the `storage` and `unlimitedStorage` permissions (attachments are data URLs up to 2 MB each).
- `WebSaathiCase.createFakeStore()` — the same store in memory, for tests.
- `case/fake-store.js` is a self-contained, generated copy of `case-store.js`: a page may load it alone, with no load order to get right.

**Write guarantee.**
- When the Web Locks API exists (every extension page and the service worker share it): each change to a case runs under `navigator.locks.request('wsCase:' + id, …)`, so writes to **the same case** from any number of store instances (two open panels, a panel and the service worker) are applied one at a time and none is lost. The list of cases is changed under its own lock, `wsCase:index`, always taken after the case lock.
- Without Web Locks: writes are queued **per store instance** only. Two instances writing to the same case at the same time can still lose a write.
- Writes to different cases are not ordered with respect to each other.

All functions are **async** (return Promises). Errors are thrown as `Error` with a `code` property.

| Function | Returns | Notes |
|---|---|---|
| `createCase(title)` | `Case` | Adds a "Case opened" event. |
| `getCase(id)` | `Case \| null` | |
| `listCases()` | `Case[]` | Newest `updatedAt` first. |
| `getActiveCase()` / `setActiveCase(id)` | `Case \| null` / `void` | The case the side panel is working on; survives restart. |
| `addFact(id, fact)` | `Case` | Throws `BAD_FACT` if a field is missing, `sourceUrl` is not http(s), or `excerpt` does not contain `value`; `SENSITIVE` if the value, the excerpt **or the full `sourceUrl` (query string included, also percent-decoded)** looks like a card number, Aadhaar, UPI ID or OTP. Adds a `fact` event. Same value from a different page: the new source replaces the old one, and the earlier source and excerpt stay in the timeline as a `note` ("Also on …"). |
| `addAttachment(id, {name, type, mime, dataUrl})` | `Attachment` | Throws `TOO_LARGE` over 2 MB. `mime` is optional (read from the data URL). |
| `removeAttachment(id, attachmentId)` | `Case` | Adds a `note` event. |
| `setDocket(id, docket)` | `Case` | Adds a `filed` event the first time, `status` events after. |

Every URL the store saves (`sourceUrl`, `portalUrl`, event `sourceUrl`) is stored without its query string or hash.
| `addEvent(id, {kind, text, sourceUrl})` | `Case` | For `request`, `reply`, `note`. The same event twice in a row (e.g. page reload) is ignored. |
| `setNextAction(id, next)` | `Case` | Overrides the computed next step until the next change. |
| `deleteCase(id)` | `void` | Clears the active case if it was this one. |
| `onChange(callback)` | `unsubscribe` function | Returns `unsubscribe` **synchronously** (not a Promise). `callback(case)` runs after any change, in this page or another extension page. |

`nextAction` is recomputed after every change with `nextActionFor(case)`: `collect` until all three facts are saved, then `file`, then `wait`; `respond` when the last `request` event has no `reply` after it (it names the `paymentProof` attachment, or a `receipt` if there is none, the same file `draftProofReply` picks); `done` when the docket status says resolved or closed.

Helpers (also in `case/`, Person 2):

| Function | File | Returns |
|---|---|---|
| `missingFacts(case)` | case-store.js | keys still needed before filing: `['refundAmount', …]` |
| `nextActionFor(case)` | case-store.js | the computed `NextAction` |
| `excerptOnPage(pageText, excerpt)` | proof.js | `true` if the excerpt is in the visible text (whitespace-normalised) |
| `isRequestForProof(text)` | proof.js | `true` if the page text asks for proof of payment |
| `draftProofReply(case, requestText)` | proof.js | `{ attachmentId, attachmentName, text }` or `null` when no suitable attachment |
| `explainRequest(case, requestText, lang)` | proof.js | one short spoken explanation, `lang` = `en` / `hi` / `kn` |
| `renderTimeline(containerEl, case, { lang, onSourceClick(fact), onAttachmentClick(attachment) })` | timeline.js | draws the case view into the side panel and returns nothing. `onSourceClick` receives the clicked `Fact`, `onAttachmentClick` the clicked `Attachment` (shapes in `contract/case.md`). |

Loading: every file in `case/` is a UMD module. In the extension it sets `globalThis.WebSaathiCase`; in Node it is `require()`-able. Chrome can't load files outside `extension/`, so `npm run sync:case` copies `case/*.js` to `extension/vendor/case/`.
