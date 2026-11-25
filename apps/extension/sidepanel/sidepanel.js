/**
 * WebSaathi side panel controller.
 * Flow: intent → verified routing → page scan → (Live AI | local rules) proposes ONE action
 *       → shared safety gate → user confirms where needed → content script executes & reads back.
 */
(function () {
  'use strict';
  const WS = globalThis.WebSaathi;
  const $ = (sel) => document.querySelector(sel);
  const CONTENT_FILES = ['shared/registry.js', 'shared/schema.js', 'shared/redact.js', 'shared/safety.js', 'content/content.js'];

  const st = {
    lang: 'en',
    voice: false,
    tabId: null,
    portal: null,
    pendingPortal: null,
    task: '',
    taskCtx: null,   // { task, preferred, heard } while the user is choosing a website
    view: null,      // what the launcher is showing, so a language change can redraw it
    session: null
  };
  const t = (key, vars) => WS.i18n.t(st.lang, key, vars);

  // ------------------------------------------------------------------ UI helpers
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
  }

  function show(screen) {
    for (const s of ['home', 'kinds', 'options', 'route', 'session', 'unsupported']) $('#screen-' + s).hidden = s !== screen;
    $('#main').focus({ preventScroll: true });
  }

  function setBanner(text) {
    $('#banner').hidden = !text;
    $('#banner').textContent = text || '';
  }

  function applyI18n() {
    document.documentElement.lang = st.lang;
    document.querySelectorAll('[data-i18n]').forEach((n) => {
      const v = t(n.dataset.i18n);
      if (typeof v === 'string') n.textContent = v;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((n) => { n.placeholder = t(n.dataset.i18nPlaceholder); });
    updateVoiceButton();
    updateBadge();
    renderTiles();
    const v = st.view;
    if (v && v.screen === 'kinds' && !$('#screen-kinds').hidden) showKinds(v.title, v.tasks, v.heard, true);
    if (v && v.screen === 'options' && !$('#screen-options').hidden) showOptions(v.task, v.preferred, v.heard, true);
    if (st.session) { renderSiteHeader(); st.session.lastKey = ''; step(true); }
    if (!$('#screen-route').hidden && st.routePortal) showRoute(st.routePortal, true);
  }

  function updateBadge() {
    const ai = WS.api.health.ai;
    const b = $('#engine-badge');
    b.textContent = ai ? t('liveAI') : t('localDemo');
    b.className = 'badge ' + (ai ? 'badge-ai' : 'badge-local');
    $('#engine-hint').textContent = ai ? t('liveAIHint') : t('localDemoHint');
  }

  function updateVoiceButton() {
    const b = $('#voice-toggle');
    b.setAttribute('aria-pressed', String(st.voice));
    b.textContent = st.voice ? t('voiceOn') : t('voiceOff');
  }

  async function say(text) {
    if (!st.voice || !text) return;
    try { await WS.voice.speak(text, st.lang); } catch (_) { /* text stays on screen */ }
  }

  // ------------------------------------------------------------------ tab + content script
  // Test hook: when the panel is opened as a normal page with ?targetTab=<id> (automated tests only),
  // it works on that tab instead of the active one. The real side panel never has this parameter.
  const forcedTabId = Number(new URLSearchParams(location.search).get('targetTab')) || null;

  async function activeTab() {
    if (forcedTabId) { try { return await chrome.tabs.get(forcedTabId); } catch (_) { return null; } }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  function send(msg) {
    return chrome.tabs.sendMessage(st.tabId, msg);
  }

  async function ensureContent() {
    try { const r = await send({ type: 'WS_PING' }); if (r && r.ok) return r; } catch (_) { /* not injected yet */ }
    try {
      await chrome.scripting.executeScript({ target: { tabId: st.tabId }, files: CONTENT_FILES });
      const r = await send({ type: 'WS_PING' });
      if (r && r.ok) return r;
    } catch (_) { /* page not ready or not permitted */ }
    return null;
  }

  async function refreshTab(event) {
    const tab = await activeTab();
    if (!tab) return;
    const switchedTab = st.tabId !== tab.id;
    st.tabId = tab.id;
    const portal = tab.url ? WS.registry.portalForUrl(tab.url) : null;
    const s = st.session;

    if (!portal) {
      // Left a verified website, or opened a new tab / any other page: ask what the user wants to do.
      if (s) {
        if (!switchedTab && event === 'updated') setBanner(t('leftOfficial'));
        endSession();
      }
      st.portal = null;
      if (!st.pendingPortal && (s || event === 'activated' || event === 'created')) goLauncher();
      return;
    }
    st.portal = portal;
    if (portal) setBanner(null);

    if (portal && st.pendingPortal && st.pendingPortal.id === portal.id && tab.status === 'complete') {
      st.pendingPortal = null;
      await startSession(portal.policy === 'assist' ? 'assist' : 'guide');
      return;
    }
    if (s && portal) {
      if (switchedTab || s.portalId !== portal.id) { await startSession(s.mode); return; }
      if (tab.status === 'complete') scheduleStep(250);
    }
  }

  // ------------------------------------------------------------------ launcher: what do you want to do?
  const label = (obj) => obj[st.lang] || obj.en;

  function goLauncher() {
    st.taskCtx = null;
    st.view = null;
    $('#intent-msg').textContent = '';
    show('home');
  }

  function renderTiles() {
    const box = $('#category-tiles');
    box.replaceChildren(...WS.intents.CATEGORIES.map((c) =>
      el('button', { type: 'button', class: 'task', 'data-category': c.id, onclick: () => onCategory(c) },
        el('span', { 'aria-hidden': 'true' }, c.icon), el('span', {}, label(c.label)))));
  }

  function onCategory(cat) {
    const tasks = WS.intents.tasksIn(cat.id);
    st.task = label(cat.label);
    if (tasks.length === 1) showOptions(tasks[0], null, '');
    else showKinds(cat.label, tasks, '');
  }

  /** One more choice is needed ("which kind of ticket?"). */
  function showKinds(title, tasks, heard, redraw) {
    st.view = { screen: 'kinds', title, tasks, heard };
    $('#kinds-title').textContent = title ? label(title) : t('chooseKind');
    $('#kinds-heard').textContent = heard ? t('heard', { text: heard }) : '';
    $('#kinds-list').replaceChildren(...tasks.map((task) =>
      el('button', { type: 'button', class: 'pick', 'data-task': task.id, onclick: () => showOptions(task, null, heard) },
        el('span', { class: 'ico', 'aria-hidden': 'true' }, task.icon), el('span', {}, label(task.label)))));
    if (redraw) return;
    show('kinds');
    say(t('chooseKind'));
  }

  /** The "can WebSaathi help?" answer: the verified websites it can guide on for this task. */
  function showOptions(task, preferred, heard, redraw) {
    st.view = { screen: 'options', task, preferred, heard };
    st.taskCtx = { task, preferred, heard };
    st.task = [task.label.en, heard].filter(Boolean).join(' — ');
    $('#options-title').textContent = task.icon + ' ' + label(task.label);
    $('#options-heard').textContent = heard ? t('heard', { text: heard }) : '';
    const opts = WS.intents.optionsFor(task, preferred);
    $('#options-list').replaceChildren(...opts.map((o, i) => {
      const p = o.portal;
      const kindKey = { gov: 'kindGov', railway: 'kindRailway', travel: 'kindTravel', demo: 'kindDemo' }[p.kind] || 'kindGov';
      // Only an official (government / Railways) site is ever marked 'Suggested'; private travel sites are listed neutrally.
      const suggested = i === 0 && opts.length > 1 && (p.kind === 'gov' || p.kind === 'railway');
      return el('li', {},
        el('button', { type: 'button', class: 'opt' + (suggested ? ' opt-top' : ''), 'data-portal': p.id, onclick: () => showRoute(p) },
          el('span', { class: 'opt-name' }, label(p.name)),
          el('span', { class: 'opt-domain' }, WS.registry.displayDomain(p)),
          el('span', { class: 'tags' },
            suggested ? el('span', { class: 'tag tag-suggested' }, t('recommended')) : null,
            el('span', { class: 'tag' }, t(kindKey)),
            el('span', { class: 'tag' }, o.level === 'assist' ? t('levelAssist') : t('levelGuide')))));
    }));
    const ready = WS.intents.readyList(task, st.lang);
    $('#ready-box').hidden = !ready.length;
    $('#ready-list').replaceChildren(...ready.map((r) => el('li', {}, r)));
    if (redraw) return;
    show('options');
    say(label(task.label) + '. ' + t('optionsTitle') + ': ' + opts.map((o) => label(o.portal.name)).join(', '));
  }

  function showRoute(portal, redraw) {
    st.routePortal = portal;
    const kindKey = { gov: 'kindGov', railway: 'kindRailway', travel: 'kindTravel', demo: 'kindDemo' }[portal.kind] || 'kindGov';
    $('#route-kind').textContent = t(kindKey);
    $('#route-title').textContent = label(portal.name);
    $('#route-domain').textContent = WS.registry.displayDomain(portal);
    $('#route-purpose').textContent = label(portal.purpose);
    if (redraw) return;
    show('route');
    say(label(portal.name) + '. ' + label(portal.purpose));
  }

  async function openPortal() {
    const portal = st.routePortal;
    const check = WS.registry.checkNavigation(portal.url);
    if (!check.ok) { $('#intent-msg').textContent = t('blocked', { code: check.reason }); show('home'); return; }
    st.pendingPortal = portal;
    setTimeout(() => { if (st.pendingPortal === portal) st.pendingPortal = null; }, 60000); // never stay 'waiting' forever
    const tab = await chrome.tabs.create({ url: portal.url, active: true });
    st.tabId = tab.id;
    show('home');
    $('#intent-msg').textContent = '…';
  }

  /** Typed or spoken request → the launcher decides what to show. */
  function routeText(text) {
    const said = String(text || '').trim();
    if (!said) return;
    st.task = said;
    const r = WS.intents.match(said);
    const msg = $('#intent-msg');
    msg.textContent = '';
    switch (r.kind) {
      case 'intent': return showOptions(r.task, r.preferred, said);
      case 'clarify': return showKinds(r.category ? r.category.label : null, r.options, said);
      case 'portal': return showRoute(r.portal);
      case 'unsupported': msg.textContent = t(r.topic === 'bank' ? 'unsupportedBank' : 'unsupportedOther'); return say(msg.textContent);
      default: msg.textContent = t('noMatch'); return say(t('noMatch'));
    }
  }

  // ------------------------------------------------------------------ session
  let stepTimer = 0;
  let stepping = false;
  let stepQueued = false;

  function scheduleStep(ms) {
    clearTimeout(stepTimer);
    stepTimer = setTimeout(() => step(false), ms || 300);
  }

  async function startSession(mode) {
    const ping = await ensureContent();
    if (!ping || !ping.policy) { $('#intent-msg').textContent = t('notReady'); show('home'); return; }
    st.session = {
      mode: ping.policy === 'assist' ? mode : 'guide',
      policy: ping.policy,
      portalId: ping.portalId,
      tabId: st.tabId,
      skipped: [], handoffDone: [], explained: [], completed: [],
      paused: false, current: null, lastKey: '', scan: null, source: 'local', canUndo: false
    };
    renderSiteHeader();
    $('#completed').replaceChildren();
    $('#ctl-undo').disabled = true;
    $('#ctl-pause').textContent = t('pause');
    show('session');
    await step(true);
  }

  function endSession() {
    if (st.session) { send({ type: 'WS_CLEAR' }).catch(() => {}); }
    WS.voice.stopListening();
    WS.voice.stopSpeaking();
    st.session = null;
  }

  function renderSiteHeader() {
    const s = st.session;
    const portal = WS.registry.getPortal(s.portalId);
    $('#site-name').textContent = portal ? (portal.name[st.lang] || portal.name.en) : '';
    const pol = $('#site-policy');
    pol.className = 'policy ' + s.policy;
    pol.textContent = s.policy === 'assist' ? t('assistSite') : t('guideOnlySite');
    document.querySelectorAll('.mode').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.mode === s.mode));
      b.disabled = b.dataset.mode === 'assist' && s.policy !== 'assist';
    });
  }

  function updateProgress(scan) {
    const p = WS.planner.progress(scan);
    const txt = p.total ? `${t('step')} ${Math.min(p.done + 1, p.total)} ${t('of')} ${p.total}` : '';
    $('#progress-text').textContent = txt;
    const bar = $('#progress-bar');
    bar.setAttribute('aria-valuemax', String(p.total));
    bar.setAttribute('aria-valuenow', String(p.done));
    $('#progress-fill').style.width = p.total ? Math.round((p.done / p.total) * 100) + '%' : '0%';
  }

  function indexElements(scan) {
    return Object.fromEntries((scan.elements || []).map((e) => [e.id, e]));
  }

  function localPlan(scan) {
    const s = st.session;
    return WS.planner.nextAction(scan, {
      mode: s.mode, lang: st.lang, policy: scan.policy, skipped: s.skipped, handoffDone: s.handoffDone, explained: s.explained
    });
  }

  /** Decide the next action: deterministic rules first for safety/errors, then Live AI if available. */
  async function decide(scan) {
    const s = st.session;
    const byId = indexElements(scan);
    const ctx = { origin: scan.origin, policy: scan.policy, elements: byId, confirmed: false };
    let proposal = localPlan(scan);
    let source = 'local';
    const deterministicFirst = ['HUMAN_HANDOFF', 'EXPLAIN_ERROR'].includes(proposal.action.actionType);

    if (!deterministicFirst && WS.api.health.ai) {
      const out = await WS.api.next(scan, Object.assign({ lang: st.lang, task: st.task }, s));
      if (out) {
        let action = out.action;
        // The AI never supplies personal data: a proposed fill becomes a question to the user.
        if (action.actionType === 'FILL_FIELD' && byId[action.targetElementId]) {
          action = Object.assign({}, action, { actionType: 'ASK_QUESTION', proposedValue: null,
            instruction: WS.planner.questionFor(byId[action.targetElementId], st.lang) });
        }
        const v = WS.safety.validateAction(action, ctx);
        if (v.decision !== 'block') {
          const field = action.targetElementId ? byId[action.targetElementId] : null;
          return { action: v.action || action, decision: v.decision, code: v.code, meta: { field, progress: WS.planner.progress(scan) }, source: 'ai' };
        }
      }
    }
    const v = WS.safety.validateAction(proposal.action, ctx);
    return { action: v.action || proposal.action, decision: v.decision, code: v.code, meta: proposal.meta, source };
  }

  function userIsAnswering() {
    const s = st.session;
    if (!s || !s.current) return false;
    if (s.current.kind === 'confirm') return true;
    const input = $('#answer');
    return s.current.kind === 'question' && input && input.value.trim() !== '';
  }

  async function step(force) {
    const s = st.session;
    if (!s || s.paused) return;
    if (stepping) { stepQueued = true; return; }
    stepping = true;
    try {
      let res = null;
      try { res = await send({ type: 'WS_SCAN' }); } catch (_) { res = null; }
      if (!res || !res.ok) {
        if (!(await ensureContent())) { renderMessage(t('notReady'), 'card-error'); return; }
        res = await send({ type: 'WS_SCAN' });
      }
      const scan = res.scan;
      s.scan = scan;
      updateProgress(scan);
      if (!force && userIsAnswering() && indexElements(scan)[s.current.fieldId]) return;
      const d = await decide(scan);
      const key = [d.action.actionType, d.action.targetElementId, d.action.instruction, d.decision].join('|');
      if (!force && key === s.lastKey) return;
      s.lastKey = key;
      s.source = d.source;
      await present(d);
    } catch (err) {
      renderMessage(t('notReady'), 'card-error');
    } finally {
      stepping = false;
      if (stepQueued) { stepQueued = false; scheduleStep(150); }
    }
  }

  function sourceNote(source) {
    return el('p', { class: 'raw' }, source === 'ai' ? '🤖 ' + t('liveAI') : '⚙️ ' + t('localDemo'));
  }

  function setCard(cls, ...children) {
    const card = $('#card');
    card.className = 'card ' + (cls || '');
    card.replaceChildren(...children);
  }

  function renderMessage(text, cls) {
    setCard(cls || '', el('p', { class: 'instruction' }, text));
  }

  async function highlight(id, instruction, variant) {
    if (!id) { send({ type: 'WS_CLEAR' }).catch(() => {}); return { ok: false }; }
    try { return await send({ type: 'WS_HIGHLIGHT', id, instruction, variant }); } catch (_) { return { ok: false }; }
  }

  async function present(d) {
    const s = st.session;
    const field = d.meta && d.meta.field ? d.meta.field : null;
    s.current = { kind: 'info', fieldId: field ? field.id : null, action: d.action, meta: d.meta, source: d.source };

    if (d.decision === 'block') {
      await highlight(null);
      renderMessage(t('blocked', { code: d.code }), 'card-error');
      return;
    }
    switch (d.action.actionType) {
      case 'HUMAN_HANDOFF': return renderHandoff(d, field);
      case 'EXPLAIN_ERROR': return renderError(d, field);
      case 'ASK_QUESTION': return renderQuestion(d, field);
      case 'HIGHLIGHT_ELEMENT': return renderGuide(d, field);
      default:
        await highlight(null);
        setCard('card-done', el('p', { class: 'instruction' }, '🎉 ' + d.action.instruction), sourceNote(d.source));
        say(d.action.instruction);
    }
  }

  async function renderGuide(d, field) {
    const s = st.session;
    await highlight(d.action.targetElementId, d.action.instruction, 'guide');
    const final = d.meta && d.meta.final;
    setCard(final ? 'card-confirm' : '',
      el('p', { class: 'eyebrow' }, final ? '👀 ' + t('confirmTitle') : '👉 ' + t('modeGuide')),
      el('p', { class: 'instruction' }, d.action.instruction),
      el('p', { class: 'note' }, t('doItOnPage')),
      final ? null : el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { s.skipped.push(d.action.targetElementId); step(true); } }, t('skip'))),
      sourceNote(d.source));
    say(d.action.instruction);
  }

  async function renderQuestion(d, field) {
    const s = st.session;
    await highlight(field.id, d.action.instruction, 'guide');
    s.current.kind = 'question';
    const answer = (text) => handleAnswer(field, text);
    let inputArea;
    if (field.kind === 'select' || field.kind === 'radio') {
      inputArea = el('div', { class: 'choices' }, (field.options || []).map((o) =>
        el('button', { type: 'button', class: 'choice', onclick: () => answer(o.label) }, o.label)));
    } else if (field.kind === 'checkbox') {
      inputArea = el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn btn-primary', onclick: () => answer('yes') }, t('yes')),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => answer('no') }, t('no')));
    } else {
      const multiline = field.kind === 'textarea';
      const input = multiline
        ? el('textarea', { id: 'answer', rows: '3', 'aria-label': t('yourAnswer') })
        : el('input', { id: 'answer', type: 'text', 'aria-label': t('yourAnswer'), autocomplete: 'off' });
      inputArea = el('form', { onsubmit: (e) => { e.preventDefault(); answer(input.value); } },
        input,
        el('div', { class: 'row' },
          el('button', { type: 'button', class: 'btn btn-mic', 'data-mic-for': 'answer', onclick: micHandler }, '🎤 ', t('speak')),
          el('button', { type: 'submit', class: 'btn btn-primary' }, t('next'))));
    }
    setCard('',
      d.meta && d.meta.retry ? el('p', { class: 'eyebrow' }, '✏️ ' + t('fixIt')) : el('p', { class: 'eyebrow' }, '💬 ' + t('modeAssist')),
      el('p', { class: 'instruction', id: 'question' }, d.action.instruction),
      inputArea,
      el('p', { class: 'msg', id: 'answer-msg', role: 'status' }),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn btn-small', onclick: () => { s.skipped.push(field.id); step(true); } }, t('skip'))),
      sourceNote(d.source));
    const first = $('#answer') || $('#card .choice') || $('#card .btn-primary');
    if (first) first.focus();
    say(d.action.instruction);
  }

  async function handleAnswer(field, text) {
    const s = st.session;
    const msg = $('#answer-msg');
    let interp = null;
    if (WS.api.health.ai && !['select', 'radio', 'checkbox'].includes(field.kind)) {
      const out = await WS.api.interpret(field, text, st.lang);
      if (out && typeof out.value === 'string' && out.value.trim()) interp = { ok: true, value: out.value.trim(), display: out.value.trim() };
    }
    if (!interp) interp = WS.planner.interpretAnswer(field, text);
    if (!interp.ok) { if (msg) msg.textContent = t('typeAnswer'); return; }

    const action = {
      actionType: 'FILL_FIELD', targetElementId: field.id, instruction: t('confirmText', { field: field.label }),
      proposedValue: interp.value, requiresConfirmation: true, riskLevel: 'low', expectedOrigin: s.scan.origin
    };
    const v = WS.safety.validateAction(action, { origin: s.scan.origin, policy: s.scan.policy, elements: indexElements(s.scan), confirmed: false });
    if (v.decision === 'needs-confirmation') return renderConfirm(action, field, interp.display);
    if (v.decision === 'handoff') return renderHandoff({ action: v.action, meta: {}, source: 'local' }, field);
    if (v.decision === 'downgrade') return renderGuide({ action: Object.assign({}, v.action, { instruction: t('guideClick', { label: field.label }) }), meta: {}, source: 'local' }, field);
    if (msg) msg.textContent = t('blocked', { code: v.code });
  }

  function renderConfirm(action, field, display) {
    const s = st.session;
    s.current = { kind: 'confirm', fieldId: field.id };
    const choose = ['select', 'radio', 'checkbox'].includes(field.kind);
    setCard('card-confirm',
      el('p', { class: 'eyebrow' }, '🔎 ' + t('confirmTitle')),
      el('p', { class: 'instruction' }, choose ? t('confirmChoose', { field: field.label }) : t('confirmText', { field: field.label })),
      el('p', { class: 'value-preview' }, display),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn btn-primary', id: 'confirm-yes', onclick: () => doFill(action, field) }, '✓ ' + t('yesFill')),
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => { s.lastKey = ''; s.current = null; step(true); } }, t('change'))));
    $('#confirm-yes').focus();
    say(t('confirmText', { field: field.label }) + ' ' + display);
  }

  async function doFill(action, field) {
    const s = st.session;
    let res;
    try { res = await send({ type: 'WS_FILL', action, confirmed: true }); } catch (_) { res = { ok: false, code: 'NO_PAGE' }; }
    s.current = null;
    if (res && res.ok) {
      s.completed.push(field.label);
      $('#completed').append(el('li', {}, '✓ ' + field.label));
      $('#ctl-undo').disabled = false;
      setCard('card-done', el('p', { class: 'instruction' }, '✓ ' + t('filledOk', { field: field.label })));
      say(t('filledOk', { field: field.label }));
      setTimeout(() => step(false), 700); // not forced: never wipes an answer the user has started typing
      return;
    }
    if (res && res.decision === 'handoff') return renderHandoff({ action: res.action, meta: {}, source: 'local' }, field);
    await highlight(field.id, t('filledFail', { field: field.label }), 'error');
    setCard('card-error', el('p', { class: 'instruction' }, t('filledFail', { field: field.label })),
      el('p', { class: 'raw' }, res && res.code ? res.code : ''));
  }

  async function renderError(d, field) {
    const s = st.session;
    const ex = d.meta.explanation;
    await highlight(field ? field.id : null, ex.explanation, 'error');
    setCard('card-error',
      el('p', { class: 'eyebrow' }, '⚠️ ' + t('errorTitle')),
      el('p', { class: 'instruction' }, ex.explanation),
      el('p', {}, ex.fix),
      el('p', { class: 'raw' }, '“' + d.meta.raw + '”'),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn btn-primary', id: 'error-ok', onclick: () => { s.explained.push(d.meta.errorKey); step(true); } },
          s.mode === 'assist' && field ? t('fixIt') : 'OK')),
      sourceNote(d.source));
    $('#error-ok').focus();
    say(ex.explanation + ' ' + ex.fix);
  }

  async function renderHandoff(d, field) {
    const s = st.session;
    WS.voice.stopListening(); // never listen while a secret is being typed
    const kindName = (t('sensitiveKinds') || {})[field && field.sensitiveKind] || (d.meta && d.meta.kind) || '';
    const body = t('handoffBody', { kind: kindName });
    await highlight(field ? field.id : null, '🔒 ' + body, 'handoff');
    setCard('card-handoff',
      el('p', { class: 'lock', 'aria-hidden': 'true' }, '🔒'),
      el('p', { class: 'eyebrow' }, 'HUMAN HANDOFF'),
      el('h2', { class: 'instruction' }, t('handoffTitle')),
      el('p', {}, body),
      el('p', { class: 'note' }, t('handoffNever')),
      el('div', { class: 'row' },
        el('button', { type: 'button', class: 'btn btn-warn', id: 'handoff-done', onclick: () => {
          if (field) s.handoffDone.push(field.id);
          s.completed.push('🔒 ' + (field ? field.label : kindName));
          $('#completed').append(el('li', {}, '🔒 ' + (field ? field.label : kindName)));
          step(true);
        } }, t('handoffDone'))));
    $('#handoff-done').focus();
    say(t('handoffTitle') + '. ' + body);
  }

  // ------------------------------------------------------------------ voice input
  async function micHandler(e) {
    const btn = e.currentTarget;
    const target = document.getElementById(btn.dataset.micFor);
    const msg = $('#answer-msg') || $('#intent-msg');
    if (!WS.voice.inputSupported) { msg.textContent = t('noSpeech'); return; }
    btn.classList.add('listening');
    msg.textContent = t('listening');
    try {
      const text = await WS.voice.listen(st.lang);
      target.value = text;
      msg.textContent = '';
      target.focus();
      if (btn.id === 'intent-mic') routeText(text); // voice-first: say it, and the launcher answers
    } catch (err) {
      const code = err.message;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        msg.replaceChildren(t('micBlocked') + ' ',
          el('button', { type: 'button', class: 'btn btn-small', onclick: () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/mic.html') }) }, t('micAllow')));
      } else if (code === 'language-not-supported' || code === 'unsupported') {
        msg.textContent = t('noSpeech');
      } else {
        msg.textContent = '';
      }
    } finally {
      btn.classList.remove('listening');
    }
  }

  // ------------------------------------------------------------------ wiring
  function wire() {
    $('#lang').addEventListener('change', (e) => {
      st.lang = e.target.value;
      chrome.storage.local.set({ lang: st.lang });
      applyI18n();
    });
    $('#voice-toggle').addEventListener('click', () => {
      st.voice = !st.voice;
      chrome.storage.local.set({ voice: st.voice });
      if (!st.voice) WS.voice.stopSpeaking();
      updateVoiceButton();
    });
    $('#engine-badge').addEventListener('click', async () => { await WS.api.checkHealth(); updateBadge(); });
    $('#intent-form').addEventListener('submit', (e) => { e.preventDefault(); routeText($('#intent').value); });
    $('#intent-mic').addEventListener('click', micHandler);
    $('#task-practice').addEventListener('click', () => showOptions(WS.intents.getTask('practice'), null, ''));
    $('#route-open').addEventListener('click', openPortal);
    $('#route-cancel').addEventListener('click', () => {
      if (st.taskCtx) showOptions(st.taskCtx.task, st.taskCtx.preferred, st.taskCtx.heard); else goLauncher();
    });
    $('#options-back').addEventListener('click', goLauncher);
    document.querySelectorAll('[data-go-home]').forEach((b) => b.addEventListener('click', () => { setBanner(null); goLauncher(); }));
    $('#help-page').addEventListener('click', async () => {
      const tab = await activeTab();
      st.tabId = tab && tab.id;
      const portal = tab && tab.url ? WS.registry.portalForUrl(tab.url) : null;
      if (!portal) { show('unsupported'); return; }
      st.portal = portal;
      await startSession(portal.policy === 'assist' ? 'assist' : 'guide');
    });
    document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => {
      const s = st.session;
      if (!s || b.disabled) return;
      s.mode = b.dataset.mode;
      s.lastKey = '';
      s.current = null;
      renderSiteHeader();
      step(true);
    }));
    $('#ctl-pause').addEventListener('click', async () => {
      const s = st.session;
      if (!s) return;
      s.paused = !s.paused;
      $('#ctl-pause').textContent = s.paused ? t('resume') : t('pause');
      if (s.paused) {
        WS.voice.stopListening(); WS.voice.stopSpeaking();
        await highlight(null);
        renderMessage('⏸ ' + t('paused'));
      } else { s.lastKey = ''; step(true); }
    });
    $('#ctl-repeat').addEventListener('click', () => { const s = st.session; if (s && !s.paused) { s.lastKey = ''; s.current = null; step(true); } });
    $('#ctl-undo').addEventListener('click', async () => {
      const s = st.session;
      if (!s) return;
      let res;
      try { res = await send({ type: 'WS_UNDO' }); } catch (_) { res = null; }
      $('#ctl-undo').disabled = true;
      if (res && res.ok && res.element) {
        renderMessage('↩ ' + t('undone', { field: res.element.label }), 'card-done');
        setTimeout(() => { s.lastKey = ''; step(true); }, 700);
      }
    });
    $('#ctl-stop').addEventListener('click', () => { endSession(); goLauncher(); });

    chrome.runtime.onMessage.addListener((msg, sender) => {
      if (!sender.tab || sender.tab.id !== st.tabId || !st.session) return;
      if (msg.type === 'WS_PAGE_CHANGED') scheduleStep(300);
    });
    chrome.tabs.onActivated.addListener(() => refreshTab('activated'));
    chrome.tabs.onCreated.addListener(() => refreshTab('created'));
    chrome.tabs.onUpdated.addListener((tabId, info) => {
      if (tabId === st.tabId && (info.status === 'complete' || info.url)) refreshTab('updated');
      else if (st.pendingPortal && info.status === 'complete') refreshTab('updated');
    });
  }

  async function init() {
    try {
      const saved = await chrome.storage.local.get(['lang', 'voice']);
      if (saved.lang && WS.i18n.LANGS[saved.lang]) st.lang = saved.lang;
      st.voice = !!saved.voice;
    } catch (_) { /* defaults */ }
    $('#lang').value = st.lang;
    wire();
    applyI18n();
    show('home');
    await WS.api.init();
    updateBadge();
    const tab = await activeTab();
    if (tab) {
      st.tabId = tab.id;
      st.portal = tab.url ? WS.registry.portalForUrl(tab.url) : null;
    }
  }

  init();
})();
