(() => {
  'use strict';
  const WS = globalThis.WebSaathi;
  const kind = WS.evidence.pageKind(location.href);
  if (!kind) return;

  const ids = new WeakMap();
  const targets = new Map();
  const pageId = crypto.randomUUID();
  let sequence = 0;
  let spotlight = null;
  let highlighted = null;

  function visible(el) {
    return !el.closest('[hidden], [inert], [aria-hidden="true"]')
      && el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      && getComputedStyle(el).visibility === 'visible';
  }

  function pageText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const parts = [];
    const excluded = 'script, style, template, noscript, input, textarea, select, [data-websaathi-spotlight], [contenteditable]:not([contenteditable="false"])';
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (parent.closest(excluded) || !visible(parent)) continue;
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects());
      if (!rects.some((rect) => rect.width > 1 && rect.height > 1)) continue;
      parts.push(node.textContent);
    }
    return WS.evidence.cleanText(parts.join(' '));
  }

  function labelOf(el) {
    const referred = (el.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map((id) => document.getElementById(id)?.innerText || '').join(' ').trim();
    return (referred || el.getAttribute('aria-label') || el.labels?.[0]?.innerText
      || (el.tagName === 'BUTTON' ? el.innerText : '') || el.name || '').replace(/\s*\*\s*$/, '').trim();
  }

  function describe(el) {
    const tag = el.tagName.toLowerCase();
    const type = el.type || '';
    const kind = tag === 'button' || ['submit', 'button', 'reset', 'image'].includes(type)
      ? 'button' : tag === 'input' ? type : tag;
    const descriptor = { kind, type, tag, label: labelOf(el), name: el.name, idAttr: el.id,
      autocomplete: el.autocomplete, placeholder: el.placeholder };
    return { ...descriptor, ...WS.safety.classifyElement(descriptor), visible: visible(el),
      disabled: el.matches(':disabled, [aria-disabled="true"]') || !!el.readOnly };
  }

  function scan() {
    const controls = [];
    targets.clear();
    for (const el of document.querySelectorAll('input, textarea, select, button')) {
      const control = describe(el);
      if (!control.visible || control.sensitive || control.type === 'hidden') continue;
      if (!ids.has(el)) ids.set(el, 'ws-' + (++sequence));
      const id = ids.get(el);
      targets.set(id, el);
      controls.push({ id, kind: control.kind, label: control.label, disabled: control.disabled });
    }
    return { url: WS.evidence.safeUrl(location.href), pageId, text: WS.evidence.redactSnapshot(pageText()), controls };
  }

  function positionSpotlight() {
    if (!spotlight || !highlighted?.isConnected || !visible(highlighted)) {
      spotlight?.remove();
      spotlight = null;
      return;
    }
    const bounds = highlighted.getBoundingClientRect();
    Object.assign(spotlight.style, {
      left: bounds.left - 4 + 'px', top: bounds.top - 4 + 'px',
      width: bounds.width + 8 + 'px', height: bounds.height + 8 + 'px'
    });
  }

  function highlight(el) {
    if (!spotlight) {
      spotlight = document.createElement('div');
      spotlight.dataset.websaathiSpotlight = '';
      spotlight.setAttribute('aria-hidden', 'true');
      spotlight.style.cssText = 'position:fixed;box-sizing:border-box;pointer-events:none;z-index:2147483646;border:3px solid #c34e20;border-radius:8px;box-shadow:0 0 0 4px #f8c9ab;';
      document.documentElement.append(spotlight);
    }
    highlighted = el;
    el.scrollIntoView({ block: 'center' });
    positionSpotlight();
  }

  addEventListener('scroll', positionSpotlight, true);
  addEventListener('resize', positionSpotlight);

  function fill(el, msg) {
    const control = describe(el);
    if (kind !== 'file' || WS.evidence.pageKind(location.href) !== 'file' || control.label !== msg.label
      || control.sensitive || control.kind === 'button' || msg.confirmed !== true) return false;
    if (!['Your name', 'Mobile number', 'Seller / company name', 'Order ID', 'Amount (₹)', 'What happened?', 'Date of purchase'].includes(control.label)) return false;
    const action = { actionType: 'FILL_FIELD', targetElementId: msg.id, instruction: 'Fill ' + msg.label,
      proposedValue: msg.value, requiresConfirmation: true, riskLevel: 'low', expectedOrigin: location.origin };
    const check = WS.safety.validateAction(action, {
      origin: location.origin, policy: 'assist', confirmed: true, elements: { [msg.id]: control }
    });
    if (check.decision !== 'allow' || !['input', 'textarea'].includes(control.tag)) return false;
    const prototype = control.tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, check.action.proposedValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('sidepanel/'))) return;
    if (msg.type === 'WS_SCAN') return respond(scan());
    if (msg.pageId !== pageId || WS.evidence.safeUrl(location.href) !== msg.url) return respond({ ok: false });
    const el = targets.get(msg.id);
    if (!el?.isConnected || !visible(el) || describe(el).sensitive) return respond({ ok: false });
    if (msg.type === 'WS_HIGHLIGHT') {
      highlight(el);
      return respond({ ok: true });
    }
    if (msg.type === 'WS_FILL') return respond({ ok: fill(el, msg) });
  });
})();
