# Demo guide (≈4 minutes)

Setup (before judges arrive): `npm run demo`, Chrome with the extension loaded from `apps/extension`, http://localhost:5500 open, side panel open. Optional: `npm run backend` with keys for Live AI.

| # | Do | Say |
|---|---|---|
| 1 | Show the side panel home, switch language EN → हिन्दी → ಕನ್ನಡ → back | “Same companion in three languages. Big text, one thing at a time.” |
| 2 | Type *“mujhe consumer complaint karni hai”* → Go | “WebSaathi never lets AI invent a link. It matches a verified registry and shows the real domain — consumerhelpline.gov.in — before opening anything.” |
| 3 | (Optional) Open it → panel says *Guide only on this site* | “On real government sites and IRCTC we only point and explain. No typing, no clicking — IRCTC's terms forbid automation.” Then go back to the demo tab. |
| 4 | On the demo tab: **Help me on this page** | “This is our clearly labelled practice form — not a real government site.” Point at the **Local Demo Mode** badge: “No AI keys right now, so these steps come from built-in rules — and we label that.” |
| 5 | Answer *My name is Sita Devi* → show confirm card → **Yes, fill it** | “It shows exactly what it will type and where, and waits. Then it fills the real field and reads it back.” |
| 6 | Email: *sita at the rate example* → confirm | The site shows *Invalid email address*. “The error translator explains it in plain language and asks again.” Fix it. |
| 7 | Category: tap a big option button | “Dropdowns become big buttons.” |
| 8 | Click **Show me** (Guide Mode) | “Guide Mode only points. The user stays in control.” Fill a field by hand: the spotlight moves on. |
| 9 | **Undo last fill**, **Pause**, **Resume** | “Every step is reversible or pausable.” |
| 10 | Fill the rest, press **Continue to verification** yourself | “WebSaathi pointed at Continue but would never press it.” |
| 11 | OTP screen → orange **HUMAN HANDOFF** | “Passwords, OTPs, CAPTCHAs, UPI PINs, Aadhaar, card details: hard-coded rules, not AI, stop everything and hand over. Even if a webpage tells the assistant to type the OTP, it can't.” |

Backup if something fails live: the screenshots in `docs/screenshots/` were captured from this build.
