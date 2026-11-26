(() => {
  'use strict';
  const WS = globalThis.WebSaathi;
  const fields = [
    ['Your name', 'text'],
    ['Mobile number', 'tel'],
    ['Seller / company name', 'text'],
    ['Order ID', 'text'],
    ['Amount (₹)', 'number'],
    ['Date of purchase', 'date'],
    ['What happened?', 'text']
  ];

  function caseValues(activeCase) {
    const facts = Object.fromEntries(activeCase.facts.map((fact) => [fact.key, fact.value]));
    const { orderId, refundAmount, promisedDate } = facts;
    return {
      'Order ID': orderId,
      'Amount (₹)': refundAmount,
      'What happened?': [orderId, refundAmount, promisedDate].every(Boolean)
        ? 'My refund of ' + refundAmount + ' for order ' + orderId + ' was promised by ' + promisedDate
          + '. I have not received it. Please help me get the refund.' : ''
    };
  }

  function element(tag, content, attrs = {}) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  function create(container, status, onReadyToSubmit) {
    let activePage = null;
    let filled = new Set();
    let attempt = 0;

    async function pageAction(page, control, type, extra = {}) {
      try {
        return await chrome.tabs.sendMessage(page.tabId, {
          type, id: control.id, pageId: page.pageId, url: page.url, ...extra
        }, { frameId: 0 });
      } catch (_) { return null; }
    }

    function hide() {
      container.hidden = true;
      container.replaceChildren();
      activePage = null;
      filled = new Set();
    }

    function show(page, activeCase, keepDraft = false) {
      if (page?.kind !== 'file') { hide(); return; }
      if (page.pageId === activePage && keepDraft) return;
      if (page.pageId !== activePage) filled = new Set();
      activePage = page.pageId;
      container.hidden = false;
      const heading = element('h3', 'File the practice complaint');
      const next = fields.find(([label]) => !filled.has(label));
      if (!next) {
        const submit = page.controls.find((control) => control.label === 'Submit complaint');
        container.replaceChildren(heading, element('p', 'Review the form on the page, then press Submit complaint yourself.'));
        if (submit) {
          const spotlight = element('button', 'Point to Submit complaint', { type: 'button' });
          spotlight.addEventListener('click', () => pageAction(page, submit, 'WS_HIGHLIGHT'));
          container.append(spotlight);
          pageAction(page, submit, 'WS_HIGHLIGHT');
          onReadyToSubmit(page);
        }
        return;
      }
      const [label, type] = next;
      const control = page.controls.find((item) => item.label === label && !item.disabled);
      if (!control) {
        container.replaceChildren(heading, element('p', 'The practice form field is unavailable: ' + label));
        return;
      }
      pageAction(page, control, 'WS_HIGHLIGHT');
      const candidate = caseValues(activeCase)[label];
      const prompt = element('p', label);
      if (candidate) {
        confirm(candidate);
        return;
      }
      const input = element('input', '', { id: 'field-answer', type, required: '', autocomplete: 'off',
        'aria-label': label, maxlength: 200 });
      const form = element('form');
      form.append(input, element('button', 'Review answer', { type: 'submit' }));
      container.replaceChildren(heading, prompt, form);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value || WS.redact.containsSensitiveValue(value) || /[\w.-]+@[\w.-]+/.test(value)) {
          status('Enter only the requested information.');
          return;
        }
        confirm(value);
      });

      function confirm(value) {
        const token = ++attempt;
        const preview = element('p', value, { id: 'proposed-value' });
        const yes = element('button', 'Confirm fill', { id: 'confirm-fill', type: 'button' });
        const no = element('button', 'I’ll fill it myself', { type: 'button' });
        container.replaceChildren(heading, prompt, preview, yes, no);
        yes.addEventListener('click', async () => {
          if (token !== attempt || activePage !== page.pageId) return;
          yes.disabled = true;
          no.disabled = true;
          const result = await pageAction(page, control, 'WS_FILL', { label, value, confirmed: true });
          if (!result?.ok) {
            status('WebSaathi could not fill this field. Enter it on the page.');
            yes.disabled = false;
            no.disabled = false;
            return;
          }
          if (activePage !== page.pageId) return;
          filled.add(label);
          show(page, activeCase);
        });
        no.addEventListener('click', () => {
          container.replaceChildren(heading, prompt, element('p', 'Type your answer on the page, then continue here.'));
          const done = element('button', 'Field entered', { type: 'button' });
          done.addEventListener('click', () => { filled.add(label); show(page, activeCase); });
          container.append(done);
        });
      }
    }

    return { show, hide, pageAction };
  }

  WS.filing = { create, element };
})();
