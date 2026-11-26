'use strict';
const { llm } = require('../config');

async function converse(system, user, maxTokens) {
  const response = await fetch(llm.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(6000),
    headers: { Authorization: 'Bearer ' + llm.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: llm.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) throw new Error('Model unavailable');
  return (await response.json()).choices?.[0]?.message?.content;
}
module.exports = { converse };
