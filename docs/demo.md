# Demo script: the missing refund (about 4 minutes)

One case, two practice sites, one browser restart. Data is fixed in `contract/demo.md`: use exactly those values.
**The agent never presses Submit or Send. The presenter does, on camera.**

## Before you go on stage
1. `npm install`, then `npm run sites` (seller on :5501, helpline on :5502). Leave the terminal open.
2. Open `http://localhost:5502/admin` and press **Delete all practice complaints**, so the first docket is **CHP-2026-00417**.
3. Load the extension: `chrome://extensions` → Developer mode → Load unpacked → `extension/`. Pin it.
4. In the side panel, delete any old case so the panel starts empty. Set the language to Hindi for scene 3.
5. Have `mock-sites/assets/upi-payment-ms48213.png` ready to drop in when the agent asks for proof in scene 1.
6. Tabs: `http://localhost:5501/orders/MS-48213` in tab 1, nothing else. Zoom to 125% so the room can read it.

Backup: `node --test tests/browser/case-restart.test.js` with `SHOT=timeline.png` makes a screenshot of the finished
case. Keep it on a slide in case the live demo fails.

## Scene 1: the seller site (≈60 s)
- **Say:** "Ravi ordered a steel bottle set, returned it, and the refund never came. He opens WebSaathi and says, in his
  own words, 'mera refund nahi aaya'."
- Open the side panel on the order page. Speak or type the problem.
- WebSaathi reads the page and saves **Order ID MS-48213** and **₹2,499**. Click a fact's source link to show the
  exact sentence it came from: every fact has a source.
- Go to the support chat (`/support/MS-48213`). It saves **12 Nov 2026** from "Your refund of ₹2,499 will reach you by
  12 Nov 2026."
- Add the UPI screenshot as proof of payment. **Next step** now says: file a complaint.

## Scene 2: the helpline portal (≈75 s)
- **Say:** "Now a different website, a different company. Ravi doesn't have to retype anything."
- Open `http://localhost:5502/file` in a new tab. WebSaathi offers to fill the form from the case.
- It asks one field at a time ("Order ID: MS-48213. Fill this?"). Confirm each one. Name and mobile number are typed by
  the presenter: the agent never reads what the user types.
- Point at the **Submit complaint** button: "WebSaathi will not press this. Ravi does." Press it.
- The docket page shows **CHP-2026-00417**. WebSaathi saves it; the timeline shows "Complaint filed".

## Scene 3: days later, after a restart (≈75 s)
- **Say:** "A week later. Ravi has closed Chrome and forgotten all about it."
- Quit Chrome completely (⌘Q) and reopen it. Open the side panel: the case is still there, with every fact, the file
  and the docket. This is the browser-restart test running for real.
- On `http://localhost:5502/admin` press **Simulate reply** (off camera, or say "the portal replies").
- Open the docket page. It now says **"Please upload proof of payment"**.
- WebSaathi explains it in Hindi, out loud, points at the saved `upi-payment-ms48213.png` and shows the drafted reply.
- The presenter attaches the file under **Upload document** and presses **Send**. Status: "Reply received, under review".

## Scene 4: what it won't do (≈30 s)
- **Say:** "The safety rules are in code, not in a prompt."
- Ask it to press Send or Submit: it refuses and points at the button.
- Show a page with a card number or OTP field: it doesn't read or save it.
- **Close:** "One case, carried across two websites and a restart. Every fact has a source, and every final click is the user's."

## If something goes wrong
| Problem | Fix |
|---|---|
| Docket is not 00417 | `/admin` → Delete all practice complaints, then file again. |
| Portal never asks for proof | `/admin` → Simulate reply for that docket (or start the sites with `DOCKET_DELAY_MS=0`). |
| Side panel shows an old case | Delete it in the panel, or load the extension in a fresh Chrome profile. |
| Port 5501/5502 in use | `SELLER_PORT=6501 HELPLINE_PORT=6502 npm run sites`, and say the new URLs. |
