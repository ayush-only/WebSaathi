/*
 * WebSaathi v2 — evidence helpers (Person 2). Pure functions, no DOM, no storage.
 *   excerptOnPage(pageText, excerpt)      → is this excerpt really in the visible page text? (whitespace-normalised)
 *   isRequestForProof(text)               → does this page text ask for proof of payment?
 *   draftProofReply(case, requestText)    → { attachmentId, attachmentName, text } or null
 *   explainRequest(case, requestText, lang) → one short spoken explanation in en / hi / kn
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebSaathiCase = Object.assign(root.WebSaathiCase || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const normalize = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const fact = (c, k) => ((c && c.facts) || []).find((f) => f.key === k);

  function excerptOnPage(pageText, excerpt) {
    const e = normalize(excerpt);
    return e.length >= 3 && normalize(pageText).includes(e);
  }

  const PROOF_RE = /\b(proof|evidence|screenshot|receipt|invoice|bank statement|transaction (id|details))\b.{0,40}\b(payment|paid|transaction)\b|\b(payment|transaction)\b.{0,20}\b(proof|evidence|receipt|screenshot)\b/i;
  const isRequestForProof = (text) => PROOF_RE.test(normalize(text));

  function draftProofReply(c, requestText) {
    if (!c || !isRequestForProof(requestText)) return null;
    const proof = (c.attachments || []).find((a) => a.type === 'paymentProof') || (c.attachments || []).find((a) => a.type === 'receipt');
    if (!proof) return null;
    const order = fact(c, 'orderId'); const amount = fact(c, 'refundAmount'); const promised = fact(c, 'promisedDate');
    const parts = [`I have attached ${proof.name} as proof of payment`];
    if (order) parts[0] += ` for order ${order.value}`;
    parts[0] += '.';
    if (amount) parts.push(`It shows the payment of ${amount.value}.`);
    if (promised) parts.push(`The seller promised the refund by ${promised.value}, but it has not reached my account.`);
    parts.push('Please process my refund.');
    return { attachmentId: proof.id, attachmentName: proof.name, text: parts.join(' ') };
  }

  function explainRequest(c, requestText, lang) {
    const draft = draftProofReply(c, requestText);
    const name = draft ? draft.attachmentName : null;
    const L = {
      en: name ? `The portal is asking for proof that you paid. Your case already has ${name}. Attach it under Upload document, check the reply, then press Send.`
        : 'The portal is asking for proof that you paid. Add a screenshot or receipt of the payment to your case first.',
      hi: name ? `पोर्टल आपसे भुगतान का सबूत माँग रहा है। आपके केस में ${name} पहले से रखा है। उसे Upload document में लगाइए, जवाब पढ़ लीजिए, फिर Send दबाइए।`
        : 'पोर्टल आपसे भुगतान का सबूत माँग रहा है। पहले भुगतान का स्क्रीनशॉट या रसीद अपने केस में जोड़िए।',
      kn: name ? `ಪೋರ್ಟಲ್ ನೀವು ಹಣ ಪಾವತಿಸಿದ ಪುರಾವೆ ಕೇಳುತ್ತಿದೆ. ನಿಮ್ಮ ಕೇಸ್‌ನಲ್ಲಿ ${name} ಈಗಾಗಲೇ ಇದೆ. ಅದನ್ನು Upload document ನಲ್ಲಿ ಸೇರಿಸಿ, ಉತ್ತರ ಓದಿ, ನಂತರ Send ಒತ್ತಿ.`
        : 'ಪೋರ್ಟಲ್ ನೀವು ಹಣ ಪಾವತಿಸಿದ ಪುರಾವೆ ಕೇಳುತ್ತಿದೆ. ಮೊದಲು ಪಾವತಿಯ ಸ್ಕ್ರೀನ್‌ಶಾಟ್ ಅಥವಾ ರಸೀದಿಯನ್ನು ನಿಮ್ಮ ಕೇಸ್‌ಗೆ ಸೇರಿಸಿ.'
    };
    return L[lang] || L.en;
  }

  return { excerptOnPage, isRequestForProof, draftProofReply, explainRequest };
});
