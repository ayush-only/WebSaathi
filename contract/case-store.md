# Contract: the case store API

Person 2 owns the implementation (`case/case-store.js`). Person 1 only calls these functions. Until the real store is merged, use `case/fake-store.js` (same API, in memory).

All functions are **async** (return Promises). Errors are thrown as `Error` with a `code` property.

| Function | Returns | Notes |
|---|---|---|
| `createCase(title)` | `Case` | Adds a "Case opened" event. |
| `getCase(id)` | `Case \| null` | |
| `listCases()` | `Case[]` | Newest `updatedAt` first. |
| `getActiveCase()` / `setActiveCase(id)` | `Case \| null` / `void` | The case the side panel is working on; survives restart. |
| `addFact(id, fact)` | `Case` | Throws `BAD_FACT` if a field is missing or `excerpt` does not contain `value`. Adds a `fact` event. |
| `addAttachment(id, {name, type, mime, dataUrl})` | `Attachment` | Throws `TOO_LARGE` over 2 MB. |
| `setDocket(id, docket)` | `Case` | Adds a `filed` event the first time, `status` events after. |
| `addEvent(id, {kind, text, sourceUrl})` | `Case` | For `request`, `reply`, `note`. |
| `setNextAction(id, next)` | `Case` | |
| `onChange(callback)` | `unsubscribe()` | `callback(case)` after any change. |

Helpers (also in `case/`, Person 2):

| Function | Returns |
|---|---|
| `missingFacts(case)` | keys still needed before filing: `['refundAmount', …]` |
| `draftProofReply(case, requestText)` | `{ attachmentId, text }` or `null` when no suitable attachment |
| `renderTimeline(containerEl, case, { onSourceClick })` | draws the case timeline into the side panel |

Loading: every file in `case/` is a UMD module. In the extension it sets `globalThis.WebSaathiCase`; in Node it is `require()`-able.
