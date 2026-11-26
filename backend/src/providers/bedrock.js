'use strict';
/**
 * AWS Bedrock provider (Converse API — works across Bedrock chat models).
 * Model and region come from BEDROCK_MODEL_ID / AWS_REGION. Credentials come from the
 * standard AWS credential chain on the server; they never reach the extension.
 */
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');

let client = null;
function getClient() {
  if (!client) client = new BedrockRuntimeClient({ region: config.bedrock.region });
  return client;
}

/**
 * @param {string} system
 * @param {string} user
 * @returns {Promise<string>} model text
 */
async function converse(system, user, maxTokens) {
  if (!config.bedrock.configured) {
    const err = new Error('Bedrock is not configured');
    err.status = 503;
    throw err;
  }
  const out = await getClient().send(new ConverseCommand({
    modelId: config.bedrock.modelId,
    system: [{ text: system }],
    messages: [{ role: 'user', content: [{ text: user }] }],
    inferenceConfig: { maxTokens: maxTokens || 400, temperature: 0 }
  }));
  const parts = (out.output && out.output.message && out.output.message.content) || [];
  return parts.map((p) => p.text || '').join('');
}

module.exports = { converse };
