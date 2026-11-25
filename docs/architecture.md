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

## Launcher (`shared/intents.js`)

`intents.match(text)` turns a typed or spoken request into a **task** (e.g. `book_flight`, `status_train`, `complaint_train`, `cancel_ticket`) using verb words (book / complain / status / cancel) plus noun words per task, in English, Hinglish, Hindi and Kannada. A verb without a noun, or a noun without a verb, returns *clarify* (the panel asks which kind) instead of guessing. Each task lists registry portal **ids** (official site first) and a "keep these ready" checklist; `optionsFor(task, preferred)` is what the panel shows as *"I can guide you on these verified websites"*. A brand the user names (“on ixigo”) moves to the front. Banking and other uncovered topics return *unsupported* and are declined with an honest message. The matcher never returns a URL. Opening a new tab or leaving a verified site sends the panel back to this screen.

## Task playbooks (`shared/playbooks.js`)

On a real travel or status site the page is full of unrelated boxes (app-download promos, pre-ticked add-ons), so walking "the next empty field" is useless there. When the user has chosen a task that has a playbook (`book_flight`, `book_train`, `book_bus`, `book_hotel`, `status_pnr`, `status_train`, `cancel_ticket`), the side panel follows the **task**: set FROM → TO → date → travellers → press Search yourself → compare results → type names as on the ID and un-tick add-ons → payment is yours. Each step may carry visible words ("from", "search"); the content script's `WS_FIND` looks for a short visible label or aria-label with those words (never field values) and the panel highlights it, or shows the instruction as text if it is not found. The user presses **Done — next step**; WebSaathi never clicks, types or submits. Passwords, OTPs and site errors still take priority over a playbook step. If the user opens a supported site without choosing a task, the panel asks "What do you want to do on this site?". Tasks without a playbook (complaints) use the form walker, which on guide-only sites skips unlabeled boxes and tick-boxes.

## Content-script injection

Original portals and the demo have an always-on content script. The newer sites (AirSewa, NTES and the private travel sites) have **host permission only**: the side panel injects the content script on demand (`chrome.scripting.executeScript`) when the user chooses to be guided, so WebSaathi is not running on those sites otherwise. `tests/browser/launcher-tabs.test.js` exercises this path with a manifest that has no `content_scripts`.

## Site policies

| Origin | Policy |
|---|---|
| `https://www.irctc.co.in`, `https://enquiry.indianrail.gov.in` (NTES), `https://railmadad.indianrailways.gov.in` | guide-only |
| `https://consumerhelpline.gov.in`, `https://pgportal.gov.in`, `https://airsewa.gov.in` (+ `www.` variants where listed in the registry) | guide-only |
| `https://www.makemytrip.com`, `https://www.goibibo.com`, `https://www.yatra.com`, `https://www.ixigo.com`, `https://www.redbus.in` (private companies) | guide-only |
| `http://localhost:5500`, `http://127.0.0.1:5500` (demo) | assist |
| anything else (including payment sub-domains of the travel sites) | unsupported — content script stays inactive |
