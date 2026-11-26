(() => {
  'use strict';
  const WS = globalThis.WebSaathi;
  const cases = globalThis.WebSaathiCase;
  const { SELLER, ORDER, supportPath, pageKind, safeUrl, localFacts, validateFact } = WS.evidence;
  const $ = (selector) => document.querySelector(selector);
  const store = cases.createFakeStore();
  const required = ['orderId', 'refundAmount', 'promisedDate'];
  const labels = { orderId: 'Order ID', refundAmount: 'Refund amount', promisedDate: 'Promised refund date' };
  const ui = {
    en: ['What happened with your refund?', 'My refund never came', 'Start refund case', 'Read this page', 'Open seller support'],
    hi: ['आपके रिफंड का क्या हुआ?', 'मेरा रिफंड नहीं आया', 'रिफंड का मामला शुरू करें', 'इस पेज से सबूत पढ़ें', 'विक्रेता की चैट खोलें'],
    kn: ['ನಿಮ್ಮ ಮರುಪಾವತಿಗೆ ಏನಾಯಿತು?', 'ನನ್ನ ಮರುಪಾವತಿ ಬಂದಿಲ್ಲ', 'ಮರುಪಾವತಿ ಪ್ರಕರಣ ಆರಂಭಿಸಿ', 'ಈ ಪುಟದಿಂದ ಮಾಹಿತಿ ಓದಿ', 'ಮಾರಾಟಗಾರರ ಚಾಟ್ ತೆರೆಯಿರಿ']
  };
  let lang = 'en';
  let currentCase = null;
  let busy = false;
  const targetTab = Number(new URLSearchParams(location.search).get('targetTab')) || null;

  function message(text) { $('#status').textContent = text; }

  function applyLanguage() {
    document.documentElement.lang = lang;
    const [prompt, placeholder, start, capture, support] = ui[lang];
    $('#intent-label').textContent = prompt;
    $('#intent').placeholder = placeholder;
    $('#start-case').textContent = start;
    $('#capture').textContent = capture;
    $('#support').textContent = support;
    $('#mic').textContent = WS.i18n.t(lang, 'speak');
  }

  function render() {
    $('#start').hidden = !!currentCase;
    $('#case').hidden = !currentCase;
    if (!currentCase) return;
    $('#case-title').textContent = currentCase.title;
    const facts = [...currentCase.facts].sort((a, b) => required.indexOf(a.key) - required.indexOf(b.key));
    $('#facts').replaceChildren(...facts.map((fact) => {
      const li = document.createElement('li');
      li.dataset.fact = fact.key;
      const title = document.createElement('strong');
      title.textContent = labels[fact.key] + ': ' + fact.value;
      const quote = document.createElement('cite');
      quote.textContent = fact.excerpt;
      const url = safeUrl(fact.sourceUrl);
      li.append(title, quote);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = new URL(url).pathname;
        li.append(link);
      }
      return li;
    }));
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
    const next = missing.length
      ? { kind: 'collect', text: 'Read the seller’s order or support page.' }
      : { kind: 'file', text: 'Review and file your refund complaint.' };
    currentCase = await store.setNextAction(currentCase.id, next);
    render();
    message(missing.length ? 'Still needed: ' + missing.map((key) => labels[key]).join(', ') : 'Evidence is ready to review.');
  }

  function run(task) {
    if (busy) return;
    busy = true;
    task().catch(() => message('Could not complete this step. Try again.')).finally(() => { busy = false; });
  }

  $('#start').addEventListener('submit', (ev) => {
    ev.preventDefault();
    run(async () => {
      const page = await scan();
      if (!['order', 'support'].includes(page?.kind)) {
        message('Open the WebSaathi practice seller order or support page first.');
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
    if (!['order', 'support'].includes(page?.kind)) { message('Open the practice seller order or support page.'); return; }
    await capture(page);
  }));
  $('#support').addEventListener('click', () => run(async () => {
    const tab = await activeTab();
    await chrome.tabs.update(tab.id, { url: SELLER + supportPath });
  }));
  $('#lang').addEventListener('change', () => {
    lang = $('#lang').value;
    applyLanguage();
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
      message(WS.i18n.t(lang, 'noSpeech'));
    }
  });

  chrome.storage.local.get('lang').then((pref) => {
    if (Object.hasOwn(ui, pref.lang)) lang = pref.lang;
    $('#lang').value = lang;
    applyLanguage();
  }).catch(() => {});
  WS.api.init();
})();
