# Architecture

## Components

| Component | Path | Responsibility |
|---|---|---|
| Side panel | `apps/extension/sidepanel/` | Intent input, routing confirmation, Guide/Assist session, confirmations, handoff screen, progress, controls, voice |
| Content script | `apps/extension/content/content.js` | Page scanner, spotlight overlay (closed shadow DOM), DOM action executor, error watcher |
| Service worker | `apps/extension/background/service-worker.js` | Opens the side panel from the toolbar icon. No state, no secrets |
| Shared core | `apps/extension/shared/` | `registry` (verified portals), `schema` (action validation), `safety` (gate), `redact`, `errors` (translator), `i18n`, `planner` (local rules) |
| Backend | `apps/backend/` | Express API: `/api/health`, `/api/next` (Bedrock planning), `/api/interpret` (Bedrock answer→value), `/api/tts` (ElevenLabs) |
| Demo portal | `apps/demo-portal/` | Clearly labelled local practice form with realistic validation and a simulated OTP step |

The shared files are UMD-style: the browser gets `globalThis.WebSaathi.<module>`, Node gets `module.exports`. One implementation of the safety rules is used everywhere.

## One step of the loop

1. **Scan** — the side panel sends `WS_SCAN`. The content script returns visible controls as compact JSON: stable temporary id (`ws-N`), kind, accessible label, options, required/disabled, `hasValue`, sensitivity, linked error text. **Never the value.**
2. **Decide** — the rule planner runs first. If it finds a sensitive control (→ `HUMAN_HANDOFF`) or a site error (→ `EXPLAIN_ERROR`), that wins, deterministically. Otherwise, if the backend reports Bedrock as configured, the redacted scan goes to `/api/next` and the model proposes **one** action; else the rule planner's action is used (Local Demo Mode). A model-proposed `FILL_FIELD` is turned into `ASK_QUESTION` — values only come from the user.
3. **Validate** — `safety.validateAction()` returns `allow`, `handoff`, `downgrade` (fill → highlight on guide-only sites/unsupported widgets), `needs-confirmation` or `block`.
4. **Present** — highlight + instruction, question card, confirmation card, error card or handoff card.
5. **Execute** — only `WS_FILL` with `confirmed: true` changes the page. The content script re-describes the element *now*, re-runs the safety gate with the live origin and policy, writes with native setters + `input`/`change` events (works with React/Angular/vanilla), blurs to trigger site validation, and reads the value back.
6. **Observe** — a `MutationObserver`, `invalid` events and user `change` events notify the panel, which rescans and repeats. Re-renders are skipped when nothing changed or the user is typing an answer.

## Action types

`HIGHLIGHT_ELEMENT`, `ASK_QUESTION`, `FILL_FIELD`, `EXPLAIN_ERROR`, `HUMAN_HANDOFF`, `WAIT_FOR_USER`, `COMPLETE_GUIDANCE`. There is deliberately **no click, submit or navigate action**. Navigation happens only from the registry after the user confirms.

## Site policies

| Origin | Policy |
|---|---|
| `https://www.irctc.co.in` | guide-only |
| `https://railmadad.indianrailways.gov.in` | guide-only |
| `https://consumerhelpline.gov.in`, `https://www.consumerhelpline.gov.in` | guide-only |
| `https://pgportal.gov.in`, `https://www.pgportal.gov.in` | guide-only |
| `http://localhost:5500`, `http://127.0.0.1:5500` (demo) | assist |
| anything else | unsupported — content script stays inactive |
