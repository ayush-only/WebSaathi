/*
 * WebSaathi v2 — case view for the side panel (Person 2).
 *   renderTimeline(container, case, { lang, onSourceClick(fact), onAttachmentClick(att) })
 * Plain DOM, no framework. Styles are injected once into the container's document or shadow root.
 * Theme with CSS variables on any ancestor: --wsc-ink, --wsc-ink2, --wsc-muted, --wsc-card, --wsc-raised, --wsc-accent, --wsc-font.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WebSaathiCase = Object.assign(root.WebSaathiCase || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const T = {
    en: { next: 'Next step', facts: 'What we know', from: 'From', complaint: 'Complaint', docket: 'Docket number', status: 'Status',
      files: 'Files', history: 'What has happened', none: 'Nothing saved yet', notFiled: 'Not filed yet',
      keys: { orderId: 'Order ID', refundAmount: 'Refund amount', promisedDate: 'Promised by' },
      types: { paymentProof: 'Proof of payment', receipt: 'Receipt', other: 'File' } },
    hi: { next: 'अगला कदम', facts: 'जो हमें पता है', from: 'स्रोत', complaint: 'शिकायत', docket: 'डॉकेट नंबर', status: 'स्थिति',
      files: 'फ़ाइलें', history: 'अब तक क्या हुआ', none: 'अभी कुछ सहेजा नहीं गया', notFiled: 'अभी दर्ज नहीं हुई',
      keys: { orderId: 'ऑर्डर ID', refundAmount: 'रिफ़ंड राशि', promisedDate: 'वादा की गई तारीख' },
      types: { paymentProof: 'भुगतान का सबूत', receipt: 'रसीद', other: 'फ़ाइल' } },
    kn: { next: 'ಮುಂದಿನ ಹಂತ', facts: 'ನಮಗೆ ತಿಳಿದಿರುವುದು', from: 'ಮೂಲ', complaint: 'ದೂರು', docket: 'ಡಾಕೆಟ್ ಸಂಖ್ಯೆ', status: 'ಸ್ಥಿತಿ',
      files: 'ಫೈಲ್‌ಗಳು', history: 'ಇಲ್ಲಿಯವರೆಗೆ ಏನಾಯಿತು', none: 'ಇನ್ನೂ ಏನೂ ಉಳಿಸಿಲ್ಲ', notFiled: 'ಇನ್ನೂ ದಾಖಲಾಗಿಲ್ಲ',
      keys: { orderId: 'ಆರ್ಡರ್ ID', refundAmount: 'ರಿಫಂಡ್ ಮೊತ್ತ', promisedDate: 'ಭರವಸೆ ನೀಡಿದ ದಿನಾಂಕ' },
      types: { paymentProof: 'ಪಾವತಿ ಪುರಾವೆ', receipt: 'ರಸೀದಿ', other: 'ಫೈಲ್' } }
  };

  const CSS = `
.wsc{--i:var(--wsc-ink,#111827);--i2:var(--wsc-ink2,#4b5565);--m:var(--wsc-muted,#5f6879);--c:var(--wsc-card,#fff);--r:var(--wsc-raised,#eef1f5);
 --a:var(--wsc-accent,#23439a);--line:color-mix(in srgb,var(--i) 9%,transparent);
 font:400 14px/20px var(--wsc-font,system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif);color:var(--i);display:grid;gap:20px}
.wsc *{box-sizing:border-box}
.wsc h3{margin:0 0 8px;font-size:13px;line-height:16px;font-weight:500;color:var(--m)}
.wsc-title{font-size:17px;line-height:24px;font-weight:500;margin:0}
.wsc-next{background:var(--r);border-radius:12px;padding:12px 16px;display:grid;gap:4px}
.wsc-next b{font-weight:500;font-size:13px;color:var(--i2)}
.wsc-next p{margin:0;font-size:15px;line-height:22px}
.wsc-list{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:12px;background:var(--c)}
.wsc-list>li{padding:12px 16px;border-top:1px solid var(--line);display:grid;gap:4px}
.wsc-list>li:first-child{border-top:0}
.wsc-row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.wsc-k{color:var(--i2)}.wsc-v{font-weight:500;text-align:right;font-variant-numeric:tabular-nums}
.wsc-mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;white-space:nowrap}
.wsc-src{display:flex;gap:6px;align-items:baseline;font-size:12px;line-height:16px;color:var(--m);min-width:0}
.wsc-src button{all:unset;cursor:pointer;color:var(--a);text-decoration:underline;text-underline-offset:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.wsc-src button:focus-visible,.wsc-file:focus-visible{outline:2px solid var(--a);outline-offset:2px;border-radius:4px}
.wsc-q{color:var(--m);font-size:12px;line-height:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wsc-empty{color:var(--m);padding:12px 16px}
.wsc-stamp{display:inline-grid;gap:2px;border:1.5px solid var(--a);border-radius:8px;padding:8px 12px;color:var(--a)}
.wsc-stamp small{font-size:12px;line-height:16px;color:var(--i2)}
.wsc-stamp span{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:16px;line-height:22px;font-weight:500}
.wsc-filed{display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.wsc-dot{display:inline-block;width:8px;height:8px;border-radius:4px;background:var(--m);margin-right:8px;vertical-align:1px}
.wsc-dot.need{background:#b54708}
.wsc-file{all:unset;cursor:pointer;display:grid;grid-template-columns:40px 1fr;gap:12px;align-items:center}
.wsc-thumb{width:40px;height:40px;border-radius:8px;background:var(--r);object-fit:cover}
.wsc-tl{list-style:none;margin:0;padding:0}
.wsc-tl li{position:relative;padding:0 0 12px 20px;font-size:13px;line-height:18px}
.wsc-tl li::before{content:"";position:absolute;left:3px;top:5px;width:8px;height:8px;border-radius:4px;border:1.5px solid var(--i2);background:var(--c)}
.wsc-tl li.request::before{background:#b54708;border-color:#b54708}
.wsc-tl time{display:block;color:var(--m);font-size:12px;line-height:16px}
`;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const short = (url) => { try { const u = new URL(url); return u.host + u.pathname; } catch (_) { return String(url || ''); } };
  const when = (ms, lang) => new Date(ms).toLocaleString(lang === 'hi' ? 'hi-IN' : lang === 'kn' ? 'kn-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function injectCss(container) {
    const host = container.getRootNode();
    const target = host.head || host; // document head, or the shadow root itself
    if (target.querySelector && target.querySelector('style[data-wsc]')) return;
    const st = container.ownerDocument.createElement('style');
    st.setAttribute('data-wsc', '');
    st.textContent = CSS;
    target.appendChild(st);
  }

  function renderTimeline(container, c, opts) {
    const o = opts || {};
    const lang = T[o.lang] ? o.lang : 'en';
    const t = T[lang];
    injectCss(container);
    if (!c) { container.innerHTML = `<div class="wsc"><p class="wsc-empty">${esc(t.none)}</p></div>`; return; }

    const facts = ['orderId', 'refundAmount', 'promisedDate'].map((k) => (c.facts || []).find((f) => f.key === k)).filter(Boolean)
      .concat((c.facts || []).filter((f) => !t.keys[f.key]));
    const need = c.nextAction && c.nextAction.kind === 'respond';
    const html = `<div class="wsc">
 <p class="wsc-title">${esc(c.title)}</p>
 ${c.nextAction ? `<div class="wsc-next" role="status"><b>${esc(t.next)}</b><p>${esc(c.nextAction.text)}</p></div>` : ''}
 <section><h3>${esc(t.facts)}</h3>${facts.length ? `<ul class="wsc-list">${facts.map((f, i) => `<li>
   <div class="wsc-row"><span class="wsc-k">${esc(t.keys[f.key] || f.key)}</span><span class="wsc-v${f.key === 'orderId' ? ' wsc-mono' : ''}">${esc(f.value)}</span></div>
   <div class="wsc-src">${esc(t.from)} <button type="button" data-fact="${i}" title="${esc(f.sourceUrl)}">${esc(short(f.sourceUrl))}</button></div>
   <div class="wsc-q" title="${esc(f.excerpt)}">“${esc(f.excerpt)}”</div></li>`).join('')}</ul>` : `<div class="wsc-list"><p class="wsc-empty" style="margin:0">${esc(t.none)}</p></div>`}</section>
 <section><h3>${esc(t.complaint)}</h3>${c.docket ? `<div class="wsc-filed">
   <div class="wsc-stamp"><small>${esc(t.docket)}</small><span>${esc(c.docket.number)}</span></div>
   <div><div class="wsc-k" style="font-size:12px">${esc(t.status)}</div><div><span class="wsc-dot${need ? ' need' : ''}" aria-hidden="true"></span>${esc(c.docket.status || '—')}</div></div></div>`
    : `<p class="wsc-k" style="margin:0">${esc(t.notFiled)}</p>`}</section>
 ${(c.attachments || []).length ? `<section><h3>${esc(t.files)}</h3><ul class="wsc-list">${c.attachments.map((a, i) => `<li><button type="button" class="wsc-file" data-att="${i}">
   ${/^image\//.test(a.mime) ? `<img class="wsc-thumb" alt="" src="${esc(a.dataUrl)}">` : '<span class="wsc-thumb" aria-hidden="true"></span>'}
   <span><span style="display:block;font-weight:500">${esc(a.name)}</span><span class="wsc-k" style="font-size:12px">${esc(t.types[a.type] || t.types.other)}</span></span></button></li>`).join('')}</ul></section>` : ''}
 <section><h3>${esc(t.history)}</h3><ol class="wsc-tl">${(c.timeline || []).slice().reverse().map((e) => `<li class="${esc(e.kind)}">${esc(e.text)}<time>${esc(when(e.at, lang))}</time></li>`).join('')}</ol></section>
</div>`;
    container.innerHTML = html;
    container.querySelectorAll('[data-fact]').forEach((b) => b.addEventListener('click', () => o.onSourceClick && o.onSourceClick(facts[Number(b.dataset.fact)])));
    container.querySelectorAll('[data-att]').forEach((b) => b.addEventListener('click', () => o.onAttachmentClick && o.onAttachmentClick(c.attachments[Number(b.dataset.att)])));
  }

  return { renderTimeline };
});
