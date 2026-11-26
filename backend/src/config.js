'use strict';
/**
 * Configuration from environment variables. Loads a local `.env` file (repo root or
 * backend/) if present — no extra dependency. Secrets are never logged.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadDotEnv() {
  const candidates = [path.join(__dirname, '..', '.env'), path.join(__dirname, '..', '..', '.env')];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
      if (process.env[m[1]] === undefined && value !== '') process.env[m[1]] = value;
    }
  }
}
loadDotEnv();

const env = process.env;
const hasAwsCredentials = !!(
  (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) || env.AWS_PROFILE || env.AWS_BEARER_TOKEN_BEDROCK ||
  env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || env.AWS_WEB_IDENTITY_TOKEN_FILE || env.BEDROCK_USE_DEFAULT_CREDENTIALS === 'true'
);

module.exports = {
  port: Number(env.PORT || 8787),
  host: env.HOST || '127.0.0.1',
  llm: {
    provider: env.LLM_PROVIDER || (env.BEDROCK_MODEL_ID && !env.LLM_API_KEY ? 'bedrock' : 'compatible'),
    baseUrl: env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    model: env.LLM_MODEL || 'openai/gpt-oss-20b',
    apiKey: env.LLM_API_KEY || ''
  },
  bedrock: {
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1',
    modelId: env.BEDROCK_MODEL_ID || '',
    configured: !!env.BEDROCK_MODEL_ID && hasAwsCredentials
  },
  elevenlabs: {
    apiKey: env.ELEVENLABS_API_KEY || '',
    voiceId: env.ELEVENLABS_VOICE_ID || '',
    modelId: env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    configured: !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID)
  },
  // Origins allowed to call the API: the WebSaathi extension (any unpacked ID by default) and localhost tools.
  allowedExtensionIds: (env.ALLOWED_EXTENSION_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
};
