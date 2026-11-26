# Demo script: the missing refund (about 4 minutes)

One case, two practice sites, one browser restart. Everything happens on the two labelled practice sites,
`http://localhost:5501` (seller) and `http://localhost:5502` (helpline), with the fictional data in `contract/demo.md`.
Never use a real portal, a real person's details or real payment data, even in rehearsal.
**The agent never presses Submit or Send. The presenter does, on camera.**

Fictional presenter details used below: name **Ananya Rao**, mobile **9000000000**, seller **Steelhouse**,
date of purchase **28 Oct 2026**.

## Before you go on stage
1. `npm install`, then `npm run sites`. The sites must be on **5501 and 5502**: the extension and the contract only
   know those two ports. If either port is busy, stop whatever is using it, don't move the sites.
2. Open `http://localhost:5502/admin` and press **Delete all practice complaints**, so the first docket is **CHP-2026-00417**.
3. Use a **fresh Chrome profile** (profile menu → Add → Continue without an account). This is how old cases are
   cleared: a new profile starts with empty extension storage. Do the whole demo, including the restart, in this profile.
4. In that profile: `chrome://extensions` → Developer mode → Load unpacked → `extension/`. Pin it.
5. Tabs: `http://localhost:5501/orders/MS-48213` only. Zoom to 125% so the room can read it.
6. Set the side-panel language to Hindi before scene 3 (or at the start, if you present in Hindi).

Backup: `SHOT=timeline.png node --test tests/browser/case-restart.test.js` saves a screenshot of the finished case
from the practice data. Keep it on a slide in case the live demo fails.

## Scene 1: the seller site (≈60 s)
- **Say:** "Ananya ordered a steel bottle set from Steelhouse, a practice shop, returned it, and the refund never came.
  She opens WebSaathi and says, in her own words, 'mera refund nahi aaya'."
- Open the side panel on the order page. Speak or type the problem.
- WebSaathi reads the page and saves **Order ID MS-48213** and **₹2,499**. Click a fact's source link to show the
  exact sentence it came from: every fact has a source.
- Press **Open seller support** (`/support/MS-48213`), then **Read this page**. It saves **12 Nov 2026** from
  "Your refund of ₹2,499 will reach you by 12 Nov 2026."
- Press **Save practice proof**. The practice UPI screenshot (`upi-payment-ms48213.png`, fictional) is saved to
  the case as proof of payment. **Next step** now says: file a complaint.

## Scene 2: the helpline portal (≈75 s)
- **Say:** "Now a different website, a different organisation. Ananya doesn't have to retype anything."
- Press **Open practice helpline** (`http://localhost:5502/file`). WebSaathi offers to fill the form from the case.
- It asks one field at a time and shows the exact value. Confirm each one. For name, mobile and date it asks the
  presenter; use the fictional details above.
- Point at the **Submit complaint** button: "WebSaathi will not press this. Ananya does." Press it.
- The docket page shows **CHP-2026-00417**. WebSaathi saves it; the timeline shows "Complaint filed".

## Scene 3: days later, after a restart (≈75 s)
- **Say:** "A week later. Ananya has closed Chrome and forgotten all about it."
- Quit Chrome completely (⌘Q) and reopen **the same demo profile**. Open the side panel: the case is still there,
  with every fact, the proof and the docket. This is the browser-restart test running for real.
- On `http://localhost:5502/admin` press **Simulate reply** (off camera, or say "the practice portal replies").
- Open the docket page. It now says **"Please upload proof of payment"**.
- WebSaathi explains it in Hindi, out loud, points at the saved `upi-payment-ms48213.png` and shows the drafted reply.
- The presenter attaches the file under **Upload document** and presses **Send**. Status: "Reply received, under review".

## Scene 4: what it won't do (≈30 s, still on the practice sites)
- **Say:** "The safety rules are in code, not in a prompt."
- On the practice docket page, ask WebSaathi to press **Send** for you: it refuses and highlights the button instead.
- File a second practice complaint on `http://localhost:5502/file`. When it asks for the mobile number, type a
  fictional code such as "OTP 482913" into the panel: it refuses to take it ("Enter only the requested information").
- Point out that the name and mobile you typed were never read back from the page: WebSaathi only fills what you
  confirmed in the panel.
- **Close:** "One case, carried across two websites and a restart. Every fact has a source, and every final click is the user's."

## If something goes wrong
| Problem | Fix |
|---|---|
| Docket is not 00417 | `/admin` → Delete all practice complaints, then file again. |
| Portal never asks for proof | `/admin` → Simulate reply for that docket (or start the sites with `DOCKET_DELAY_MS=0`). |
| Side panel shows an old case | Switch to a new fresh Chrome profile and load the extension there. |
| Port 5501 or 5502 is busy | Find and stop the other process (`lsof -i :5501`); keep the sites on 5501/5502. |
