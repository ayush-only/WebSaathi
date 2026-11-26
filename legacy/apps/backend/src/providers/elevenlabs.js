'use strict';
/**
 * ElevenLabs text-to-speech provider. API key stays on the server.
 * Returns MP3 bytes. Language support depends on the chosen ElevenLabs model;
 * the extension falls back to the browser voice or text if this fails.
 */
const config = require('../config');

async function synthesize(text) {
  if (!config.elevenlabs.configured) {
    const err = new Error('ElevenLabs is not configured');
    err.status = 503;
    throw err;
  }
  const url = 'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(config.elevenlabs.voiceId) + '?output_format=mp3_44100_64';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': config.elevenlabs.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: config.elevenlabs.modelId })
  });
  if (!res.ok) {
    const err = new Error('ElevenLabs request failed with HTTP ' + res.status);
    err.status = 502;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { synthesize };
