(() => {
  'use strict';
  const WS = globalThis.WebSaathi;
  const { element } = WS.filing;
  const proofName = 'upi-payment-ms48213.png';
  const requestText = 'Please upload proof of payment';

  function openStore() {
    return globalThis.WebSaathiCase.createStore();
  }

  async function loadDemoProof() {
    const response = await fetch(WS.evidence.SELLER + '/assets/' + proofName, {
      redirect: 'error', signal: AbortSignal.timeout(3500)
    });
    if (!response.ok || response.headers.get('content-type') !== 'image/png') throw new Error('Proof unavailable');
    const image = await response.blob();
    if (image.size < 8 || image.size > 2 * 1024 * 1024) throw new Error('Invalid proof size');
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(image);
    });
    return { name: proofName, type: 'paymentProof', mime: image.type, dataUrl };
  }

  function explanation(activeCase) {
    return globalThis.WebSaathiCase.explainRequest(activeCase, requestText, 'hi');
  }

  function speakRequest(activeCase) {
    return WS.voice.speak(explanation(activeCase), 'hi').catch(() => 'none');
  }

  function downloadLink(attachment) {
    if (!/^data:(?:image\/(?:png|jpeg)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(attachment.dataUrl)) return null;
    return element('a', 'Download ' + attachment.name, {
      href: attachment.dataUrl, download: attachment.name
    });
  }

  function renderProof(container, activeCase, page, highlight, lang) {
    const t = (key) => WS.i18n.t(lang, key);
    container.hidden = false;
    container.replaceChildren(
      element('h3', t('proofRequest'), { id: 'proof-request-title' }),
      element('p', explanation(activeCase), { lang: 'hi' }),
      element('p', '', { id: 'speech-status', role: 'status' })
    );
    const replay = element('button', 'Read request in Hindi', { type: 'button', id: 'speak-request' });
    replay.addEventListener('click', async () => {
      const result = await speakRequest(activeCase);
      if (result === 'none') container.querySelector('#speech-status').textContent =
        'Hindi audio is unavailable here. Read the request above.';
    });
    container.append(replay);
    const draft = globalThis.WebSaathiCase.draftProofReply(activeCase, requestText);
    const attachment = draft && activeCase.attachments.find((item) => item.id === draft.attachmentId);
    if (attachment) {
      container.append(
        element('p', 'Saved proof: ' + attachment.name, { id: 'proof-name' }),
        element('p', draft.text, { id: 'proof-draft' })
      );
      const link = downloadLink(attachment);
      if (link) container.append(link);
      const copy = element('button', 'Copy draft reply', { type: 'button' });
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(draft.text);
          copy.textContent = 'Draft copied';
        } catch (_) {
          copy.textContent = 'Select and copy the draft above';
        }
      });
      container.append(copy);
    } else {
      container.append(element('p', 'Find your proof of payment before replying.'));
    }
    const actions = element('div', '', { class: 'actions' });
    for (const label of ['Upload document', 'Send']) {
      const control = page.controls.find((item) => item.label === label && !item.disabled);
      if (!control) continue;
      const button = element('button', 'Point to ' + label, { type: 'button' });
      button.addEventListener('click', () => highlight(page, control, 'WS_HIGHLIGHT'));
      actions.append(button);
    }
    const send = page.controls.find((item) => item.label === 'Send' && !item.disabled);
    const form = element('form');
    const input = element('input', '', { type: 'text', required: '', maxlength: 160, autocomplete: 'off',
      'aria-label': t('askReply'), placeholder: t('askReply') });
    const feedback = element('p', '', { id: 'reply-guidance', role: 'status' });
    form.append(input, element('button', t('askReplyButton'), { type: 'submit' }));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const question = input.value.trim();
      input.value = '';
      if (WS.redact.containsSensitiveValue(question) || /[\w.-]+@[\w.-]+/.test(question)) {
        feedback.textContent = t('sensitiveAnswer');
        return;
      }
      if (/\bsend\b|भेज|ಕಳುಹಿಸ/i.test(question)) {
        feedback.textContent = t('manualSend');
        if (send) highlight(page, send, 'WS_HIGHLIGHT');
        return;
      }
      feedback.textContent = t('reviewReply');
    });
    container.append(actions, form, feedback);
  }

  function renderTimeline(container, activeCase, lang) {
    const t = (key, vars) => WS.i18n.t(lang, key, vars);
    const docket = activeCase.docket;
    const view = docket ? { ...activeCase, docket: { ...docket, status: t(docket.status) } } : activeCase;
    globalThis.WebSaathiCase.renderTimeline(container, view, {
      lang,
      onSourceClick(fact) {
        const safe = WS.evidence.safeUrl(fact.sourceUrl);
        if (safe) chrome.tabs.create({ url: safe });
      },
      onAttachmentClick(attachment) {
        downloadLink(attachment)?.click();
      }
    });
    const statusUrl = WS.evidence.safeUrl(docket?.portalUrl);
    if (statusUrl) {
      container.append(element('a', t('docketOpen'), {
        href: statusUrl, target: '_blank', rel: 'noopener noreferrer'
      }));
    }
  }

  WS.caseView = { openStore, loadDemoProof, requestText, speakRequest, renderProof, renderTimeline };
})();
