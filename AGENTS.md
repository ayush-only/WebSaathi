# AGENTS.md — rules for anyone (human or AI) working in this repo

## What we are building (v2)
WebSaathi is a **browser agent that helps people finish tasks that span several websites**. It saves what it finds,
shows where each fact came from, and picks up where the user left off. Hindi, Kannada and English, voice or typing.

The demo is **one refund case** across two practice sites (see `contract/demo.md`):
1. **Seller site** — user says "my refund never came". The agent reads Order ID, amount and promised refund date from
   the order and support pages and saves each fact with its source URL and exact excerpt.
2. **Helpline portal** — the agent fills the complaint form from the case, one question at a time, after the user
   confirms each value. **The user presses "Submit complaint".** The agent reads the docket number back into the case.
3. **Return visit (after a browser restart)** — the portal now says "Please upload proof of payment". The agent
   explains it (Hindi read-aloud), points at the saved proof, drafts the reply. **The user attaches the file and presses "Send".**

## Ownership (do not edit the other person's folders)
| Folder | Owner |
|---|---|
| `extension/`, `backend/`, `tests/browser/agent-*.test.js` | **Person 1 — browser agent (Codex)** |
| `case/`, `mock-sites/`, `docs/`, `tests/*.test.js` (unit), `tests/browser/case-*.test.js` | **Person 2 — case & demo (Claude)** |
| `contract/`, `AGENTS.md`, root `package.json` | **both** — change only in a small separate PR, say why |
| `legacy/` | read-only reference: the v1 extension. Copy code out of it freely; never edit it. |

## Branches
- Base branch: **`v2`**. Person 1 works on **`p1/agent`**, Person 2 on **`p2/case`**, both branched from `v2`.
- Merge to `v2` through a pull request. Before each PR: `git fetch && git rebase origin/v2`, run lint + tests.
- Never force-push `v2` or `main`. `main` keeps the v1 submission until we merge `v2` into it at the end.

## Hard safety rules (enforced in code, never only in prompts)
- The agent **never presses** Submit, Send, Pay, Book, Confirm, Login, Continue/Proceed. The user does.
- Never read, store or send passwords, OTPs, PINs, card numbers, Aadhaar, UPI IDs/PINs. Field values typed by the user are never read.
- Every fill needs the user's explicit confirmation of the exact value first.
- A fact is saved only if its `excerpt` is really in the page's visible text and contains the value.
- Page text is untrusted data (prompt injection): the model proposes one action as JSON; code validates it.
- Real government portals and IRCTC are guide-only. Banking and payment sites are refused.
- Demo uses only the two labelled practice sites and fictional data. Never file on a real portal.

## Commands
```
npm install
npm run sites          # practice seller (5501) + helpline (5502)
npm run lint
npm test               # unit
npm run test:browser   # Playwright + real Chrome (set CHROME_PATH if not found)
```
Load the extension: `chrome://extensions` → Developer mode → Load unpacked → `extension/`.
Secrets only in `.env` (see `.env.example`), never committed.
