/**
 * WebSaathi content script — runs only on registry origins (see manifest.json).
 *
 *  - Page Scanner: compact JSON of visible controls. Never reads field values
 *    (only "hasValue"), so passwords/OTPs can never leave the page.
 *  - Overlay: spotlight ring + instruction bubble in a closed shadow root.
 *  - DOM Action Executor: fills a field ONLY after re-validating the action with
 *    the shared safety gate, immediately before touching the DOM.
 *  - Error watcher: MutationObserver + `invalid` events → tells the side panel.
 *
 * Webpage text is treated as untrusted data. Nothing on the page can trigger
 * an action: actions only come from the extension's side panel.
 */
(() => {
  'use strict';
  if (globalThis.__webSaathiContentLoaded) return;
  globalThis.__webSaathiContentLoaded = true;

  const WS = globalThis.WebSaathi;
  const ORIGIN = location.origin;
  const PORTAL = WS.registry.portalForOrigin(ORIGIN);
  const POLICY = PORTAL ? PORTAL.policy : null;
  if (!PORTAL) return; // not a verified origin (e.g. another localhost port): stay completely inactive
  const MAX_ELEMENTS = 150;

  // ---------------------------------------------------------------- element ids
  let seq = 0;
  const idOf = new WeakMap();
  const elById = new Map();
  function idFor(el) {
    let id = idOf.get(el);
    if (!id) { id = 'ws-' + (++seq); idOf.set(el, id); }
    elById.set(id, el);
    return id;
  }

  // ---------------------------------------------------------------- helpers
  const clean = (s, max) => String(s || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim().slice(0, max || 120);

  function textOf(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input,select,textarea,script,style,option').forEach((n) => n.remove());
    return clean(clone.textContent);
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ visibilityProperty: true })) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
    // custom-styled radios/checkboxes are often 0×0: fall back to their label
    if ((el.type === 'radio' || el.type === 'checkbox') && el.labels && el.labels[0]) {
      const lr = el.labels[0].getBoundingClientRect();
      return lr.width > 0 && lr.height > 0;
    }
    return false;
  }

  function byIds(ids) {
    return String(ids || '').split(/\s+/).filter(Boolean).map((i) => document.getElementById(i)).filter(Boolean);
  }

  function labelFor(el) {
    const lb = byIds(el.getAttribute('aria-labelledby'));
    if (lb.length) return clean(lb.map(textOf).join(' '));
    if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
    if (el.labels && el.labels.length) return textOf(el.labels[0]);
    if (el.title) return clean(el.title);
    if (el.placeholder) return clean(el.placeholder);
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') return textOf(el);
    if (el.tagName === 'INPUT' && ['submit', 'button'].includes(el.type)) return clean(el.value);
    return clean((el.name || el.id || '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'));
  }

  function groupLabel(radio) {
    const group = radio.closest('[role="radiogroup"]');
    if (group) {
      const l = byIds(group.getAttribute('aria-labelledby'));
      if (l.length) return textOf(l[0]);
      if (group.getAttribute('aria-label')) return clean(group.getAttribute('aria-label'));
    }
    const fs = radio.closest('fieldset');
    if (fs && fs.querySelector('legend')) return textOf(fs.querySelector('legend'));
    return clean(radio.name.replace(/[_-]+/g, ' '));
  }

  function kindOf(el) {
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return 'textarea';
    if (tag === 'SELECT') return 'select';
    if (tag === 'BUTTON' || el.getAttribute('role') === 'button') return 'button';
    if (tag === 'IFRAME' || tag === 'IMG') return 'frame';
    if (tag !== 'INPUT') return 'other';
    const type = (el.type || 'text').toLowerCase();
    if (['text', 'email', 'tel', 'number', 'date', 'url', 'search'].includes(type)) return type;
    if (['checkbox', 'radio', 'file', 'password'].includes(type)) return type;
    if (['submit', 'button', 'reset', 'image'].includes(type)) return 'button';
    return 'other';
  }

  function radioGroup(el) {
    const scope = el.form || document;
    return Array.from(scope.querySelectorAll('input[type="radio"]')).filter((r) => r.name === el.name);
  }

  function hasValue(el, kind) {
    switch (kind) {
      case 'checkbox': return el.checked;
      case 'radio': return radioGroup(el).some((r) => r.checked);
      case 'file': return !!(el.files && el.files.length);
      case 'select': return el.value !== '';
      case 'button': case 'frame': return false;
      default: return String(el.value || '').trim() !== '';
    }
  }

  /** ids of nodes that may hold this field's error message (incl. the fieldset of a radio group) */
  function describedIds(el) {
    const ids = [el.getAttribute('aria-errormessage'), el.getAttribute('aria-describedby')];
    if (el.type === 'radio' || el.type === 'checkbox') {
      const group = el.closest('fieldset,[role="radiogroup"]');
      if (group) ids.push(group.getAttribute('aria-describedby'), group.getAttribute('aria-errormessage'));
    }
    return ids.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  }

  function fieldError(el) {
    for (const node of byIds(describedIds(el).join(' '))) {
      const looksLikeError = node.getAttribute('role') === 'alert' || node.hasAttribute('aria-live') ||
        /error|invalid|danger/i.test(node.className || '');
      const txt = looksLikeError ? textOf(node) : '';
      if (txt && isVisible(node)) return clean(txt, 300);
    }
    if (el.getAttribute('aria-invalid') === 'true' && el.validationMessage) return clean(el.validationMessage, 300);
    return null;
  }

  /** Describe one element. Contains NO field values. */
  function describe(el) {
    const kind = kindOf(el);
    const d = {
      id: idFor(el),
      tag: el.tagName.toLowerCase(),
      type: (el.getAttribute('type') || '').toLowerCase(),
      kind,
      name: el.getAttribute('name') || '',
      idAttr: el.id || '',
      label: kind === 'radio' ? groupLabel(el) : labelFor(el),
      placeholder: clean(el.getAttribute('placeholder')),
      autocomplete: (el.getAttribute('autocomplete') || '').toLowerCase(),
      required: !!el.required || el.getAttribute('aria-required') === 'true',
      disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
      visible: isVisible(el),
      hasValue: hasValue(el, kind)
    };
    if (kind === 'button') d.text = labelFor(el);
    if (kind === 'frame') { d.src = (el.getAttribute('src') || '').slice(0, 200); d.text = clean(el.getAttribute('alt') || el.title); }
    if (kind === 'select') {
      d.options = Array.from(el.options).filter((o) => o.value !== '' && !o.disabled).slice(0, 50)
        .map((o) => ({ value: o.value, label: clean(o.text, 80) }));
    }
    if (kind === 'radio') {
      d.options = radioGroup(el).map((r) => ({ value: r.value, label: labelFor(r) || r.value }));
      d.visible = radioGroup(el).some(isVisible);
    }
    const cls = WS.safety.classifyElement(d);
    d.sensitive = cls.sensitive;
    d.sensitiveKind = cls.sensitiveKind;
    d.irreversible = cls.irreversible;
    if (kind === 'frame' && !d.sensitive) return null; // only CAPTCHA frames are interesting
    if (kind !== 'button' && kind !== 'frame') d.error = fieldError(el);
    return d;
  }

  // ---------------------------------------------------------------- scanner
  const recentInvalid = new Map(); // element → validationMessage from `invalid` events

  function scan() {
    const nodes = document.querySelectorAll(
      'input:not([type="hidden"]),textarea,select,button,[role="button"],iframe,img[alt*="captcha" i],img[src*="captcha" i]'
    );
    const elements = [];
    const seenRadioGroups = new Set();
    for (const el of nodes) {
      if (el.closest('websaathi-overlay')) continue;
      if (el.type === 'radio') {
        const key = (el.form ? 'f' : 'd') + ':' + el.name;
        if (seenRadioGroups.has(key)) continue;
        seenRadioGroups.add(key);
      }
      const d = describe(el);
      if (!d || !d.visible) continue;
      elements.push(d);
      if (elements.length >= MAX_ELEMENTS) break;
    }

    // Errors: per-field messages + visible alert regions + recent `invalid` events.
    const errors = [];
    const push = (text, fieldId) => {
      const t = clean(text, 300);
      if (t && !errors.some((e) => e.text === t && e.fieldId === fieldId)) errors.push({ text: t, fieldId: fieldId || null });
    };
    for (const d of elements) if (d.error) push(d.error, d.id);
    for (const [el, msg] of recentInvalid) {
      if (el.isConnected && isVisible(el) && !el.validity.valid) push(msg, idFor(el));
      else recentInvalid.delete(el);
    }
    const describedBy = new Set(elements.flatMap((d) => describedIds(elById.get(d.id))));
    document.querySelectorAll('[role="alert"],[aria-live="assertive"],.error-message,.invalid-feedback,.alert-danger,.field-error')
      .forEach((n) => {
        if (n.closest('websaathi-overlay') || (n.id && describedBy.has(n.id)) || !isVisible(n)) return;
        const t = textOf(n);
        if (t && t.length <= 300) push(t, null);
      });

    return {
      origin: ORIGIN,
      path: location.pathname,
      title: clean(document.title, 120),
      headings: Array.from(document.querySelectorAll('h1,h2')).filter(isVisible).slice(0, 4).map((h) => textOf(h)),
      policy: POLICY,
      portalId: PORTAL ? PORTAL.id : null,
      elements,
      errors,
      scannedAt: Date.now()
    };
  }


  // ---------------------------------------------------------------- find a spot by its visible label
  /**
   * Playbook steps ("set FROM", "press Search") point at things by the words people see on the page,
   * because travel sites build their search boxes from custom widgets, not plain <input>s.
   * Matches only short visible text / aria-label / placeholder — never field values — and returns an
   * id the side panel can ask us to highlight. Nothing is clicked, typed or read out of the page.
   */

  /** True when the element is really visible to the user: not hidden behind a site popup or modal. */
  function onTop(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const pts = [[.5, .5], [.15, .5], [.85, .5], [.5, .2], [.5, .8]];
    return pts.some(([fx, fy]) => {
      const x = r.left + r.width * fx; const y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false;
      const top = document.elementFromPoint(x, y);
      return !!top && (top === el || el.contains(top) || top.contains(el));
    });
  }

  function findByLabel(keys, preferButton) {
    const wanted = (Array.isArray(keys) ? keys : []).map((k) => String(k).toLowerCase()).filter(Boolean).slice(0, 12);
    if (!wanted.length) return null;
    const nodes = document.querySelectorAll('label,span,div,p,a,button,input,li,td,h1,h2,h3,h4,[role="button"]');
    let best = null;
    for (const el of nodes) {
      if (el.closest('websaathi-overlay') || !isVisible(el)) continue;
      const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
      const whole = el.children.length <= 4 && el.tagName !== 'INPUT' ? el.innerText : '';
      const texts = [own, el.getAttribute('aria-label'), el.tagName === 'INPUT' ? el.getAttribute('placeholder') : '', whole];
      for (const raw of texts) {
        const txt = clean(raw, 60).toLowerCase().replace(/[:*]+$/, '').trim();
        if (!txt || txt.length > 60) continue;
        let score = 0;
        for (let i = 0; i < wanted.length; i++) {
          const kw = wanted[i];
          const bonus = (wanted.length - i) * 0.1; // earlier keywords are the better match
          if (txt === kw) score = Math.max(score, 10 + bonus);
          else if (kw.length > 2 && (txt.startsWith(kw + ' ') || txt.startsWith(kw + ':'))) score = Math.max(score, 6 + bonus);
          else if (kw.length > 3 && new RegExp('(^|[^a-z])' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(txt)) score = Math.max(score, 3 + bonus);
        }
        if (!score) continue;
        if (!onTop(el)) score -= 6; // behind a popup: not what the user can see
        const interactive = el.closest('button,[role="button"],a,input,label,[tabindex]');
        if (interactive) score += preferButton ? 3 : 1;
        else if (preferButton) score -= 2;
        const r = el.getBoundingClientRect();
        if (r.top >= 0 && r.top < window.innerHeight) score += 1; // on screen right now
        if (!best || score > best.score) best = { el, score, interactive, txt };
      }
    }
    if (!best || best.score < 3) return null;
    // Frame the whole small card around the label (e.g. "From / Bengaluru"), not just the word.
    let target = (preferButton && best.interactive) ? best.interactive : best.el;
    if (!(preferButton && best.interactive)) {
      for (let i = 0; i < 3; i++) {
        const p = target.parentElement;
        if (!p || p === document.body || p === document.documentElement) break;
        const r = p.getBoundingClientRect();
        if (textOf(p).length > 90 || p.children.length > 3 || r.width > window.innerWidth * 0.45 || r.height > 220) break;
        target = p;
      }
    }
    return { id: idFor(target), label: best.txt, tag: target.tagName.toLowerCase() };
  }


  // ---------------------------------------------------------------- page stage + offers (read-only)
  /** Which step of a booking the page is on, from the address and visible headings only. */
  function detectStage() {
    const path = (location.pathname + location.search).toLowerCase();
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')).filter(isVisible)
      .map((h) => clean(textOf(h), 80).toLowerCase()).join(' | ');
    const body = clean(document.body ? document.body.innerText : '', 4000).toLowerCase();
    // Headings and the address decide; loose body text ("Pay now" on a traveller page) does not.
    if (/payment|checkout|\/pay\b|paynow/.test(path) || /select (a )?payment|payment options|choose payment|pay securely/.test(heads)) return 'pay';
    if (/traveller details|passenger details|guest details|traveler details/.test(heads) || /reviewdetails|passenger|traveller/.test(path)) return 'details';
    if (/listing|search-results|\/search\/|results|\/flight\/search|\/hotels\/hotel-listing|\/bus-tickets\//.test(path) || /sort by|showing \d+|\d+ flights?|\d+ buses|\d+ trains/.test(body.slice(0, 2500))) return 'results';
    return 'form';
  }

  /** Public coupon / offer text shown on the page (code + short line). Never reads field values. */
  function readOffers() {
    const out = [];
    const seen = new Set();
    const nodes = document.querySelectorAll('div,li,p,section,article,label');
    for (const el of nodes) {
      if (out.length >= 4) break;
      if (el.closest('websaathi-overlay') || !isVisible(el)) continue;
      if (el.querySelector('textarea,select')) continue;
      const txt = clean(el.innerText, 220); // innerText keeps word breaks between blocks; inputs add nothing
      if (txt.length < 12 || txt.length > 200) continue;
      if (!/\b(off|discount|cashback|save|coupon|code|instant)\b/i.test(txt)) continue;
      const m = txt.match(/\b([A-Z][A-Z0-9]{3,14})\b/);
      if (!m || /^(EMI|UPI|ICICI|HDFC|SBI|AXIS|VISA|GST|INR|ADD|APPLY|BOOK|FLIGHT|OFFERS?|COUPONS?|ADULT|ADULTS|CHILD|INFANT|TOTAL|PRICE|FARE|TAXES|BASE|MALE|FEMALE|ECONOMY|NOTE)$/.test(m[1])) continue;
      if (seen.has(m[1])) continue;
      // keep the smallest block: skip if a child already carries the same code
      if (Array.from(el.children).some((c) => clean(c.innerText, 220).includes(m[1]) && /(₹|%|off|save|discount)/i.test(c.innerText || ''))) continue;
      seen.add(m[1]);
      out.push({ code: m[1], text: txt.replace(m[1], '').replace(/\s+/g, ' ').trim().slice(0, 110) });
    }
    return out;
  }


  // ---------------------------------------------------------------- confirmed assist actions (travel + demo)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const TEXTY = ['text', 'email', 'tel', 'number', 'search', 'url', 'date', ''];

  function innerInput(root) {
    if (!root) return null;
    if (root.tagName === 'INPUT' || root.tagName === 'SELECT' || root.tagName === 'TEXTAREA') return root;
    const all = Array.from(root.querySelectorAll('input,select,textarea')).filter((e) => isVisible(e) && !['checkbox', 'radio', 'hidden', 'password', 'file'].includes((e.type || '').toLowerCase()));
    return all[0] || null;
  }

  /** Pick the select option that matches a typed value ("2" → "2 Adults"). */
  function optionFor(sel, value) {
    const v = String(value).trim().toLowerCase();
    const opts = Array.from(sel.options).filter((o) => o.value !== '' && !o.disabled);
    return (opts.find((o) => o.value.toLowerCase() === v) || opts.find((o) => o.text.trim().toLowerCase() === v) ||
      opts.find((o) => new RegExp('(^|\\D)' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\D|$)', 'i').test(o.text)) || {}).value || null;
  }

  /** Type a value the user confirmed into the box found by its visible words. The safety gate runs again inside fill(). */
  async function fillByKeys(msg) {
    if (POLICY !== 'assist') return { ok: false, code: 'GUIDE_ONLY_PORTAL' };
    if (msg.confirmed !== true) return { ok: false, code: 'NEEDS_CONFIRMATION' };
    const found = findByLabel(msg.keys, false);
    if (!found) return { ok: false, code: 'NOT_FOUND' };
    let node = elById.get(found.id);
    let input = innerInput(node);
    let opened = false;
    if (!input && node) {
      // A custom widget (for example a "From" card): open it the way a person would, then type into the box that appears.
      const fresh = describe(node);
      if (fresh && fresh.sensitive) return { ok: false, code: 'SENSITIVE_TARGET' };
      node.click();
      opened = true;
      await sleep(450);
      const a = document.activeElement;
      if (a && a.tagName === 'INPUT' && TEXTY.includes((a.type || '').toLowerCase()) && isVisible(a)) input = a;
    }
    if (!input) return { ok: false, code: 'NO_INPUT', opened };
    let value = String(msg.value || '');
    if (input.tagName === 'SELECT') {
      value = optionFor(input, value);
      if (!value) return { ok: false, code: 'INVALID_OPTION' };
    } else if (input.type === 'date' && msg.alt) value = String(msg.alt);
    const action = { actionType: 'FILL_FIELD', targetElementId: idFor(input), instruction: 'fill', proposedValue: value,
      requiresConfirmation: true, riskLevel: 'low', expectedOrigin: ORIGIN };
    const res = fill(action, true);
    return Object.assign({ opened }, res, { element: undefined });
  }

  /** Press one of the few allowed buttons (Search, Apply) after the user confirmed. Gate decides; payment-like words never pass. */
  function clickByKeys(msg) {
    if (POLICY !== 'assist') return { ok: false, code: 'GUIDE_ONLY_PORTAL' };
    const found = findByLabel(msg.keys, true);
    if (!found) return { ok: false, code: 'NOT_FOUND' };
    const el = elById.get(found.id);
    const fresh = el && describe(el);
    if (!fresh) return { ok: false, code: 'TARGET_GONE' };
    const action = { actionType: 'CLICK_ELEMENT', targetElementId: fresh.id, instruction: 'press', requiresConfirmation: true, riskLevel: 'low', expectedOrigin: ORIGIN };
    const check = WS.safety.validateAction(action, { origin: ORIGIN, policy: POLICY, elements: { [fresh.id]: fresh }, confirmed: msg.confirmed === true });
    if (check.decision !== 'allow') return { ok: false, code: check.code, decision: check.decision };
    highlight(el, '', 'fill');
    el.click();
    return { ok: true, code: 'CLICKED', label: fresh.text || fresh.label };
  }

  /** Flight/bus/train result cards, read from visible text only: price, times, stops, duration. */
  function readResults() {
    const cards = [];
    const priceRe = /₹\s?([\d,]{3,7})/;
    for (const el of document.querySelectorAll('div,li,article,tr,section')) {
      if (cards.length >= 40) break;
      if (el.closest('websaathi-overlay') || !isVisible(el)) continue;
      if (el.querySelector('textarea,select')) continue;
      const txt = clean(el.innerText, 400);
      if (txt.length < 20 || txt.length > 380) continue;
      const pm = txt.match(priceRe);
      const times = txt.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/g);
      if (!pm || !times || times.length < 1) continue;
      // smallest block only: skip a wrapper whose child is already a complete card
      if (Array.from(el.children).some((c) => { const t2 = clean(c.innerText, 400); return priceRe.test(t2) && /\b([01]?\d|2[0-3]):[0-5]\d\b/.test(t2); })) continue;
      const dm = txt.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i);
      cards.push({
        id: idFor(el),
        price: Number(pm[1].replace(/,/g, '')),
        depart: times[0], arrive: times[1] || null,
        stops: /non[- ]?stop/i.test(txt) ? 0 : (txt.match(/(\d)\s*stops?/i) ? Number(txt.match(/(\d)\s*stops?/i)[1]) : null),
        minutes: dm ? Number(dm[1]) * 60 + Number(dm[2] || 0) : null,
        text: txt.replace(/book now|select|view fare|details/gi, '').replace(/\s+/g, ' ').trim().slice(0, 90)
      });
    }
    return cards;
  }

  // ---------------------------------------------------------------- overlay
  let overlay = null;
  let target = null;
  let rafId = 0;

  function ensureOverlay() {
    if (overlay && overlay.host.isConnected) return overlay;
    const host = document.createElement('websaathi-overlay');
    host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        .ring{position:fixed;border-radius:10px;pointer-events:none;transition:all .15s ease-out;
          box-shadow:0 0 0 4px var(--c),0 0 18px 6px var(--g),0 0 0 9999px rgba(15,18,40,.28);}
        :host(.lite) .ring{box-shadow:0 0 0 3px var(--c),0 0 10px 3px var(--g);border-radius:8px}
        :host(.lite) .tip,:host(.lite) .arrow{display:none}
        .tip{position:fixed;max-width:340px;pointer-events:auto;background:#fff;color:#14163a;border:3px solid var(--c);
          border-radius:12px;padding:12px 14px;font:600 17px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;
          box-shadow:0 8px 24px rgba(0,0,0,.25);}
        .tip small{display:block;font:700 12px/1.2 system-ui,sans-serif;letter-spacing:.04em;color:var(--c);margin-bottom:4px;text-transform:uppercase}
        .tip button{margin-top:8px;font:600 14px system-ui,sans-serif;border:2px solid #14163a;background:#fff;border-radius:8px;padding:4px 10px;cursor:pointer}
        .tip button:focus-visible{outline:3px solid #1b1f6b;outline-offset:2px}
        .arrow{position:fixed;font-size:30px;line-height:1;color:var(--c);pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.3)}
      </style>
      <div class="ring" part="ring"></div><div class="arrow">➜</div>
      <div class="tip" role="status" aria-live="polite"><small></small><div class="msg"></div><button type="button">Hide ✕</button></div>`;
    const ring = root.querySelector('.ring');
    const tip = root.querySelector('.tip');
    const arrow = root.querySelector('.arrow');
    tip.querySelector('button').addEventListener('click', () => { clearHighlight(); notify({ type: 'WS_HIGHLIGHT_DISMISSED' }); });
    document.documentElement.appendChild(host);
    overlay = { host, ring, tip, arrow };
    return overlay;
  }

  const VARIANTS = {
    guide: { c: '#fd9b36', g: 'rgba(253,155,54,.55)', label: 'WebSaathi' },
    handoff: { c: '#c2410c', g: 'rgba(194,65,12,.5)', label: 'WebSaathi · Your turn 🔒' },
    error: { c: '#d11a2a', g: 'rgba(209,26,42,.45)', label: 'WebSaathi · Problem found' },
    fill: { c: '#2a5bc8', g: 'rgba(42,91,200,.45)', label: 'WebSaathi · Filling' }
  };

  function position() {
    if (!overlay || !target) return;
    if (!target.isConnected) { clearHighlight(); return; }
    const anchor = target.type === 'radio' ? (target.closest('fieldset,[role="radiogroup"]') || target) : target;
    if (!onTop(anchor)) { overlay.ring.style.visibility = 'hidden'; rafId = requestAnimationFrame(position); return; }
    overlay.ring.style.visibility = 'visible';
    const r = anchor.getBoundingClientRect();
    const pad = overlay.host.classList.contains('lite') ? 3 : 6;
    Object.assign(overlay.ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const tipW = Math.min(340, innerWidth - 24);
    const below = r.bottom + 14 + 120 < innerHeight;
    const left = Math.max(12, Math.min(r.left, innerWidth - tipW - 12));
    overlay.tip.style.left = left + 'px';
    overlay.tip.style.top = (below ? r.bottom + 16 : Math.max(12, r.top - overlay.tip.offsetHeight - 16)) + 'px';
    overlay.arrow.style.left = Math.max(4, r.left - 40) + 'px';
    overlay.arrow.style.top = r.top + r.height / 2 - 16 + 'px';
    rafId = requestAnimationFrame(position);
  }

  function highlight(el, instruction, variant) {
    const o = ensureOverlay();
    const v = VARIANTS[variant] || VARIANTS.guide;
    o.host.style.setProperty('--c', v.c);
    o.ring.style.setProperty('--c', v.c); o.ring.style.setProperty('--g', v.g);
    o.tip.style.setProperty('--c', v.c); o.arrow.style.setProperty('--c', v.c);
    o.tip.querySelector('small').textContent = v.label;
    o.tip.querySelector('.msg').textContent = instruction || '';
    // On real sites the ring is a thin outline only: no dimming and no floating tip, so it can
    // never cover the site's own dropdowns and popups. The words live in the side panel.
    o.host.classList.toggle('lite', !(PORTAL && PORTAL.kind === 'demo'));
    o.host.style.display = 'block';
    target = el;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(position);
  }

  function clearHighlight() {
    cancelAnimationFrame(rafId);
    target = null;
    if (overlay) overlay.host.style.display = 'none';
  }

  // ---------------------------------------------------------------- executor
  let lastEdit = null; // { id, kind, previous } — kept only in page memory, for Undo

  function snapshot(el, kind) {
    if (kind === 'checkbox') return String(el.checked);
    if (kind === 'radio') { const c = radioGroup(el).find((r) => r.checked); return c ? c.value : ''; }
    return el.value;
  }

  function setNative(el, prop, value) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (desc && desc.set) desc.set.call(el, value); else el[prop] = value;
  }

  function writeValue(el, kind, value) {
    el.focus({ preventScroll: true });
    if (kind === 'checkbox') {
      const want = value === 'true';
      if (el.checked !== want) el.click(); // toggles only; checkboxes never submit
    } else if (kind === 'radio') {
      const r = radioGroup(el).find((x) => x.value === value);
      if (!r) return false;
      if (!r.checked) r.click();
    } else {
      setNative(el, 'value', value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    el.blur();
    return snapshot(el, kind) === value;
  }

  /** Fill one field. Re-validates with the shared safety gate right before writing. */
  function fill(action, confirmed) {
    const el = action && elById.get(action.targetElementId);
    if (!el || !el.isConnected) return { ok: false, decision: 'block', code: 'TARGET_GONE' };
    const fresh = describe(el); // re-read the element *now*, not the old scan
    if (!fresh) return { ok: false, decision: 'block', code: 'TARGET_GONE' };
    const check = WS.safety.validateAction(action, {
      origin: location.origin, policy: POLICY, elements: { [fresh.id]: fresh }, confirmed: confirmed === true
    });
    if (check.decision !== 'allow') return { ok: false, decision: check.decision, code: check.code, action: check.action };
    const previous = snapshot(el, fresh.kind);
    highlight(el, '', 'fill');
    const ok = writeValue(el, fresh.kind, action.proposedValue);
    if (ok) lastEdit = { id: fresh.id, kind: fresh.kind, previous };
    const after = describe(el);
    return { ok, decision: 'allow', code: ok ? 'FILLED' : 'READBACK_MISMATCH', element: after };
  }

  function undo() {
    if (!lastEdit) return { ok: false, code: 'NOTHING_TO_UNDO' };
    const el = elById.get(lastEdit.id);
    if (!el || !el.isConnected) return { ok: false, code: 'TARGET_GONE' };
    const fresh = describe(el);
    if (fresh.sensitive || POLICY !== 'assist') return { ok: false, code: 'NOT_ALLOWED' };
    const ok = writeValue(el, lastEdit.kind, lastEdit.previous);
    const id = lastEdit.id;
    lastEdit = null;
    return { ok, id, element: describe(el) };
  }

  // ---------------------------------------------------------------- page watcher
  function notify(msg) {
    try {
      const p = chrome.runtime.sendMessage(Object.assign({ origin: ORIGIN }, msg));
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* side panel closed or extension reloaded */ }
  }

  let changeTimer = 0;
  function pageChanged(reason) {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => notify({ type: 'WS_PAGE_CHANGED', reason }), 350);
  }

  new MutationObserver((records) => {
    if (records.every((r) => r.target === overlay?.host || (overlay && overlay.host.contains(r.target)))) return;
    pageChanged('mutation');
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'hidden', 'style', 'aria-invalid', 'aria-hidden', 'disabled'] });

  document.addEventListener('invalid', (e) => {
    if (e.target && e.target.validationMessage) { recentInvalid.set(e.target, e.target.validationMessage); pageChanged('invalid'); }
  }, true);
  document.addEventListener('change', (e) => { if (e.isTrusted) pageChanged('user-change'); }, true);

  // ---------------------------------------------------------------- messages from the side panel only
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Only accept messages from this extension's own pages (side panel), never from web pages or other content scripts.
    const extPage = 'chrome-extension://' + chrome.runtime.id + '/';
    if (!sender || sender.id !== chrome.runtime.id || !String(sender.url || '').startsWith(extPage)) return false;
    let isAsync = false;
    try {
      switch (msg && msg.type) {
        case 'WS_PING':
          sendResponse({ ok: true, origin: ORIGIN, policy: POLICY, portalId: PORTAL ? PORTAL.id : null, ready: document.readyState });
          break;
        case 'WS_SCAN':
          sendResponse({ ok: true, scan: scan() });
          break;
        case 'WS_FILL_KEYS':
          fillByKeys(msg).then(sendResponse, () => sendResponse({ ok: false, code: 'CONTENT_ERROR' }));
          isAsync = true;
          break;
        case 'WS_CLICK_KEYS':
          sendResponse(clickByKeys(msg));
          break;
        case 'WS_RESULTS':
          sendResponse({ ok: true, options: readResults() });
          break;
        case 'WS_STAGE':
          sendResponse({ ok: true, stage: detectStage(), offers: readOffers() });
          break;
        case 'WS_FIND': {
          const found = findByLabel(msg.keys, msg.button === true);
          sendResponse(found ? { ok: true, id: found.id, label: found.label, tag: found.tag } : { ok: false, code: 'NOT_FOUND' });
          break;
        }
        case 'WS_HIGHLIGHT': {
          const el = elById.get(msg.id);
          if (!el || !el.isConnected || !isVisible(el.type === 'radio' ? (radioGroup(el).find(isVisible) || el) : el)) {
            sendResponse({ ok: false, code: 'TARGET_GONE' });
            break;
          }
          highlight(el, String(msg.instruction || '').slice(0, 400), msg.variant);
          sendResponse({ ok: true });
          break;
        }
        case 'WS_CLEAR':
          clearHighlight();
          sendResponse({ ok: true });
          break;
        case 'WS_FILL':
          sendResponse(fill(msg.action, msg.confirmed));
          break;
        case 'WS_UNDO':
          sendResponse(undo());
          break;
        default:
          sendResponse({ ok: false, code: 'UNKNOWN_MESSAGE' });
      }
    } catch (err) {
      sendResponse({ ok: false, code: 'CONTENT_ERROR', message: String(err && err.message || err).slice(0, 200) });
    }
    return isAsync;
  });

  // Expose pure functions for automated tests only (no effect on pages).
  globalThis.__webSaathiTest = { scan, fill, undo, highlight: (id, i, v) => { const el = elById.get(id); if (el) highlight(el, i, v); return !!el; }, clearHighlight };
})();
