# Contract: the Case object

One case = one problem the user is chasing (v2 demo: a missing refund). Owned by **both**; change it only with a small PR that both people approve.

```js
Case = {
  id: string,                 // "case_" + random, made by the store
  title: string,              // "Refund for order MS-48213"
  createdAt: number,          // ms since epoch
  updatedAt: number,
  facts: Fact[],
  attachments: Attachment[],
  docket: Docket | null,
  timeline: Event[],          // newest last
  nextAction: NextAction | null
}

Fact = {
  key: 'orderId' | 'refundAmount' | 'promisedDate',   // more keys later, e.g. 'sellerName'
  value: string,              // as shown on the page: "MS-48213", "₹2,499", "12 Nov 2026"
  sourceUrl: string,          // page the fact was read from
  excerpt: string,            // exact visible text that contains the value (must exist on that page)
  capturedAt: number
}

Attachment = {
  id: string,                 // made by the store
  name: string,               // "upi-payment-ms48213.png"
  type: 'paymentProof' | 'receipt' | 'other',
  mime: string,               // "image/png", "application/pdf"
  dataUrl: string,            // base64 data URL, max 2 MB
  addedAt: number
}

Docket = {
  number: string,             // read from the helpline page after the USER pressed Submit
  portalUrl: string,          // status page for this docket
  status: string              // last status text seen, e.g. "Under review"
}

Event = {
  at: number,
  kind: 'fact' | 'filed' | 'status' | 'request' | 'reply' | 'note',
  text: string,               // plain English, shown in the timeline
  sourceUrl: string | null
}

NextAction = {
  kind: 'collect' | 'file' | 'wait' | 'respond' | 'done',
  text: string                // what the user should do next, plain English
}
```

## Rules
- A fact is saved only if `excerpt` really appears in the page's visible text and contains `value` (Person 1 checks before calling `addFact`; the store re-checks that `excerpt` includes `value`).
- Same `key` added again replaces the old fact and adds a timeline event. If only the source changed (same value), the earlier source and excerpt are kept in the timeline as a `note`, so no provenance is lost. One fact per key is kept on purpose: the panel shows one value per key.
- Never store passwords, OTPs, card numbers, Aadhaar or UPI PINs in a case.
