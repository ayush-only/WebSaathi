# Contract: mock sites and demo data

Two **different origins**, so the agent really works across sites. Both are clearly labelled "Practice site — not real".

| Site | URL | Owner |
|---|---|---|
| Seller (fictional "Steelhouse") | `http://localhost:5501/` | Person 2 |
| Consumer helpline (fictional "Consumer Help Portal") | `http://localhost:5502/` | Person 2 |

Run both with `npm run sites`.

## Demo data (use exactly this everywhere)
- Order ID **MS-48213**, item "Steel water bottle (set of 2)", paid **₹2,499** by UPI on **28 Oct 2026**
- Seller support chat: "Your refund of ₹2,499 will reach you by **12 Nov 2026**."
- Proof file: `mock-sites/assets/upi-payment-ms48213.png`
- Docket numbers look like **CHP-2026-00417** (CHP = the practice Consumer Help Portal; a new one per filing, counting up from 00417)

## Visible labels the agent can rely on
Seller site
- `/orders/MS-48213`: "Order ID" MS-48213, "Ordered on" 28 Oct 2026, "Amount paid" ₹2,499 (UPI), "Returned on", "Refund status" Approved, not received, "Refund by" 12 Nov 2026
- `/support/MS-48213`: chat transcript; the support reply reads "Your refund of ₹2,499 will reach you by 12 Nov 2026."
- Visible text of a label/value pair comes through `innerText` with a line break or tab between them. Normalise whitespace (collapse to single spaces) before checking that an excerpt is on the page, and store the normalised excerpt.

Helpline portal
- `/file`: form fields "Your name", "Mobile number", "Seller / company name", "Order ID", "Amount (₹)", "What happened?", "Date of purchase"; button **"Submit complaint"** (the user presses it)
- After submit: `/docket/<number>` shows "Docket number" and "Status"
- `/docket/<number>` later (after "Simulate reply" or 2 minutes): status "Information needed" and the heading **"Please upload proof of payment"**, with a file input "Upload document", a text box "Your reply" and a button **"Send"** (the user presses it). After Send: status "Reply received, under review".
- Validation errors appear under each field (e.g. "Please enter a 10-digit mobile number.") plus a summary "Please fix N fields below." with `role="alert"`.
- Track a complaint: home page form "Docket number" → `/track?docket=…`
- The portal remembers dockets across browser restarts (server-side JSON file).

Practice helper: `http://localhost:5502/admin` has "Simulate reply" and "Delete all practice complaints". Env `DOCKET_DELAY_MS` changes the 2-minute delay (tests use 0).
