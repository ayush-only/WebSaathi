(() => {
  'use strict';
  const WS = globalThis.WebSaathi;
  const cases = globalThis.WebSaathiCase;
  const { SELLER, HELPLINE, ORDER, supportPath, pageKind, safeUrl, localFacts, validateFact, readDocket } = WS.evidence;
  const $ = (selector) => document.querySelector(selector);
  let store;
  const ui = {
    en: ['What happened with your refund?', 'My refund never came', 'Start refund case', 'Read this page', 'Open seller support'],
    hi: ['आपके रिफंड का क्या हुआ?', 'मेरा रिफंड नहीं आया', 'रिफंड का मामला शुरू करें', 'इस पेज से सबूत पढ़ें', 'विक्रेता की चैट खोलें'],
    kn: ['ನಿಮ್ಮ ಮರುಪಾವತಿಗೆ ಏನಾಯಿತು?', 'ನನ್ನ ಮರುಪಾವತಿ ಬಂದಿಲ್ಲ', 'ಮರುಪಾವತಿ ಪ್ರಕರಣ ಆರಂಭಿಸಿ', 'ಈ ಪುಟದಿಂದ ಮಾಹಿತಿ ಓದಿ', 'ಮಾರಾಟಗಾರರ ಚಾಟ್ ತೆರೆಯಿರಿ']
  };
  let lang = 'en';
  let currentCase = null;
  let busy = false;
  let filingTab = null;
  let refreshQueued = false;
  let redrawQueued = false;
  let refreshTimer;
  let spokenDocket = null;
  const targetTab = Number(new URLSearchParams(location.search).get('targetTab')) || null;

  const t = (key, vars) => WS.i18n.t(lang, key, vars);
  let statusMessage;
  function message(key, vars) {
    statusMessage = { key, vars };
    renderStatus();
  }

  function renderStatus() {
    if (statusMessage) $('#status').textContent = t(statusMessage.key, statusMessage.vars);
  }
  const filing = WS.filing.create($('#filing'), message, (page) => { filingTab = page.tabId; }, t);

  function applyLanguage() {
    document.documentElement.lang = lang;
    const [prompt, placeholder, start, capture, support] = ui[lang];
    $('#intent-label').textContent = prompt;
    $('#intent').placeholder = placeholder;
    $('#start-case').textContent = start;
    $('#capture').textContent = capture;
    $('#support').textContent = support;
    $('#mic').textContent = t('speak');
    if ($('#open-filing')) $('#open-filing').textContent = t('openFiling');
    if ($('#save-proof')) $('#save-proof').textContent = t('saveProof');
    renderStatus();
  }

  function render() {
    $('#start').hidden = !!currentCase;
    $('#case').hidden = !currentCase;
    if (!currentCase) return;
    $('#open-filing').hidden = !!currentCase.docket || cases.missingFacts(currentCase).length > 0;
    const proof = currentCase.attachments.find((item) => item.type === 'paymentProof');
    $('#save-proof').hidden = !!proof;
    WS.caseView.renderTimeline($('#timeline'), currentCase, lang);
  }

  async function activeTab() {
    if (targetTab) return chrome.tabs.get(targetTab);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function scan() {
    const tab = await activeTab();
    const url = tab && safeUrl(tab.url);
    if (!url) return null;
    try {
      const page = await chrome.tabs.sendMessage(tab.id, { type: 'WS_SCAN' }, { frameId: 0 });
      return page?.url === url ? { ...page, kind: pageKind(url), tabId: tab.id } : null;
    } catch (_) { return null; }
  }

  async function capture(page) {
    const candidates = new Map(localFacts(page).map((fact) => [fact.key, fact]));
    for (const proposal of await WS.api.extract(page)) {
      const fact = validateFact(proposal, page);
      if (fact && !candidates.has(fact.key)) candidates.set(fact.key, fact);
    }
    for (const fact of candidates.values()) {
      const saved = currentCase.facts.find((item) => item.key === fact.key);
      const preferSource = fact.key === 'promisedDate' ? 'support' : 'order';
      if (saved && saved.value === fact.value
        && (saved.sourceUrl === fact.sourceUrl || pageKind(saved.sourceUrl) === preferSource)) continue;
      currentCase = await store.addFact(currentCase.id, fact);
    }
    const missing = cases.missingFacts(currentCase);
    render();
    message(missing.length ? 'needFacts' : 'factsReady', { fields: missing.map((key) => t(key)).join(', ') });
  }

  async function refresh() {
    if (!currentCase) return;
    const page = await scan();
    $('#proof-request').hidden = true;
    if (page?.kind === 'file' && !currentCase.docket) {
      if (!cases.missingFacts(currentCase).length) filing.show(page, currentCase, true);
      return;
    }
    filing.hide();
    if (page?.kind === 'support' && !currentCase.docket
      && currentCase.facts.find((fact) => fact.key === 'promisedDate')?.sourceUrl !== page.url) {
      await capture(page);
      return;
    }
    $('#capture').hidden = !!currentCase.docket;
    $('#support').hidden = !!currentCase.docket;
    if (page?.kind !== 'docket') return;
    const docket = readDocket(page);
    if (!docket || (currentCase.docket ? currentCase.docket.number !== docket.number : filingTab !== page.tabId)) return;
    const statusChanged = docket.status !== currentCase.docket?.status;
    if (statusChanged) currentCase = await store.setDocket(currentCase.id, docket);

    const request = docket.status === 'Information needed' && page.text.includes(WS.caseView.requestText);
    if (request) {
      const text = 'Portal asks: ' + WS.caseView.requestText;
      if (!currentCase.timeline.some((event) => event.kind === 'request'
        && event.sourceUrl === docket.portalUrl && event.text === text)) {
        currentCase = await store.addEvent(currentCase.id, { kind: 'request', text, sourceUrl: docket.portalUrl });
      }
      WS.caseView.renderProof($('#proof-request'), currentCase, page, filing.pageAction, lang);
      if (spokenDocket !== docket.number) {
        spokenDocket = docket.number;
        WS.caseView.speakRequest(currentCase);
      }
      message('proofRequest');
    } else if (statusChanged || currentCase.nextAction?.kind === 'respond') {
      if (docket.status === 'Reply received, under review') currentCase = await store.addEvent(currentCase.id, {
        kind: 'reply', text: 'The portal received your reply.', sourceUrl: docket.portalUrl
      });
      message('docketSaved');
    }
    render();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (busy) refreshQueued = true;
      else run(refresh);
    }, 120);
  }

  function redrawFromStore() {
    if (busy) {
      redrawQueued = true;
      return;
    }
    run(async () => {
      currentCase = await store.getActiveCase();
      render();
    });
  }

  function run(task) {
    if (busy) return;
    busy = true;
    const controls = document.querySelectorAll('#start-case, #capture, #support, #open-filing, #save-proof');
    controls.forEach((button) => { button.disabled = true; });
    task().catch(() => message('stepFailed')).finally(() => {
      busy = false;
      controls.forEach((button) => { button.disabled = false; });
      if (redrawQueued) {
        redrawQueued = false;
        redrawFromStore();
      }
      if (refreshQueued) { refreshQueued = false; scheduleRefresh(); }
    });
  }

  $('#start').addEventListener('submit', (ev) => {
    ev.preventDefault();
    run(async () => {
      const input = $('#intent');
      if (WS.redact.containsSensitiveValue(input.value) || /[\w.-]+@[\w.-]+/.test(input.value)) {
        input.value = '';
        message('sensitiveAnswer');
        return;
      }
      const page = await scan();
      if (!['order', 'support'].includes(page?.kind)) {
        message('sellerFirst');
        return;
      }
      currentCase = await store.createCase('Refund for order ' + ORDER);
      await store.setActiveCase(currentCase.id);
      render();
      await capture(page);
    });
  });
  $('#capture').addEventListener('click', () => run(async () => {
    const page = await scan();
    if (!['order', 'support'].includes(page?.kind)) { message('sellerPage'); return; }
    await capture(page);
  }));
  $('#support').addEventListener('click', () => run(async () => {
    const tab = await activeTab();
    await chrome.tabs.update(tab.id, { url: SELLER + supportPath });
  }));
  $('#save-proof').addEventListener('click', () => run(async () => {
    if (!currentCase || currentCase.attachments.some((item) => item.type === 'paymentProof')) return;
    await store.addAttachment(currentCase.id, await WS.caseView.loadDemoProof());
    currentCase = await store.getCase(currentCase.id);
    render();
    await refresh();
    if ($('#proof-request').hidden) message('proofSaved');
  }));
  $('#open-filing').addEventListener('click', () => run(async () => {
    const tab = await activeTab();
    await chrome.tabs.update(tab.id, { url: HELPLINE + '/file' });
  }));
  chrome.tabs.onActivated.addListener(scheduleRefresh);
  chrome.tabs.onUpdated.addListener((_id, change) => {
    if (change.status === 'complete') scheduleRefresh();
  });
  $('#lang').addEventListener('change', () => {
    lang = $('#lang').value;
    applyLanguage();
    render();
    scheduleRefresh();
    chrome.storage.local.set({ lang }).catch(() => {});
  });
  $('#mic').addEventListener('click', async () => {
    try {
      $('#intent').value = await WS.voice.listen(lang);
      $('#intent').focus();
    } catch (err) {
      if (['not-allowed', 'service-not-allowed'].includes(err.message)) {
        await chrome.tabs.create({ url: chrome.runtime.getURL('pages/mic.html') });
      }
      message('noSpeech');
    }
  });

  WS.api.init();
  run(async () => {
    const pref = await chrome.storage.local.get('lang').catch(() => ({}));
    if (Object.hasOwn(ui, pref.lang)) lang = pref.lang;
    $('#lang').value = lang;
    applyLanguage();
    store = WS.caseView.openStore();
    const unsubscribe = store.onChange((changedCase) => {
      if (!currentCase || changedCase.id === currentCase.id) redrawFromStore();
    });
    window.addEventListener('pagehide', unsubscribe, { once: true });
    currentCase = await store.getActiveCase();
    render();
    await refresh();
  });
})();
