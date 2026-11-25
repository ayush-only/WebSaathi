'use strict';
/**
 * WebSaathi backend (Node.js + Express).
 *
 *   GET  /api/health     → which providers are configured (no secrets)
 *   POST /api/next       → AWS Bedrock proposes ONE action; validated by the shared safety gate
 *   POST /api/interpret  → AWS Bedrock turns a spoken/typed answer into a field value
 *   POST /api/tts        → ElevenLabs speech (audio/mpeg)
 *
 * The extension works without this server (Local Demo Mode). Page data is untrusted,
 * redacted again here, and never logged.
 */
const express = require('express');
const config = require('./config');
const prompts = require('./prompt');
const registry = require('../../extension/shared/registry.js');
const safety = require('../../extension/shared/safety.js');
const schema = require('../../extension/shared/schema.js');
const redact = require('../../extension/shared/redact.js');

function createApp(deps) {
  const d = Object.assign({
    converse: (...a) => require('./providers/bedrock').converse(...a),
    synthesize: (...a) => require('./providers/elevenlabs').synthesize(...a),
    aiConfigured: () => config.bedrock.configured,
    ttsConfigured: () => config.elevenlabs.configured
  }, deps || {});

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '160kb' }));

  // CORS: only the WebSaathi extension (or localhost tools) may call this API from a browser.
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const ext = origin.match(/^chrome-extension:\/\/([a-p]{32})$/);
    const allowed = (ext && (!config.allowedExtensionIds.length || config.allowedExtensionIds.includes(ext[1]))) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (origin && !allowed) return res.status(403).json({ error: 'origin not allowed' });
    if (origin) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET,POST');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Tiny in-memory rate limit (per IP): enough for a prototype; use a gateway in production.
  const hits = new Map();
  app.use('/api', (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const rec = hits.get(key) || { n: 0, t: now };
    if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
    rec.n += 1;
    hits.set(key, rec);
    if (rec.n > 120) return res.status(429).json({ error: 'too many requests' });
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      ai: { provider: 'aws-bedrock', configured: d.aiConfigured(), model: d.aiConfigured() ? config.bedrock.modelId : null, region: config.bedrock.region },
      tts: { provider: 'elevenlabs', configured: d.ttsConfigured() }
    });
  });

  app.post('/api/next', async (req, res) => {
    if (!d.aiConfigured()) return res.status(503).json({ error: 'AI provider not configured' });
    const body = req.body || {};
    const page = redact.redactDeep(body.page || {});
    const session = body.session || {};
    const portal = registry.portalForOrigin(page.origin);
    const agent = !portal && session.agent === true ? registry.agentPolicy(page.origin) : null;
    if (!portal && !(agent && agent.ok)) return res.status(400).json({ error: 'unsupported origin', reason: agent ? agent.reason : undefined });
    if (!Array.isArray(page.elements)) return res.status(400).json({ error: 'missing elements' });
    const policy = portal ? portal.policy : agent.policy;
    page.policy = policy; // the server decides the policy, not the client
    if (page.pageText) page.pageText = String(page.pageText).slice(0, 1500);
    for (const k of ['clickables', 'options', 'offers']) if (Array.isArray(page[k])) page[k] = page[k].slice(0, 40); else delete page[k];

    const lang = ['en', 'hi', 'kn'].includes(session.lang) ? session.lang : 'en';
    let text;
    try {
      text = await d.converse(prompts.planSystemPrompt(lang, !!agent), prompts.planUserPrompt(page, {
        task: String(session.task || '').slice(0, 300), mode: session.mode, lang,
        history: (session.history || []).slice(-6).map((h) => String(h).slice(0, 160)),
        skipped: (session.skipped || []).slice(0, 100), handoffDone: (session.handoffDone || []).slice(0, 100)
      }), 400);
    } catch (err) {
      return res.status(err.status || 502).json({ error: 'model call failed' });
    }
    const parsed = schema.parseModelAction(text);
    if (!parsed.ok) return res.status(422).json({ error: 'invalid model output', details: parsed.errors });
    let action = parsed.value;
    if (action.actionType === 'FILL_FIELD') {
      // The model never supplies values; the user does.
      action = Object.assign({}, action, { actionType: 'ASK_QUESTION', proposedValue: null, requiresConfirmation: false });
    }
    const elements = Object.fromEntries(page.elements.concat(page.clickables || []).map((e) => [e.id, e]));
    const v = safety.validateAction(action, { origin: page.origin, policy, elements, confirmed: false });
    if (v.decision === 'block') return res.status(422).json({ error: 'action blocked by safety gate', code: v.code });
    res.json({ action: v.action, decision: v.decision, code: v.code, source: 'bedrock', model: config.bedrock.modelId });
  });

  app.post('/api/interpret', async (req, res) => {
    if (!d.aiConfigured()) return res.status(503).json({ error: 'AI provider not configured' });
    const { field, answer } = req.body || {};
    if (!field || typeof answer !== 'string' || answer.length > 2000) return res.status(400).json({ error: 'bad request' });
    if (redact.containsSensitiveValue(answer)) return res.status(400).json({ error: 'answer looks like a secret; not processed' });
    if (safety.classifyElement(field).sensitive) return res.status(400).json({ error: 'sensitive field' });
    let text;
    try {
      text = await d.converse(prompts.interpretSystemPrompt(), prompts.interpretUserPrompt(field, answer), 200);
    } catch (err) {
      return res.status(err.status || 502).json({ error: 'model call failed' });
    }
    let value = null;
    try {
      const s = text.indexOf('{');
      const e = text.lastIndexOf('}');
      value = JSON.parse(text.slice(s, e + 1)).value;
    } catch (_) { value = null; }
    if (value != null && typeof value !== 'string') value = null;
    if (value && Array.isArray(field.options) && field.options.length && !field.options.some((o) => o.value === value)) value = null;
    if (value && (value.length > 2000 || redact.containsSensitiveValue(value))) value = null;
    res.json({ value, source: 'bedrock' });
  });

  app.post('/api/tts', async (req, res) => {
    if (!d.ttsConfigured()) return res.status(503).json({ error: 'TTS provider not configured' });
    const text = redact.redactText(String((req.body || {}).text || '')).text.slice(0, 600);
    if (!text) return res.status(400).json({ error: 'empty text' });
    try {
      const audio = await d.synthesize(text);
      res.set('Content-Type', 'audio/mpeg').send(audio);
    } catch (err) {
      res.status(err.status || 502).json({ error: 'tts failed' });
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  return app;
}

if (require.main === module) {
  createApp().listen(config.port, config.host, () => {
    console.log(`WebSaathi backend on http://${config.host}:${config.port}`);
    console.log(`  AWS Bedrock: ${config.bedrock.configured ? 'configured (' + config.bedrock.modelId + ', ' + config.bedrock.region + ')' : 'NOT configured — extension uses Local Demo Mode'}`);
    console.log(`  ElevenLabs:  ${config.elevenlabs.configured ? 'configured' : 'NOT configured — extension uses browser voice / text'}`);
  });
}

module.exports = { createApp };
