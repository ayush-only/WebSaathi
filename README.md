# WebSaathi v2

**A browser agent that carries your case across websites.** It saves what it finds, shows where each fact came from, and picks up where you left off, in Hindi, Kannada or English.

wHACKiest 2026 · Track 02: Beyond the Browser · Team AI slop aah (Ramaiah Institute of Technology)

> This is the `v2` branch (in progress). The v1 side-panel companion is in `legacy/` and on `main`.

## The demo story: a missing refund
1. **Seller site:** "My refund never came." WebSaathi reads the order and support pages and saves the order ID, amount and promised date, each linked to its source.
2. **Helpline portal:** it fills the complaint from the case after you confirm each value. You press Submit; the docket number goes into the case.
3. **Later:** the portal asks for proof of payment. WebSaathi explains it, finds the saved proof and drafts the reply. You attach it and press Send.

Both sites are clearly labelled practice sites with fictional data.

## Layout
```
contract/     the shared Case format, store API and demo data (start here)
extension/    Chrome extension: side panel, page reader, agent loop, safety gate
backend/      Node + Express API to AWS Bedrock (fact extraction, next action)
case/         case store (chrome.storage.local), timeline UI, proof-reply drafts
mock-sites/   practice seller site (:5501) and helpline portal (:5502)
legacy/       v1 code, reference only
```
See `AGENTS.md` for owners, branches and safety rules.

## Run
```
npm install
npm run sites
```
Then load `extension/` unpacked in Chrome. Setup details will be filled in as parts land.
