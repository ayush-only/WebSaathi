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
| `https://www.makemytrip.com`, `https://www.goibibo.com`, `https://www.yatra.com`, `https://www.ixigo.com`, `https://www.redbus.in` (private companies) | assist (every fill and click needs the user's confirmation; Guide Mode is one tap away) |
| `http://localhost:5500`, `http://127.0.0.1:5500` (demo) | assist |
| anything else (including payment sub-domains of the travel sites) | unsupported — content script stays inactive |

### Following the booking after the search form

On a playbook session the panel asks the page for its **stage** (`WS_STAGE`): `form`, `results`, `details` or `pay`, decided from the address and visible headings only. When the page has moved ahead of the current step, the playbook moves with it (the Back button turns that off until the user presses Next). On results and traveller pages it also reads the **public offer text** (a code plus a short line, for example `MMTSECURE — ₹417 off`), shows up to four in the panel, and reminds the user to type a code themselves; it never applies one. The traveller step highlights "Add new adult/traveller" and explains choosing a saved traveller or adding one with the name exactly as on the ID. At payment the playbook hands off. Field values are never read.

On real sites the on-page highlight is a thin outline with no dimming and no floating tip, so it cannot cover the site's own dropdowns and popups; the words are in the side panel. The practice pages are `flights.html`, `flights-results.html`, `flights-details.html` and `flights-pay.html`.

### Assist on travel sites (ask → confirm → do)

Private travel sites use `policy: 'assist'`; government and railway sites stay guide-only (IRCTC's terms prohibit automation, and WebSaathi never submits to a real service). In Assist Mode a playbook step can **ask**, then **confirm**, then act:

1. **Search form.** The panel asks "Where are you leaving from?", then To, date ("26 Nov", "tomorrow") and travellers, by typing or voice. It shows "Type “Pune” into the from box?" and only types after **Yes**. A custom widget (a "From" card) is opened the way a person would, then typed into (`WS_FILL_KEYS`). If the site's widget cannot be typed into, the panel says so and the user does that step; the user taps any suggestion the site shows.
2. **Search.** The panel asks "Shall I press SEARCH?" and presses it after **Yes** (`WS_CLICK_KEYS`, new action `CLICK_ELEMENT`).
3. **Results.** The panel asks what matters (cheapest, fastest, earliest, non-stop, time of day, highest price), reads the visible result cards (price, times, stops; `WS_RESULTS`) and shows the best three with a **Show me** button. The user clicks the flight.
4. **Extras.** It explains price-lock and add-ons and points at them; the user ticks any. WebSaathi never ticks them.
5. **Coupon.** "Do you have a coupon code?" Yes: typed into the coupon box and APPLY pressed after a confirm. No: the offers the page already lists are shown with a plain note of when each tends to work (bank card, minimum amount, UPI/wallet, first booking) and **Use this code**.
6. **Payment.** The playbook stops and hands off.

**Hard limits in `safety.js`:** `CLICK_ELEMENT` is allowed only on `assist` sites, only after confirmation, only for buttons labelled Search or Apply, and any label containing pay, OTP, password, UPI, card, net banking, wallet, book now, continue, proceed, confirm, submit, cancel or log in is refused. Sensitive fields (password, OTP, card, ID numbers) are always a human hand-off. `fill()` re-validates in the page right before writing.

### Agent mode: any other website

For a site that is not in the registry the user types or says a goal and presses **Help me on this page**. Chrome then asks for permission for that one site (`optional_host_permissions: https://*/*`, requested at runtime), the content script is injected and switched on with `WS_SET_AGENT`, and WebSaathi works **on that site only** until the user leaves it. Until then the content script is inert: it answers only `WS_PING` and `WS_SET_AGENT`.

Each step the content script sends the model (through the backend, after redaction) a compact view of the live page: the form fields and buttons, `clickables` (custom widgets such as a From card or a date tab), the visible text (first 1,500 characters), the booking stage, the offers shown, the result cards, and a short history of earlier actions. No field values. The model proposes **one** action from a fixed list; the backend and the extension both run it through `safety.js` before anything is shown.

- **Fills** are never supplied by the model: a proposed fill becomes a question to the user, and typing happens only after the user's tap (`WS_FILL_ID` opens a custom widget, then types).
- **Presses** (`CLICK_ELEMENT`) are limited to Search and Apply buttons, only after a tap. Pay, Book Now, Continue, Proceed, Confirm, Submit, Login and Cancel are refused whatever the model says.
- **Refused sites:** plain http (except localhost), banking and payment hostnames. Government and IRCTC hosts are guide-only.
- **Hand-offs** (passwords, OTP, card, UPI, ID numbers) stay on screen until the user says they did it; a page change or the model's next idea never skips one.
- Without a model (Local Demo Mode) agent mode falls back to the rule-based walker and says so.

Tests use a scripted stand-in for the model (`tests/browser/agent-mode.test.js`, `tests/unit/backend.test.js`); real Bedrock has not been exercised.

